import type { Artwork, ArtworkAspect } from "../artworks/types.ts";

export const MAX_SEARCH_LENGTH = 160;
export const DEFAULT_SEARCH_PAGE_SIZE = 12;
export const MAX_SEARCH_PAGE_SIZE = 24;

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
export type SearchFacets = {
  artists: Array<{ value: string; label: string }>;
  movements: string[];
  moods: string[];
  palettes: string[];
  orientations: ArtworkAspect[];
};

export type SearchArtworkSummary = Pick<Artwork, "id" | "slug" | "title" | "year" | "medium" | "visual"> & {
  artist: Pick<Artwork["artist"], "id" | "slug" | "name">;
  museumName: string | null;
};

export type SearchResultSummary = {
  artwork: SearchArtworkSummary;
  score: number;
  matches: SearchMatch[];
  corrections: Array<{ from: string; to: string }>;
};

export type SearchPageResponse = {
  state: SearchState;
  results: SearchResultSummary[];
  total: number;
  catalogTotal: number;
  nextCursor: string | null;
  pageSize: number;
};

export function parseSearchStateFromFacets(params: URLSearchParams, facets: SearchFacets): SearchState {
  const selected = (key: string, options: string[]) => {
    const value = params.get(key) ?? "";
    return options.includes(value) ? value : "";
  };
  return {
    query: (params.get("q") ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
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
