import type { Artist, Artwork } from "./types.ts";
import { MET_ARTWORKS } from "./metArtworks.ts";
import { CLEVELAND_ARTWORKS } from "./clevelandArtworks.ts";
import { NGA_ARTWORKS } from "./ngaArtworks.ts";
import { MOMA_ARTWORKS } from "./momaArtworks.ts";

// Import from server components, routes, and offline tooling only.
// Client components receive bounded results, never the complete catalog.
// Interleave sources so a new museum is visible at the start of discovery.
const museumCatalogs = [MET_ARTWORKS, CLEVELAND_ARTWORKS, NGA_ARTWORKS, MOMA_ARTWORKS];
export const PUBLIC_ARTWORKS: Artwork[] = Array.from(
  { length: Math.max(...museumCatalogs.map((catalog) => catalog.length)) },
  (_, index) => museumCatalogs.flatMap((catalog) => catalog[index] ? [catalog[index]] : []),
).flat().filter((artwork) => !artwork.isDemo && artwork.visual.kind === "image");
export const PUBLIC_ARTISTS: Artist[] = [...new Map(PUBLIC_ARTWORKS.map(({ artist }) => [artist.id, artist])).values()];
