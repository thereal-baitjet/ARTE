import type { AnalyticsEventType } from "../analytics/types.ts";

export const INTERACTION_WEIGHTS: Partial<Record<AnalyticsEventType, number>> = {
  artwork_like: 3,
  artwork_unlike: -3,
  artwork_save: 5,
  artwork_unsave: -5,
  artwork_share: 4,
  artwork_hide: -7,
  artwork_detail_open: 2,
  artist_open: 2,
  artist_follow: 7,
  artist_unfollow: -7,
  more_like_this_open: 6,
  collection_add: 6,
  collection_remove: -6,
  listing_open: 1,
  inquiry_start: 3,
};

export const RANKING_WEIGHTS = {
  visualSimilarity: 0.36,
  artistAffinity: 0.14,
  movementAffinity: 0.1,
  mediumAffinity: 0.08,
  behavioralInterest: 0.08,
  popularity: 0.07,
  freshness: 0.06,
  discoveryScore: 0.11,
} as const;

export const DIVERSITY_WINDOW = 4;
export const MAX_SAME_MOVEMENT_IN_WINDOW = 2;
export const MAX_SAME_MEDIUM_IN_WINDOW = 2;
