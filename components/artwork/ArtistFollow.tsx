"use client";

import { recordAnalyticsEvent } from "@/lib/analytics/client";
import { useInteraction } from "@/lib/account/interactions";
import { getAuthSnapshot } from "@/lib/auth/session";
import type { Artist } from "@/lib/artworks/types";

export function ArtistFollow({ artist }: { artist: Artist }) {
  const interaction = useInteraction("follows", artist.id);
  const { active, ready, pending, failed, loadFailed } = interaction;
  async function toggle() {
    const revision = getAuthSnapshot().revision;
    const next = !active;
    if (!await interaction.set(next) || getAuthSnapshot().revision !== revision) return;
    try { recordAnalyticsEvent({ eventType: next ? "artist_follow" : "artist_unfollow", artistId: artist.id, source: "artist_profile" }); }
    catch { /* A follow remains saved when analytics is unavailable. */ }
  }
  const status = loadFailed ? "Follow status could not be loaded. Please retry." : failed ? "Your follow could not be saved. Please try again." : null;
  return (
    <div className="mt-7">
      <button type="button" aria-label={`${active ? "Unfollow" : "Follow"} ${artist.name}`} aria-pressed={active} disabled={!ready || pending} onClick={() => void toggle()} className="focus-ring min-h-12 border border-[var(--primary-ink)] px-6 text-xs uppercase tracking-[0.14em] disabled:opacity-50">{pending ? "Saving…" : active ? "Following" : "Follow artist"}</button>
      {status ? <p role="status" className="mt-3 text-sm leading-6 text-[var(--muted-text)]">{status}{loadFailed ? <button type="button" onClick={interaction.retry} className="focus-ring ml-2 min-h-11 underline">Retry follow status</button> : null}</p> : null}
      <span role="status" className="sr-only">{ready && !pending && !status ? active ? "Artist followed." : "Artist not followed." : ""}</span>
    </div>
  );
}
