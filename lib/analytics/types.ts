export const MAX_HIDDEN_ARTWORK_IDS = 1000;

export const ANALYTICS_EVENT_TYPES = [
  "artwork_impression",
  "artwork_visible",
  "artwork_dwell",
  "artwork_like",
  "artwork_unlike",
  "artwork_save",
  "artwork_unsave",
  "artwork_share",
  "artwork_hide",
  "artwork_detail_open",
  "artist_open",
  "artist_follow",
  "artist_unfollow",
  "more_like_this_open",
  "collection_add",
  "collection_remove",
  "listing_open",
  "gallery_open",
  "inquiry_start",
  "search_query",
  "search_result_open",
  "feed_refresh",
  "recommendation_explanation_open",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsPayloadValue = string | number | boolean | null | string[];
export type AnalyticsPayload = Record<string, AnalyticsPayloadValue>;

export type AnalyticsEvent = {
  id: string;
  eventType: AnalyticsEventType;
  anonymousSessionId: string;
  userId?: string | null;
  artworkId?: string | null;
  artistId?: string | null;
  feedSessionId?: string | null;
  source: string;
  position?: number | null;
  recommendationReason?: string | null;
  timestamp: string;
  viewport?: { width: number; height: number } | null;
  payload?: AnalyticsPayload;
};

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<AnalyticsEvent>;
  const text = (input: unknown, max: number) => typeof input === "string" && input.length > 0 && input.length <= max;
  const optionalText = (input: unknown, max: number) => input == null || text(input, max);
  const validPayload = candidate.payload === undefined || (
    candidate.payload !== null && typeof candidate.payload === "object" && !Array.isArray(candidate.payload) &&
    Object.entries(candidate.payload).length <= 32 &&
    Object.entries(candidate.payload).every(([key, item]) => key.length <= 64 && !["__proto__", "constructor", "prototype"].includes(key) && (
      item === null || typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item)) ||
      (typeof item === "string" && item.length <= 2048) ||
      (Array.isArray(item) && item.length <= 32 && item.every((entry) => typeof entry === "string" && entry.length <= 512))
    ))
  );
  return (
    text(candidate.id, 128) &&
    typeof candidate.eventType === "string" &&
    ANALYTICS_EVENT_TYPES.includes(candidate.eventType as AnalyticsEventType) &&
    text(candidate.anonymousSessionId, 128) &&
    text(candidate.source, 128) &&
    text(candidate.timestamp, 64) && Number.isFinite(Date.parse(candidate.timestamp!)) &&
    optionalText(candidate.userId, 128) && optionalText(candidate.artworkId, 128) &&
    optionalText(candidate.artistId, 128) && optionalText(candidate.feedSessionId, 128) &&
    optionalText(candidate.recommendationReason, 2048) &&
    (candidate.position == null || (Number.isInteger(candidate.position) && candidate.position >= 0 && candidate.position <= 1000000)) &&
    (candidate.viewport == null || (
      typeof candidate.viewport === "object" && !Array.isArray(candidate.viewport) &&
      Number.isInteger(candidate.viewport.width) && candidate.viewport.width >= 0 && candidate.viewport.width <= 100000 &&
      Number.isInteger(candidate.viewport.height) && candidate.viewport.height >= 0 && candidate.viewport.height <= 100000
    )) && validPayload
  );
}
