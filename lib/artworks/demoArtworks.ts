import type { Artist, Artwork } from "./types.ts";
import { SYNTHETIC_ARTWORKS } from "./syntheticArtworks.ts";
import { PUBLIC_ARTWORKS } from "./publicCatalog.ts";

export { SYNTHETIC_ARTWORKS } from "./syntheticArtworks.ts";
// Legacy lookup catalog preserves existing saved artwork IDs and demo-only flows.
export const DEMO_ARTWORKS: Artwork[] = [...SYNTHETIC_ARTWORKS, ...PUBLIC_ARTWORKS];
export const GALLERY_ARTWORKS = PUBLIC_ARTWORKS;
export const DEMO_ARTISTS: Artist[] = [...new Map(DEMO_ARTWORKS.map(({ artist }) => [artist.id, artist])).values()];
