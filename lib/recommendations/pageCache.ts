import { createHash } from "node:crypto";
import type { AnalyticsEvent } from "../analytics/types.ts";
import { PUBLIC_ARTWORKS } from "../artworks/publicCatalog.ts";
import { buildTasteProfile, getRecommendationPage, rankArtworks } from "./engine.ts";
import type { RecommendedArtwork } from "./types.ts";

// Process-local and short-lived. No raw event history, accounts, or sessions are stored.
const rankings = new Map<string, { expiresAt: number; items: RecommendedArtwork[] }>();
const MAX_RANKINGS = 24;
const TTL_MS = 60_000;

export function getPublicRecommendationPage(events: AnalyticsEvent[], hiddenArtworkIds: string[], cursor: string | null, limit = 4) {
  const profile = buildTasteProfile(events, PUBLIC_ARTWORKS);
  const hidden = [...new Set(hiddenArtworkIds)].sort();
  const key = createHash("sha256").update(JSON.stringify({ profile, hidden })).digest("hex");
  const now = Date.now();
  for (const [entryKey, entry] of rankings) if (entry.expiresAt <= now) rankings.delete(entryKey);
  let ranking = rankings.get(key);
  if (!ranking) {
    ranking = { expiresAt: now + TTL_MS, items: rankArtworks(PUBLIC_ARTWORKS, profile, hidden) };
    while (rankings.size >= MAX_RANKINGS) rankings.delete(rankings.keys().next().value!);
    rankings.set(key, ranking);
  }
  return { ...getRecommendationPage(ranking.items, cursor, limit), profileEventCount: profile.eventCount };
}
