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
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalyticsEvent>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.eventType === "string" &&
    ANALYTICS_EVENT_TYPES.includes(candidate.eventType as AnalyticsEventType) &&
    typeof candidate.anonymousSessionId === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.timestamp === "string"
  );
}
