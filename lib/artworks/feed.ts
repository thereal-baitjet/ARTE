import { DEMO_ARTISTS, DEMO_ARTWORKS } from "./demoArtworks";
import type { Artwork, FeedPage } from "./types";

const DEFAULT_PAGE_SIZE = 4;
const MAX_PAGE_SIZE = 8;

export function getDemoFeedPage(cursor?: string | null, requestedLimit = DEFAULT_PAGE_SIZE): FeedPage {
  const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit));
  let start = 0;
  if (cursor) {
    const cursorIndex = DEMO_ARTWORKS.findIndex((artwork) => artwork.slug === cursor);
    if (cursorIndex < 0) return { items: [], nextCursor: null, validCursor: false };
    start = cursorIndex + 1;
  }
  const items = DEMO_ARTWORKS.slice(start, start + limit);
  const end = start + items.length;
  const nextCursor = end < DEMO_ARTWORKS.length ? items.at(-1)?.slug ?? null : null;
  return { items, nextCursor, validCursor: true };
}

export function getArtworkBySlug(slug: string): Artwork | undefined { return DEMO_ARTWORKS.find((artwork) => artwork.slug === slug); }
export function getArtistBySlug(slug: string) { return DEMO_ARTISTS.find((artist) => artist.slug === slug); }
export function getArtworksByArtist(slug: string): Artwork[] { return DEMO_ARTWORKS.filter((artwork) => artwork.artist.slug === slug); }
export function getArtworkCatalog(): Artwork[] { return [...DEMO_ARTWORKS]; }
export function getRelatedArtworks(artwork: Artwork, limit = 4): Artwork[] {
  return DEMO_ARTWORKS.filter((candidate) => candidate.id !== artwork.id).slice(0, limit);
}
export function getAllArtworkSlugs() { return DEMO_ARTWORKS.map(({ slug }) => ({ slug })); }
export function getAllArtistSlugs() { return DEMO_ARTISTS.map(({ slug }) => ({ slug })); }
