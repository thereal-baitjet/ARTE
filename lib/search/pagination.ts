import { createHash } from "node:crypto";
import type { Artwork } from "../artworks/types.ts";
import { searchArtworks } from "./engine.ts";
import { DEFAULT_SEARCH_PAGE_SIZE, MAX_SEARCH_PAGE_SIZE, searchStateToParams, type SearchPageResponse, type SearchState } from "./state.ts";

export class SearchRequestError extends Error {}

export function parseSearchLimit(value: string | null) {
  if (value === null) return DEFAULT_SEARCH_PAGE_SIZE;
  if (!/^\d{1,6}$/.test(value) || Number(value) < 1) throw new SearchRequestError("Invalid search page size.");
  return Math.min(Number(value), MAX_SEARCH_PAGE_SIZE);
}

export function getSearchPage(artworks: Artwork[], state: SearchState, cursor: string | null = null, requestedLimit = DEFAULT_SEARCH_PAGE_SIZE): SearchPageResponse {
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new SearchRequestError("Invalid search page size.");
  const pageSize = Math.min(requestedLimit, MAX_SEARCH_PAGE_SIZE);
  // The server enforces this boundary even if a caller accidentally supplies fixtures.
  const publicArtworks = artworks.filter(({ isDemo }) => !isDemo);
  const fingerprint = createHash("sha256").update(searchStateToParams(state).toString()).update(`|${pageSize}|`).update(publicArtworks.map(({ id }) => id).join(",")).digest("hex").slice(0, 16);
  const ranked = searchArtworks(publicArtworks, state.query, state.filters);
  let offset = 0;
  if (cursor) {
    const match = /^s1\.([a-f0-9]{16})\.(\d{1,7})$/.exec(cursor);
    if (!match || match[1] !== fingerprint) throw new SearchRequestError("This search page is no longer valid. Start the search again.");
    offset = Number(match[2]);
    if (offset < 1 || offset >= ranked.length || offset % pageSize !== 0) throw new SearchRequestError("Invalid search cursor.");
  }
  const results = ranked.slice(offset, offset + pageSize).map(({ artwork, score, matches, corrections }) => ({
    artwork: {
      id: artwork.id, slug: artwork.slug, title: artwork.title, year: artwork.year, medium: artwork.medium,
      artist: { id: artwork.artist.id, slug: artwork.artist.slug, name: artwork.artist.name },
      visual: artwork.visual, museumName: artwork.museum?.name ?? null,
    },
    score,
    matches: matches.slice(0, 3).map(({ label, value }) => ({ label, value: value.length > 240 ? `${value.slice(0, 237)}…` : value })),
    corrections,
  }));
  return {
    state, results, total: ranked.length, catalogTotal: publicArtworks.length, pageSize,
    nextCursor: offset + pageSize < ranked.length ? `s1.${fingerprint}.${offset + pageSize}` : null,
  };
}
