import type { Artwork } from "../artworks/types.ts";
import type { RecommendationSignal, SimilarityMode, SimilarityResult } from "./types.ts";

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function jaccard(left: string[], right: string[]) {
  const intersection = overlap(left, right).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function stableFraction(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function signal(key: RecommendationSignal["key"], label: string, values: string[], value: number): RecommendationSignal {
  return { key, label, feature: values.join(", "), value };
}

function connection(source: Artwork, candidate: Artwork, mode: SimilarityMode) {
  const palettes = overlap(source.features.palette, candidate.features.palette);
  const moods = overlap(source.features.mood, candidate.features.mood);
  const compositions = overlap(source.features.composition, candidate.features.composition);
  const subjects = overlap(source.features.subjects, candidate.features.subjects);
  const paletteAvailable = source.features.palette.length > 0 && candidate.features.palette.length > 0;
  const moodAvailable = source.features.mood.length > 0 && candidate.features.mood.length > 0;
  const compositionAvailable = source.features.composition.length > 0 && candidate.features.composition.length > 0;
  const missingVisualMetadata = [!paletteAvailable ? "palette" : "", !compositionAvailable ? "composition" : ""].filter(Boolean).join(" and ");
  const missingVisualDisclosure = missingVisualMetadata
    ? `${missingVisualMetadata[0].toUpperCase()}${missingVisualMetadata.slice(1)} metadata is unavailable for comparison.`
    : "";
  const formatConnection = source.visual.aspect === candidate.visual.aspect
    ? `Both works use a ${source.visual.aspect} format.`
    : `The catalog connects ${source.visual.aspect} and ${candidate.visual.aspect} formats.`;

  if (mode === "palette") {
    if (!paletteAvailable) return { score: 0, text: `Palette metadata is unavailable for one or both works. ${formatConnection}`, signals: [signal("visualSimilarity", "Palette", ["metadata unavailable"], 0)] };
    const score = jaccard(source.features.palette, candidate.features.palette);
    return { score, text: palettes.length ? `Shared palette: ${palettes.join(", ")}.` : "A contrasting palette broadens the connection.", signals: [signal("visualSimilarity", "Palette", palettes.length ? palettes : ["contrast"], score)] };
  }
  if (mode === "mood") {
    if (!moodAvailable) return { score: 0, text: `Mood metadata is unavailable for one or both works. ${formatConnection}`, signals: [signal("behavioralInterest", "Mood", ["metadata unavailable"], 0)] };
    const score = jaccard(source.features.mood, candidate.features.mood);
    return { score, text: moods.length ? `Shared mood: ${moods.join(", ")}.` : "A different emotional register creates contrast.", signals: [signal("behavioralInterest", "Mood", moods.length ? moods : ["contrast"], score)] };
  }
  if (mode === "movement") {
    const sameMovement = source.movement === candidate.movement;
    const score = sameMovement ? 1 : subjects.length ? 0.25 : 0;
    return { score, text: sameMovement ? `Both works are labeled ${source.movement}.` : subjects.length ? `A subject connection crosses movements: ${subjects.join(", ")}.` : "An across-movement discovery connection.", signals: [signal("movementAffinity", "Movement", [sameMovement ? source.movement : "cross-movement"], score)] };
  }
  if (mode === "unexpected") {
    const bridge = subjects.length || moods.length;
    const values = [...subjects, ...moods].slice(0, 2);
    const knownVisualScores = [
      ...(paletteAvailable ? [jaccard(source.features.palette, candidate.features.palette)] : []),
      ...(compositionAvailable ? [jaccard(source.features.composition, candidate.features.composition)] : []),
    ];
    const discoveryScore = bridge ? 0.3 : stableFraction(candidate.id) * 0.15;
    if (!knownVisualScores.length) {
      const bridgeText = values.length ? `Shared subject or mood tags: ${values.join(", ")}.` : formatConnection;
      return { score: discoveryScore, text: `An unexpected catalog discovery. ${missingVisualDisclosure} ${bridgeText}`, signals: [signal("discoveryScore", "Catalog discovery", values.length ? values : ["catalog selection"], discoveryScore)] };
    }
    const visual = knownVisualScores.reduce((sum, value) => sum + value, 0) / knownVisualScores.length;
    const hasContrast = visual < 1;
    const score = (1 - visual) * 0.7 + discoveryScore;
    const comparedMetadata = [paletteAvailable ? "palette" : "", compositionAvailable ? "composition" : ""].filter(Boolean).join(" and ");
    const bridgeText = values.length ? ` Connected by ${values.join(" and ")}.` : "";
    const text = hasContrast
      ? `An unexpected contrast in ${comparedMetadata} metadata.${bridgeText}`
      : `An unexpected catalog connection with shared ${comparedMetadata} metadata.${bridgeText}`;
    return { score, text: `${text}${missingVisualDisclosure ? ` ${missingVisualDisclosure}` : ""}`, signals: [signal(hasContrast ? "contrast" : "discoveryScore", hasContrast ? "Unexpected contrast" : "Catalog connection", values.length ? values : [comparedMetadata], score)] };
  }

  const paletteScore = jaccard(source.features.palette, candidate.features.palette);
  const compositionScore = jaccard(source.features.composition, candidate.features.composition);
  const sourceShape = "shape" in source.visual ? source.visual.shape : source.visual.aspect;
  const candidateShape = "shape" in candidate.visual ? candidate.visual.shape : candidate.visual.aspect;
  const shapeScore = sourceShape === candidateShape ? 1 : 0;
  const score = paletteScore * 0.45 + compositionScore * 0.4 + shapeScore * 0.15;
  const values = [...palettes, ...compositions].slice(0, 3);
  const text = values.length
    ? `A metadata connection through ${values.join(", ")}.${missingVisualDisclosure ? ` ${missingVisualDisclosure}` : ""}`
    : `${formatConnection} ${missingVisualDisclosure || "No shared palette or composition tags were found."} Image embeddings are not enabled.`;
  return { score, text, signals: [signal("visualSimilarity", "Metadata similarity", values.length ? values : [sourceShape], score)] };
}

export function findSimilarArtworks(source: Artwork, candidates: Artwork[], mode: SimilarityMode, limit = 4): SimilarityResult[] {
  return candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => {
      const result = connection(source, candidate, mode);
      return { artwork: candidate, score: result.score, connection: { text: result.text, signals: result.signals } };
    })
    .sort((left, right) => right.score - left.score || left.artwork.id.localeCompare(right.artwork.id))
    .slice(0, limit);
}
