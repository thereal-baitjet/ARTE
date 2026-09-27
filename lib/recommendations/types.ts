import type { Artwork } from "../artworks/types.ts";

export type AffinityMap = Record<string, number>;

export type TasteProfile = {
  artists: AffinityMap;
  movements: AffinityMap;
  media: AffinityMap;
  palettes: AffinityMap;
  moods: AffinityMap;
  compositions: AffinityMap;
  subjects: AffinityMap;
  tags: AffinityMap;
  hiddenArtworkIds: string[];
  seenArtworkIds: string[];
  eventCount: number;
  maxAffinity: number;
};

export type ScoreComponents = {
  visualSimilarity: number;
  artistAffinity: number;
  movementAffinity: number;
  mediumAffinity: number;
  behavioralInterest: number;
  popularity: number;
  freshness: number;
  discoveryScore: number;
  seenPenalty: number;
};

export type RecommendationSignal = {
  key: keyof Omit<ScoreComponents, "seenPenalty"> | "contrast";
  label: string;
  feature?: string;
  value: number;
};

export type RecommendationExplanation = {
  text: string;
  signals: RecommendationSignal[];
};

export type RecommendedArtwork = Artwork & {
  recommendation: {
    score: number;
    components: ScoreComponents;
    explanation: RecommendationExplanation;
  };
};

export type RecommendationPage = {
  items: RecommendedArtwork[];
  nextCursor: string | null;
  validCursor: boolean;
};

export type SimilarityMode = "visual" | "mood" | "movement" | "palette" | "unexpected";

export type SimilarityResult = {
  artwork: Artwork;
  score: number;
  connection: {
    text: string;
    signals: RecommendationSignal[];
  };
};
