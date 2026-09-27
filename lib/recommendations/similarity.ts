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

  if (mode === "palette") {
    const score = jaccard(source.features.palette, candidate.features.palette);
    return { score, text: palettes.length ? `Shared palette: ${palettes.join(", ")}.` : "A contrasting palette broadens the connection.", signals: [signal("visualSimilarity", "Palette", palettes.length ? palettes : ["contrast"], score)] };
  }
  if (mode === "mood") {
    const score = jaccard(source.features.mood, candidate.features.mood);
    return { score, text: moods.length ? `Shared mood: ${moods.join(", ")}.` : "A different emotional register creates contrast.", signals: [signal("behavioralInterest", "Mood", moods.length ? moods : ["contrast"], score)] };
  }
  if (mode === "movement") {
    const sameMovement = source.movement === candidate.movement;
    const score = sameMovement ? 1 : subjects.length ? 0.25 : 0;
    return { score, text: sameMovement ? `Both works are labeled ${source.movement}.` : subjects.length ? `A subject connection crosses movements: ${subjects.join(", ")}.` : "An across-movement discovery connection.", signals: [signal("movementAffinity", "Movement", [sameMovement ? source.movement : "cross-movement"], score)] };
  }
  if (mode === "unexpected") {
    const visual = (jaccard(source.features.palette, candidate.features.palette) + jaccard(source.features.composition, candidate.features.composition)) / 2;
    const bridge = subjects.length || moods.length;
    const score = (1 - visual) * 0.7 + (bridge ? 0.3 : stableFraction(candidate.id) * 0.15);
    const values = [...subjects, ...moods].slice(0, 2);
    return { score, text: values.length ? `An unexpected formal contrast connected by ${values.join(" and ")}.` : "An intentional contrast in palette, structure, and visual rhythm.", signals: [signal("contrast", "Unexpected contrast", values.length ? values : ["formal contrast"], score)] };
  }

  const paletteScore = jaccard(source.features.palette, candidate.features.palette);
  const compositionScore = jaccard(source.features.composition, candidate.features.composition);
  const sourceShape = "shape" in source.visual ? source.visual.shape : source.visual.aspect;
  const candidateShape = "shape" in candidate.visual ? candidate.visual.shape : candidate.visual.aspect;
  const shapeScore = sourceShape === candidateShape ? 1 : 0;
  const score = paletteScore * 0.45 + compositionScore * 0.4 + shapeScore * 0.15;
  const values = [...palettes, ...compositions].slice(0, 3);
  return { score, text: values.length ? `A metadata connection through ${values.join(", ")}.` : "A looser metadata connection based on format. Image embeddings are not enabled.", signals: [signal("visualSimilarity", "Metadata similarity", values.length ? values : [sourceShape], score)] };
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
