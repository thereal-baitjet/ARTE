"use client";

import { useEffect, useRef, useState } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artist } from "@/lib/artworks/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const FOLLOW_STORAGE_KEY = "arte:guest:follows";

function guestFollows(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FOLLOW_STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch { return new Set(); }
}

export function ArtistFollow({ artist }: { artist: Artist }) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const identityEpoch = useRef(0);
  const owner = useRef<string | null | undefined>(undefined);
  const inFlight = useRef(false);
  const client = getSupabaseBrowserClient();

  useEffect(() => {
    const invalidateIdentity = () => {
      identityEpoch.current++;
      owner.current = undefined;
    };
    const invalidate = () => {
      invalidateIdentity();
      setReady(false);
      setActive(false);
      setStatus(null);
      setRevision((value) => value + 1);
    };
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && (event === "SIGNED_OUT" || session?.user.id !== owner.current)) invalidate();
    }).data.subscription;
    const storageChanged = (event: StorageEvent) => { if (event.key === null || event.key === FOLLOW_STORAGE_KEY) invalidate(); };
    window.addEventListener("storage", storageChanged);
    window.addEventListener("arte:analytics-reset", invalidate);
    return () => {
      invalidateIdentity();
      subscription?.unsubscribe();
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("arte:analytics-reset", invalidate);
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    const epoch = ++identityEpoch.current;
    async function hydrate() {
      setReady(false);
      try {
        const response = client ? await client.auth.getUser() : null;
        if (response?.error && response.error.name !== "AuthSessionMissingError") throw response.error;
        const id = response?.data.user?.id ?? null;
        let following: boolean;
        if (client && id) {
          const result = await client.from("follows").select("artist_id").eq("user_id", id).eq("artist_id", artist.id).maybeSingle();
          if (result.error) throw result.error;
          following = Boolean(result.data);
        } else following = guestFollows().has(artist.id);
        if (!cancelled && epoch === identityEpoch.current) { owner.current = id; setActive(following); setReady(true); setStatus(null); }
      } catch {
        if (!cancelled && epoch === identityEpoch.current) { owner.current = undefined; setActive(false); setStatus("Follow status could not be loaded. Please retry."); }
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [artist.id, client, revision]);

  async function toggle() {
    if (!ready || inFlight.current || owner.current === undefined) return;
    const epoch = identityEpoch.current;
    const userId = owner.current;
    const next = !active;
    inFlight.current = true;
    setActive(next);
    setBusy(true);
    setStatus(null);
    try {
      if (client) {
        const response = await client.auth.getUser();
        if (response.error && response.error.name !== "AuthSessionMissingError") throw response.error;
        if ((response.data.user?.id ?? null) !== userId || epoch !== identityEpoch.current) {
          identityEpoch.current++;
          owner.current = undefined;
          setReady(false);
          setActive(false);
          setRevision((value) => value + 1);
          return;
        }
      }
      if (client && userId) {
        const result = next
          ? await client.from("follows").upsert({ user_id: userId, artist_id: artist.id }).select("artist_id").single()
          : await client.from("follows").delete().eq("user_id", userId).eq("artist_id", artist.id).select("artist_id").single();
        if (result.error) throw result.error;
      } else {
        const follows = guestFollows();
        if (next) follows.add(artist.id); else follows.delete(artist.id);
        localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify([...follows]));
      }
      if (epoch !== identityEpoch.current) return;
      try { recordAnalyticsEvent({ eventType: next ? "artist_follow" : "artist_unfollow", artistId: artist.id, source: "artist_profile" }); }
      catch { /* A saved follow remains successful when analytics storage is unavailable. */ }
      window.dispatchEvent(new Event("arte:follows-changed"));
      setStatus(next ? "Artist followed. Your next discovery refresh will reflect this preference." : "Artist unfollowed.");
    } catch {
      if (epoch === identityEpoch.current) { setActive(!next); setStatus("Your follow could not be saved. Please try again."); }
    } finally { inFlight.current = false; setBusy(false); }
  }

  return (
    <div className="mt-7">
      <button type="button" aria-label={`${active ? "Unfollow" : "Follow"} ${artist.name}`} aria-pressed={active} disabled={!ready || busy} onClick={() => void toggle()} className="focus-ring min-h-12 border border-[var(--primary-ink)] px-6 text-xs uppercase tracking-[0.14em] disabled:opacity-50">{busy ? "Saving…" : active ? "Following" : "Follow artist"}</button>
      {status ? <p role="status" className="mt-3 text-sm leading-6 text-[var(--muted-text)]">{status}{!ready ? <button type="button" onClick={() => setRevision((value) => value + 1)} className="focus-ring ml-2 min-h-11 underline">Retry follow status</button> : null}</p> : null}
    </div>
  );
}
