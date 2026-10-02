"use client";

import Link from "next/link";
import { useState } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import { useInteraction } from "@/lib/account/interactions";
import { getAuthSnapshot } from "@/lib/auth/session";
import { SharedCorridorEntry } from "@/components/corridor/SharedCorridorEntry";
import type { Artwork } from "@/lib/artworks/types";
import type { RecommendedArtwork } from "@/lib/recommendations/types";

type InteractionTable = "likes" | "saves";
type DisplayArtwork = Artwork | RecommendedArtwork;

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
  const interaction = useInteraction(table, artwork.id);
  const { active, ready, pending, failed, loadFailed } = interaction;
  async function toggle() {
    const revision = getAuthSnapshot().revision;
    const next = !active;
    if (!await interaction.set(next) || getAuthSnapshot().revision !== revision) return;
    try {
      recordAnalyticsEvent({
        eventType: table === "likes" ? (next ? "artwork_like" : "artwork_unlike") : (next ? "artwork_save" : "artwork_unsave"),
        artwork, source, position, recommendationReason: recommendationReason(artwork),
      });
    } catch { /* Intentional actions remain saved when analytics is unavailable. */ }
  }
  const status = loadFailed ? `${inactiveLabel} status could not be loaded. Please retry.` : failed ? `${inactiveLabel} could not be updated. Please try again.` : null;
  return (
    <>
      <button type="button" data-action={action} aria-pressed={active} aria-label={`${active ? activeLabel : inactiveLabel} ${artwork.title}`} disabled={!ready || pending} onClick={() => void toggle()} className="focus-ring min-h-11 border border-[var(--hairline)] px-4 text-[11px] uppercase tracking-[0.12em] disabled:opacity-45">
        {active ? activeLabel : inactiveLabel}
      </button>
      {status ? <span role="status" className="col-span-2 text-xs leading-6 text-[var(--oxblood)]">{status}{loadFailed ? <button type="button" className="focus-ring ml-2 min-h-11 underline" onClick={interaction.retry}>Retry {inactiveLabel.toLowerCase()}</button> : null}</span> : null}
    </>
  );
}

function ShareButton({ artwork, position, source }: { artwork: DisplayArtwork; position?: number; source: string }) {
  const [status, setStatus] = useState<string | null>(null);
  async function share() {
    const revision = getAuthSnapshot().revision;
    const url = `${window.location.origin}/artwork/${artwork.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: artwork.title, text: `${artwork.artist.name} — ${artwork.title}`, url });
      else { await navigator.clipboard.writeText(url); setStatus("Artwork link copied."); }
      if (getAuthSnapshot().revision === revision) {
        try { recordAnalyticsEvent({ eventType: "artwork_share", artwork, source, position, recommendationReason: recommendationReason(artwork) }); }
        catch { /* Sharing is successful even when analytics is unavailable. */ }
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
      {context === "feed" && !artwork.isDemo && <SharedCorridorEntry artworkId={artwork.id} artworkSlug={artwork.slug} />}
      {onHide ? (
        <button type="button" onClick={() => { recordAnalyticsEvent({ eventType: "artwork_hide", artwork, source, position, recommendationReason: reason }); onHide(); }} className="focus-ring min-h-11 w-full text-[11px] uppercase tracking-[0.12em] text-[var(--muted-text)]">Hide / Not for me</button>
      ) : null}
    </div>
  );
}
