import type { Artwork, ArtworkSummary } from "./types.ts";

/** Public card payload: deliberately excludes descriptions, features, rights metadata and biographies. */
export function artworkSummary(artwork: Artwork): ArtworkSummary {
  const { id, slug, title, year, medium, visual } = artwork;
  return { id, slug, title, year, medium, visual, artist: { id: artwork.artist.id, slug: artwork.artist.slug, name: artwork.artist.name } };
}
