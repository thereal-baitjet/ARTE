import type { Artwork, ArtworkAspect } from "../artworks/types.ts";

export const MAX_SEARCH_LENGTH = 160;

export type SearchFilters = {
  artist: string;
  movement: string;
  mood: string;
  palette: string;
  orientation: "" | ArtworkAspect;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  artist: "", movement: "", mood: "", palette: "", orientation: "",
};

export type SearchState = { query: string; filters: SearchFilters };
export type SearchMatch = { label: string; value: string };
export type SearchResult = {
  artwork: Artwork;
  score: number;
  matches: SearchMatch[];
  corrections: Array<{ from: string; to: string }>;
};

const STOP_WORDS = new Set(["a", "an", "and", "art", "artwork", "artworks", "for", "in", "me", "of", "show", "the", "with"]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

// One insertion, deletion, replacement, or adjacent transposition only.
// Short words deliberately require an exact or prefix match.
function isOneEditApart(left: string, right: string) {
  if (left.length < 4 || right.length < 4 || Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const mismatches: number[] = [];
    for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) mismatches.push(index);
    if (mismatches.length === 1) return true;
    return mismatches.length === 2 && mismatches[1] === mismatches[0] + 1 && left[mismatches[0]] === right[mismatches[1]] && left[mismatches[1]] === right[mismatches[0]];
  }
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) index += 1;
  return shorter.slice(index) === longer.slice(index + 1);
}

function fieldsFor(artwork: Artwork) {
  return [
    { label: "Title", values: [artwork.title], weight: 10 },
    { label: "Artist", values: [artwork.artist.name], weight: 8 },
    { label: "Movement", values: [artwork.movement], weight: 6 },
    { label: "Subject", values: artwork.features.subjects, weight: 6 },
    { label: "Mood", values: artwork.features.mood, weight: 5 },
    { label: "Palette", values: artwork.features.palette, weight: 5 },
    { label: "Composition", values: artwork.features.composition, weight: 4 },
    { label: "Tag", values: artwork.tags, weight: 4 },
    { label: "Orientation", values: [artwork.visual.aspect], weight: 3 },
    { label: "Medium", values: [artwork.medium, artwork.features.mediumCategory], weight: 2 },
    { label: "Description", values: [artwork.description], weight: 2 },
    { label: "Year", values: [artwork.year], weight: 2 },
    { label: "Period", values: [artwork.features.period], weight: 2 },
    { label: "Geography", values: [artwork.features.geography], weight: 2 },
    { label: "Museum", values: artwork.museum ? [artwork.museum.name] : [], weight: 2 },
  ].flatMap(({ label, values, weight }) => values.map((value) => ({ label, value, weight, words: words(value) })));
}

export function searchArtworks(artworks: Artwork[], query: string, filters: SearchFilters = EMPTY_SEARCH_FILTERS): SearchResult[] {
  const terms = [...new Set(words(query.slice(0, MAX_SEARCH_LENGTH)).filter((word) => !STOP_WORDS.has(word)))];
  const results: SearchResult[] = [];

  for (const artwork of artworks) {
    if (filters.artist && artwork.artist.slug !== filters.artist) continue;
    if (filters.movement && artwork.movement !== filters.movement) continue;
    if (filters.mood && !artwork.features.mood.includes(filters.mood)) continue;
    if (filters.palette && !artwork.features.palette.includes(filters.palette)) continue;
    if (filters.orientation && artwork.visual.aspect !== filters.orientation) continue;

    const fields = fieldsFor(artwork);
    const matches: SearchMatch[] = [];
    const corrections: SearchResult["corrections"] = [];
    let score = 0;
    let complete = true;

    for (const term of terms) {
      let best: { score: number; label: string; value: string; correction?: string } | undefined;
      for (const field of fields) {
        for (const word of field.words) {
          const exact = word === term;
          const prefix = !exact && term.length >= 3 && word.startsWith(term);
          const fuzzy = !exact && !prefix && isOneEditApart(term, word);
          if (!exact && !prefix && !fuzzy) continue;
          const matchScore = (exact ? 100 : prefix ? 60 : 20) + field.weight;
          if (!best || matchScore > best.score) best = { score: matchScore, label: field.label, value: field.value, correction: fuzzy ? word : undefined };
        }
      }
      if (!best) { complete = false; break; }
      score += best.score;
      if (!matches.some((match) => match.label === best.label && match.value === best.value)) matches.push({ label: best.label, value: best.value });
      if (best.correction) corrections.push({ from: term, to: best.correction });
    }

    if (complete) results.push({ artwork, score, matches, corrections });
  }

  // Stable catalog ordering is the tie breaker; identical requests are deterministic.
  return results.sort((left, right) => right.score - left.score);
}

export function getSearchFacets(artworks: Artwork[]) {
  const unique = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
  return {
    artists: [...new Map(artworks.map(({ artist }) => [artist.slug, { value: artist.slug, label: artist.name }])).values()].sort((left, right) => left.label.localeCompare(right.label)),
    movements: unique(artworks.map(({ movement }) => movement)),
    moods: unique(artworks.flatMap(({ features }) => features.mood)),
    palettes: unique(artworks.flatMap(({ features }) => features.palette)),
    orientations: unique(artworks.map(({ visual }) => visual.aspect)) as ArtworkAspect[],
  };
}

export function parseSearchState(params: URLSearchParams, artworks: Artwork[]): SearchState {
  const facets = getSearchFacets(artworks);
  const selected = (key: string, options: string[]) => {
    const value = params.get(key) ?? "";
    return options.includes(value) ? value : "";
  };
  return {
    query: (params.get("q") ?? "").slice(0, MAX_SEARCH_LENGTH),
    filters: {
      artist: selected("artist", facets.artists.map(({ value }) => value)),
      movement: selected("movement", facets.movements),
      mood: selected("mood", facets.moods),
      palette: selected("palette", facets.palettes),
      orientation: selected("orientation", facets.orientations) as SearchFilters["orientation"],
    },
  };
}

export function searchStateToParams({ query, filters }: SearchState) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim().slice(0, MAX_SEARCH_LENGTH));
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params;
}
