import type { AnalyticsEvent } from "../analytics/types.ts";
import type { Artwork } from "../artworks/types.ts";
import { DIVERSITY_WINDOW, INTERACTION_WEIGHTS, MAX_SAME_MEDIUM_IN_WINDOW, MAX_SAME_MOVEMENT_IN_WINDOW, RANKING_WEIGHTS } from "./config.ts";
import type { AffinityMap, RecommendationExplanation, RecommendationPage, RecommendedArtwork, ScoreComponents, TasteProfile } from "./types.ts";

function add(map: AffinityMap, key: string, amount: number) {
  map[key] = (map[key] ?? 0) + amount;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function stableFraction(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function dwellWeight(event: AnalyticsEvent) {
  const duration = typeof event.payload?.durationMs === "number" ? event.payload.durationMs : 0;
  if (duration < 1500) return -0.25;
  if (duration < 3000) return 0;
  if (duration < 8000) return 1;
  if (duration <= 20000) return 2;
  return 3;
}

function weightFor(event: AnalyticsEvent) {
  return event.eventType === "artwork_dwell" ? dwellWeight(event) : INTERACTION_WEIGHTS[event.eventType] ?? 0;
}

export function buildTasteProfile(events: AnalyticsEvent[], artworks: Artwork[]): TasteProfile {
  const profile: TasteProfile = {
    artists: {},
    movements: {},
    media: {},
    palettes: {},
    moods: {},
    compositions: {},
    subjects: {},
    tags: {},
    hiddenArtworkIds: [],
    seenArtworkIds: [],
    eventCount: 0,
    maxAffinity: 1,
  };

  const artworkIndex = new Map(artworks.map((artwork) => [artwork.id, artwork]));
  const hidden = new Set<string>();
  const seen = new Set<string>();

  for (const event of events) {
    if (event.artworkId) seen.add(event.artworkId);
    if (event.eventType === "artwork_hide" && event.artworkId) hidden.add(event.artworkId);

    const artwork = event.artworkId ? artworkIndex.get(event.artworkId) : undefined;
    const weight = weightFor(event);

    if (!artwork || weight === 0) {
      if (event.artistId && (event.eventType === "artist_follow" || event.eventType === "artist_unfollow")) {
        add(profile.artists, event.artistId, weight);
        profile.eventCount += 1;
      }
      continue;
    }

    add(profile.artists, artwork.artist.id, weight);
    add(profile.movements, artwork.movement, weight);
    add(profile.media, artwork.features.mediumCategory, weight);
    for (const value of artwork.features.palette) add(profile.palettes, value, weight);
    for (const value of artwork.features.mood) add(profile.moods, value, weight);
    for (const value of artwork.features.composition) add(profile.compositions, value, weight);
    for (const value of artwork.features.subjects) add(profile.subjects, value, weight);
    for (const value of artwork.tags) add(profile.tags, value, weight);
    profile.eventCount += 1;
  }

  const affinityValues = [
    ...Object.values(profile.artists),
    ...Object.values(profile.movements),
    ...Object.values(profile.media),
    ...Object.values(profile.palettes),
    ...Object.values(profile.moods),
    ...Object.values(profile.compositions),
    ...Object.values(profile.subjects),
    ...Object.values(profile.tags),
  ];

  profile.hiddenArtworkIds = [...hidden].sort();
  profile.seenArtworkIds = [...seen].sort();
  profile.maxAffinity = Math.max(1, ...affinityValues.map((value) => Math.abs(value)));
  return profile;
}

function affinity(map: AffinityMap, key: string, maximum: number) {
  return clamp((map[key] ?? 0) / maximum, -1, 1);
}

function averageAffinity(map: AffinityMap, values: string[], maximum: number) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + affinity(map, value, maximum), 0) / values.length;
}

function strongestFeature(map: AffinityMap, values: string[]) {
  return [...values].sort((left, right) => (map[right] ?? 0) - (map[left] ?? 0) || left.localeCompare(right))[0];
}

function scoreArtwork(artwork: Artwork, profile: TasteProfile, catalogIndex: number, catalogSize: number): ScoreComponents {
  const max = profile.maxAffinity;
  const visualSimilarity = (
    averageAffinity(profile.palettes, artwork.features.palette, max) +
    averageAffinity(profile.compositions, artwork.features.composition, max)
  ) / 2;
  const behavioralInterest = (
    averageAffinity(profile.moods, artwork.features.mood, max) +
    averageAffinity(profile.subjects, artwork.features.subjects, max) +
    averageAffinity(profile.tags, artwork.tags, max)
  ) / 3;
  const artistAffinity = affinity(profile.artists, artwork.artist.id, max);
  const movementAffinity = affinity(profile.movements, artwork.movement, max);
  const mediumAffinity = affinity(profile.media, artwork.features.mediumCategory, max);
  const popularity = 0.35 + stableFraction(`popularity:${artwork.id}`) * 0.45;
  const freshness = artwork.year === "2026" ? 1 : 0.55;
  const curatorPosition = 1 - catalogIndex / Math.max(1, catalogSize);
  const discoveryScore = profile.eventCount === 0
    ? clamp(curatorPosition * 0.98 + stableFraction(`start:${artwork.id}`) * 0.02)
    : clamp(0.42 + (1 - Math.max(artistAffinity, 0)) * 0.38 + stableFraction(`discover:${artwork.id}`) * 0.2);
  const seenPenalty = profile.seenArtworkIds.includes(artwork.id) ? 0.42 : 0;

  return { visualSimilarity, artistAffinity, movementAffinity, mediumAffinity, behavioralInterest, popularity, freshness, discoveryScore, seenPenalty };
}

