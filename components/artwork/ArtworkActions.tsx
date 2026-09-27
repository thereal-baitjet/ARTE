"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Artwork } from "@/lib/artworks/types";

type InteractionTable = "likes" | "saves";

const storageKeys: Record<InteractionTable, string> = {
  likes: "arte:guest:likes",
  saves: "arte:guest:saves",
};

function readGuestSet(table: InteractionTable): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKeys[table]) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeGuestSet(table: InteractionTable, values: Set<string>) {
  localStorage.setItem(storageKeys[table], JSON.stringify([...values]));
}

function PersistentToggle({
  table,
  artwork,
  inactiveLabel,
  activeLabel,
  action,
}: {
  table: InteractionTable;
  artwork: Artwork;
  inactiveLabel: string;
  activeLabel: string;
  action: "like" | "save";
}) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const client = getSupabaseBrowserClient();
      if (!client) {
        if (!cancelled) {
          setActive(readGuestSet(table).has(artwork.id));
          setReady(true);
        }
        return;
      }

      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!cancelled) {
          setActive(readGuestSet(table).has(artwork.id));
          setReady(true);
        }
        return;
      }

      const result = await client
        .from(table)
        .select("artwork_id")
        .eq("user_id", user.id)
        .eq("artwork_id", artwork.id)
        .maybeSingle();

      if (!cancelled) {
        setUserId(user.id);
        setActive(Boolean(result.data));
        setReady(true);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, [artwork.id, table]);

  async function toggle() {
    if (!ready || pending) return;

    const next = !active;
    setActive(next);
    setPending(true);
    setStatus(null);

    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      const values = readGuestSet(table);
      if (next) values.add(artwork.id); else values.delete(artwork.id);
      writeGuestSet(table, values);
      setPending(false);
      return;
    }

    const result = next
      ? await client.from(table).upsert({ user_id: userId, artwork_id: artwork.id })
      : await client.from(table).delete().eq("user_id", userId).eq("artwork_id", artwork.id);

    if (result.error) {
      setActive(!next);
      setStatus(`${inactiveLabel} could not be updated.`);
    }
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        data-action={action}
        aria-pressed={active}
        aria-label={`${active ? activeLabel : inactiveLabel} ${artwork.title}`}
        disabled={!ready || pending}
        onClick={toggle}
        className="focus-ring min-h-11 border border-[var(--hairline)] px-4 text-[11px] uppercase tracking-[0.12em] disabled:opacity-45"
      >
        {active ? activeLabel : inactiveLabel}
      </button>
      {status ? <span role="status" className="sr-only">{status}</span> : null}
    </>
  );
}

function ShareButton({ artwork }: { artwork: Artwork }) {
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}/artwork/${artwork.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: artwork.title, text: `${artwork.artist.name} — ${artwork.title}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("Artwork link copied.");
      }
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

export function ArtworkActions({ artwork, onHide, context = "feed" }: { artwork: Artwork; onHide?: () => void; context?: "feed" | "detail" }) {
  return (
    <div className="mt-8 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <PersistentToggle table="likes" artwork={artwork} inactiveLabel="Like" activeLabel="Unlike" action="like" />
        <PersistentToggle table="saves" artwork={artwork} inactiveLabel="Save" activeLabel="Unsave" action="save" />
        <ShareButton artwork={artwork} />
        <Link href={`/artwork/${artwork.slug}#related`} className="focus-ring flex min-h-11 items-center justify-center border border-[var(--hairline)] px-4 text-center text-[11px] uppercase tracking-[0.12em]">More like this</Link>
      </div>
      {context === "feed" ? (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/artist/${artwork.artist.slug}`} className="focus-ring flex min-h-11 items-center justify-center border-b border-[var(--primary-ink)] text-center text-[11px] uppercase tracking-[0.12em]">View artist</Link>
          <Link href={`/artwork/${artwork.slug}`} className="focus-ring flex min-h-11 items-center justify-center border-b border-[var(--primary-ink)] text-center text-[11px] uppercase tracking-[0.12em]">View artwork</Link>
        </div>
      ) : null}
      {onHide ? (
        <button type="button" onClick={onHide} className="focus-ring min-h-11 w-full text-[11px] uppercase tracking-[0.12em] text-[var(--muted-text)]">Hide / Not for me</button>
      ) : null}
    </div>
  );
}
