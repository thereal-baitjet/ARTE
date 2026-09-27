import { isAnalyticsEvent, type AnalyticsEvent, type AnalyticsEventType } from "../analytics/types.ts";
import type { Artwork } from "../artworks/types.ts";

export const ATTENTION_WINDOW_DAYS = 30;
const DAY = 86_400_000;
const HALF_LIFE_DAYS = 7;

export type AttentionResult = {
  artwork: Artwork;
  score: number;
  saveCount: number;
  likeCount: number;
  signals: string[];
  latestActivityAt: string;
};

const SIGNALS: Partial<Record<AnalyticsEventType, { label: string; weight: number; bucket: string }>> = {
  artwork_impression: { label: "Viewed", weight: 0.25, bucket: "view" },
  artwork_visible: { label: "Viewed", weight: 0.25, bucket: "view" },
  artwork_detail_open: { label: "Opened details", weight: 2, bucket: "detail" },
  artwork_share: { label: "Shared", weight: 4, bucket: "share" },
  more_like_this_open: { label: "Explored connections", weight: 3, bucket: "related" },
};

/** Event-based attention, suitable for a supplied event scope; never a quality ranking. */
export function buildAttentionRanking(events: AnalyticsEvent[], artworks: Artwork[], now = Date.now()): AttentionResult[] {
  if (!Number.isFinite(now)) return [];
  const catalog = new Map(artworks.map((artwork) => [artwork.id, artwork]));
  const cutoff = now - ATTENTION_WINDOW_DAYS * DAY;
  const valid = events.filter((event) => {
    if (!isAnalyticsEvent(event) || !event.artworkId || !catalog.has(event.artworkId)) return false;
    const timestamp = Date.parse(event.timestamp);
    return timestamp >= cutoff && timestamp <= now;
  }).sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp) || left.id.localeCompare(right.id));
  const buckets = new Map<string, { event: AnalyticsEvent; label: string; weight: number; save: boolean; like: boolean }>();
  const seenEventIds = new Set<string>();
  for (const event of valid) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);
    const prefix = `${event.anonymousSessionId}:${event.artworkId}`;
    if (["artwork_like", "artwork_unlike", "artwork_save", "artwork_unsave"].includes(event.eventType)) {
      const save = event.eventType === "artwork_save" || event.eventType === "artwork_unsave";
      const active = event.eventType === "artwork_like" || event.eventType === "artwork_save";
      const key = `${prefix}:${save ? "save" : "like"}`;
      // Toggle state contributes once per session, so clicking repeatedly cannot inflate it.
      if (active) buckets.set(key, { event, label: save ? "Saved" : "Liked", weight: save ? 5 : 3, save, like: !save });
      else buckets.delete(key);
      continue;
    }
    const signal = event.eventType === "artwork_dwell"
      ? (typeof event.payload?.durationMs === "number" && event.payload.durationMs >= 3000
        ? { label: "Time spent", weight: Math.min(event.payload.durationMs, 30000) / 10000, bucket: "dwell" } : null)
      : SIGNALS[event.eventType];
    if (!signal) continue;
    const day = Math.floor(Date.parse(event.timestamp) / DAY);
    const key = `${prefix}:${signal.bucket}:${day}`;
    const existing = buckets.get(key);
    // Impression/visible events share a bucket. Reopened detail pages count once per day.
    if (!existing || signal.weight > existing.weight) {
      buckets.set(key, { event, label: signal.label, weight: signal.weight, save: false, like: false });
    }
  }
  const results = new Map<string, AttentionResult>();
  for (const { event, label, weight, save, like } of buckets.values()) {
    const artwork = catalog.get(event.artworkId!)!;
    const item = results.get(artwork.id) ?? { artwork, score: 0, saveCount: 0, likeCount: 0, signals: [], latestActivityAt: event.timestamp };
    const elapsedDays = (now - Date.parse(event.timestamp)) / DAY;
    item.score += weight * Math.pow(0.5, elapsedDays / HALF_LIFE_DAYS);
    item.saveCount += Number(save);
    item.likeCount += Number(like);
    if (!item.signals.includes(label)) item.signals.push(label);
    if (Date.parse(event.timestamp) > Date.parse(item.latestActivityAt)) item.latestActivityAt = event.timestamp;
    results.set(artwork.id, item);
  }
  return [...results.values()].sort((left, right) => right.score - left.score || left.artwork.id.localeCompare(right.artwork.id));
}

export function mostSavedAttention(results: AttentionResult[]) {
  return results.filter(({ saveCount }) => saveCount > 0).sort((left, right) => right.saveCount - left.saveCount || right.score - left.score || left.artwork.id.localeCompare(right.artwork.id));
}