function finalScore(components: ScoreComponents) {
  return (
    components.visualSimilarity * RANKING_WEIGHTS.visualSimilarity +
    components.artistAffinity * RANKING_WEIGHTS.artistAffinity +
    components.movementAffinity * RANKING_WEIGHTS.movementAffinity +
    components.mediumAffinity * RANKING_WEIGHTS.mediumAffinity +
    components.behavioralInterest * RANKING_WEIGHTS.behavioralInterest +
    components.popularity * RANKING_WEIGHTS.popularity +
    components.freshness * RANKING_WEIGHTS.freshness +
    components.discoveryScore * RANKING_WEIGHTS.discoveryScore -
    components.seenPenalty
  );
}

function explanationFor(artwork: Artwork, profile: TasteProfile, components: ScoreComponents): RecommendationExplanation {
  if (profile.eventCount === 0) {
    return {
      text: "A balanced starting point selected to vary artist, movement, and format.",
      signals: [{ key: "discoveryScore", label: "Balanced discovery", value: components.discoveryScore }],
    };
  }

  const visualFeature = strongestFeature(
    { ...profile.palettes, ...profile.compositions },
    [...artwork.features.palette, ...artwork.features.composition],
  );
  const behavioralFeature = strongestFeature(
    { ...profile.moods, ...profile.subjects, ...profile.tags },
    [...artwork.features.mood, ...artwork.features.subjects, ...artwork.tags],
  );

  const signals = [
    { key: "artistAffinity" as const, label: "Artist affinity", feature: artwork.artist.name, value: components.artistAffinity },
    { key: "movementAffinity" as const, label: "Movement affinity", feature: artwork.movement, value: components.movementAffinity },
    { key: "visualSimilarity" as const, label: "Visual connection", feature: visualFeature, value: components.visualSimilarity },
    { key: "behavioralInterest" as const, label: "Recent interest", feature: behavioralFeature, value: components.behavioralInterest },
    { key: "mediumAffinity" as const, label: "Medium affinity", feature: artwork.features.mediumCategory, value: components.mediumAffinity },
  ]
    .filter((signal) => signal.value > 0.08)
    .sort((left, right) => right.value - left.value)
    .slice(0, 2);

  if (!signals.length) {
    return {
      text: "This appears as a discovery choice intended to keep your gallery varied.",
      signals: [{ key: "discoveryScore", label: "Discovery balance", value: components.discoveryScore }],
    };
  }

  const phrases = signals.map((signal) => signal.feature ?? signal.label.toLowerCase());
  return {
    text: `Based on recent activity, this may connect through ${phrases.join(" and ")}.`,
    signals,
  };
}

function diversify(sorted: RecommendedArtwork[]) {
  const remaining = [...sorted];
  const result: RecommendedArtwork[] = [];

  while (remaining.length) {
    const window = result.slice(-DIVERSITY_WINDOW + 1);
    const previousArtist = result.at(-1)?.artist.id;
    const candidateIndex = remaining.findIndex((candidate) => {
      const sameMovement = window.filter((item) => item.movement === candidate.movement).length;
      const sameMedium = window.filter((item) => item.features.mediumCategory === candidate.features.mediumCategory).length;
      return (
        candidate.artist.id !== previousArtist &&
        sameMovement < MAX_SAME_MOVEMENT_IN_WINDOW &&
        sameMedium < MAX_SAME_MEDIUM_IN_WINDOW
      );
    });
    result.push(remaining.splice(candidateIndex >= 0 ? candidateIndex : 0, 1)[0]);
  }

  return result;
}

export function rankArtworks(artworks: Artwork[], profile: TasteProfile, hiddenArtworkIds: string[] = []): RecommendedArtwork[] {
  const hidden = new Set([...profile.hiddenArtworkIds, ...hiddenArtworkIds]);
  const scored = artworks
    .filter((artwork) => !hidden.has(artwork.id))
    .map((artwork, index) => {
      const components = scoreArtwork(artwork, profile, index, artworks.length);
      return {
        ...artwork,
        recommendation: {
          score: finalScore(components),
          components,
          explanation: explanationFor(artwork, profile, components),
        },
      };
    })
    .sort((left, right) => (
      right.recommendation.score - left.recommendation.score ||
      stableFraction(`tie:${left.id}`) - stableFraction(`tie:${right.id}`)
    ));

  return diversify(scored);
}

export function getRecommendationPage(ranked: RecommendedArtwork[], cursor?: string | null, requestedLimit = 4): RecommendationPage {
  const limit = Math.max(1, Math.min(8, requestedLimit));
  let start = 0;
  if (cursor) {
    const index = ranked.findIndex((artwork) => artwork.slug === cursor);
    if (index < 0) return { items: [], nextCursor: null, validCursor: false };
    start = index + 1;
  }
  const items = ranked.slice(start, start + limit);
  const end = start + items.length;
  return {
    items,
    nextCursor: end < ranked.length ? items.at(-1)?.slug ?? null : null,
    validCursor: true,
  };
}
