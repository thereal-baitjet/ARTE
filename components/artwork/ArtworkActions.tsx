"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Artwork } from "@/lib/artworks/types";
import type { RecommendedArtwork } from "@/lib/recommendations/types";

type InteractionTable = "likes" | "saves";
type DisplayArtwork = Artwork | RecommendedArtwork;

const storageKeys: Record<InteractionTable, string> = {
  likes: "arte:guest:likes",
  saves: "arte:guest:saves",
};

function readGuestSet(table: InteractionTable): Set<string> {
  const raw = localStorage.getItem(storageKeys[table]);
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch { return new Set(); }
}

function writeGuestSet(table: InteractionTable, values: Set<string>) {
  localStorage.setItem(storageKeys[table], JSON.stringify([...values]));
}

function recommendationReason(artwork: DisplayArtwork) {
  return "recommendation" in artwork ? artwork.recommendation.explanation.text : artwork.recommendationReason;
}

function PersistentToggle({ table, artwork, inactiveLabel, activeLabel, action, position, source }: {
  table: InteractionTable;
  artwork: DisplayArtwork;
  inactiveLabel: string;
  activeLabel: string;
  action: "like" | "save";
  position?: number;
  source: string;
}) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const identityEpoch = useRef(0);
  const owner = useRef<string | null | undefined>(undefined);
  const inFlight = useRef(false);
  const originId = useId();
  const client = getSupabaseBrowserClient();

  useEffect(() => {
    function invalidateIdentity() {
      identityEpoch.current++;
      owner.current = undefined;
    }
    function refresh() {
      invalidateIdentity();
      setReady(false);
      setRevision((value) => value + 1);
    }
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT" || session?.user.id !== owner.current) refresh();
    }).data.subscription;
    function storageChanged(event: StorageEvent) {
      if (event.key === null || event.key === storageKeys[table]) refresh();
    }
    function interactionChanged(event: Event) {
      if ((event as CustomEvent<{ originId?: string }>).detail?.originId !== originId) refresh();
    }
    window.addEventListener("storage", storageChanged);
    window.addEventListener(`arte:${table}-changed`, interactionChanged);
    window.addEventListener("arte:analytics-reset", refresh);
    return () => {
      invalidateIdentity();
      subscription?.unsubscribe();
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener(`arte:${table}-changed`, interactionChanged);
      window.removeEventListener("arte:analytics-reset", refresh);
    };
  }, [client, originId, table]);

  useEffect(() => {
    let cancelled = false;
    const epoch = ++identityEpoch.current;
    async function hydrate() {
      setReady(false);
      try {
        const response = client ? await client.auth.getUser() : null;
        if (response?.error && response.error.name !== "AuthSessionMissingError") throw response.error;
        const user = response?.data.user ?? null;
        let next: boolean;
        if (client && user) {
          const result = await client.from(table).select("artwork_id").eq("user_id", user.id).eq("artwork_id", artwork.id).maybeSingle();
          if (result.error) throw result.error;
          next = Boolean(result.data);
        } else next = readGuestSet(table).has(artwork.id);
        if (!cancelled && epoch === identityEpoch.current) {
          owner.current = user?.id ?? null;
          setActive(next);
          setReady(true);
          setStatus(null);
        }
      } catch {
        if (!cancelled && epoch === identityEpoch.current) {
          owner.current = undefined;
          setActive(false);
          setStatus(`${inactiveLabel} status could not be loaded. Please retry.`);
        }
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [artwork.id, client, inactiveLabel, revision, table]);

  async function toggle() {
    if (!ready || inFlight.current || owner.current === undefined) return;
    const epoch = identityEpoch.current;
    const userId = owner.current;
    const previous = active;
    const next = !active;
    inFlight.current = true;
    setActive(next);
    setPending(true);
    setStatus(null);
    try {
      if (client) {
        const response = await client.auth.getUser();
        if (response.error && response.error.name !== "AuthSessionMissingError") throw response.error;
        if ((response.data.user?.id ?? null) !== userId || epoch !== identityEpoch.current) {
          identityEpoch.current++;
          owner.current = undefined;
          setReady(false);
          setRevision((value) => value + 1);
          return;
        }
      }
      if (client && userId) {
        const result = next
          ? await client.from(table).upsert({ user_id: userId, artwork_id: artwork.id }).select("artwork_id").single()
          : await client.from(table).delete().eq("user_id", userId).eq("artwork_id", artwork.id).select("artwork_id").single();
        if (result.error) throw result.error;
      } else {
        const values = readGuestSet(table);
        if (next) values.add(artwork.id); else values.delete(artwork.id);
        writeGuestSet(table, values);
      }
      if (epoch !== identityEpoch.current) return;
      // A successful save remains successful if analytics storage is unavailable.
      try {
        recordAnalyticsEvent({
          eventType: table === "likes" ? (next ? "artwork_like" : "artwork_unlike") : (next ? "artwork_save" : "artwork_unsave"),
          artwork, source, position, recommendationReason: recommendationReason(artwork),
        });
      } catch { /* Analytics is best-effort. */ }
      window.dispatchEvent(new CustomEvent(`arte:${table}-changed`, { detail: { originId, artworkId: artwork.id } }));
    } catch {
      if (epoch === identityEpoch.current) {
        setActive(previous);
        setStatus(`${inactiveLabel} could not be updated. Please try again.`);
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" data-action={action} aria-pressed={active} aria-label={`${active ? activeLabel : inactiveLabel} ${artwork.title}`} disabled={!ready || pending} onClick={() => void toggle()} className="focus-ring min-h-11 border border-[var(--hairline)] px-4 text-[11px] uppercase tracking-[0.12em] disabled:opacity-45">
        {active ? activeLabel : inactiveLabel}
      </button>
      {status ? <span role="status" className="col-span-2 text-xs leading-6 text-[var(--oxblood)]">{status}{!ready ? <button type="button" className="focus-ring ml-2 min-h-11 underline" onClick={() => setRevision((value) => value + 1)}>Retry {inactiveLabel.toLowerCase()}</button> : null}</span> : null}
    </>
  );
}

function ShareButton({ artwork, position, source }: { artwork: DisplayArtwork; position?: number; source: string }) {
  const [status, setStatus] = useState<string | null>(null);
  async function share() {
    const url = `${window.location.origin}/artwork/${artwork.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: artwork.title, text: `${artwork.artist.name} — ${artwork.title}`, url });
      else { await navigator.clipboard.writeText(url); setStatus("Artwork link copied."); }
      recordAnalyticsEvent({ eventType: "artwork_share", artwork, source, position, recommendationReason: recommendationReason(artwork) });
    } catch {
      setStatus("Sharing was cancelled.");
    }
  }
  return (
    <>
      <button type="button" onClick={share} className="focus-ring min-h-11 border border-[var(--hairline)] px-4 text-[11px] uppercase tracking-[0.12em]">Share</button>
      {status ? <span role="status" className="sr-only">{status}</span> : null}
    </>
  );
}

export function ArtworkActions({ artwork, onHide, context = "feed", position }: { artwork: DisplayArtwork; onHide?: () => void; context?: "feed" | "detail"; position?: number }) {
  const source = context === "feed" ? "discover_feed" : "artwork_detail";
  const reason = recommendationReason(artwork);
  return (
    <div className="mt-8 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <PersistentToggle table="likes" artwork={artwork} inactiveLabel="Like" activeLabel="Unlike" action="like" position={position} source={source} />
        <PersistentToggle table="saves" artwork={artwork} inactiveLabel="Save" activeLabel="Unsave" action="save" position={position} source={source} />
        <ShareButton artwork={artwork} position={position} source={source} />
        <Link href={`/artwork/${artwork.slug}#related`} onClick={() => recordAnalyticsEvent({ eventType: "more_like_this_open", artwork, source, position, recommendationReason: reason, payload: { mode: "visual" } })} className="focus-ring flex min-h-11 items-center justify-center border border-[var(--hairline)] px-4 text-center text-[11px] uppercase tracking-[0.12em]">More like this</Link>
      </div>
      {context === "feed" ? (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/artist/${artwork.artist.slug}`} onClick={() => recordAnalyticsEvent({ eventType: "artist_open", artwork, source, position, recommendationReason: reason })} className="focus-ring flex min-h-11 items-center justify-center border-b border-[var(--primary-ink)] text-center text-[11px] uppercase tracking-[0.12em]">View artist</Link>
          <Link href={`/artwork/${artwork.slug}`} onClick={() => recordAnalyticsEvent({ eventType: "artwork_detail_open", artwork, source, position, recommendationReason: reason })} className="focus-ring flex min-h-11 items-center justify-center border-b border-[var(--primary-ink)] text-center text-[11px] uppercase tracking-[0.12em]">View artwork</Link>
        </div>
      ) : null}
      {onHide ? (
        <button type="button" onClick={() => { recordAnalyticsEvent({ eventType: "artwork_hide", artwork, source, position, recommendationReason: reason }); onHide(); }} className="focus-ring min-h-11 w-full text-[11px] uppercase tracking-[0.12em] text-[var(--muted-text)]">Hide / Not for me</button>
      ) : null}
    </div>
  );
}
