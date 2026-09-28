import type { Artwork } from "../artworks/types.ts";

/** A bounded, reproducible sample favors new artists, source categories, and media. */
export function chooseOnboardingWorks(artworks: Artwork[], limit = 20): Artwork[] {
  const remaining = artworks.filter((artwork) => !artwork.isDemo && artwork.visual.kind === "image");
  const artists = new Set<string>();
  const categories = new Set<string>();
  const media = new Set<string>();
  const chosen: Artwork[] = [];
  const maximum = Math.max(0, Math.min(20, limit));
  while (remaining.length && chosen.length < maximum) {
    let best = 0;
    let bestScore = -1;
    remaining.forEach((artwork, index) => {
      const score = Number(!artists.has(artwork.artist.id)) * 100 + Number(!categories.has(artwork.movement)) * 30 + Number(!media.has(artwork.features.mediumCategory)) * 15;
      if (score > bestScore) { best = index; bestScore = score; }
    });
    const [artwork] = remaining.splice(best, 1);
    artists.add(artwork.artist.id); categories.add(artwork.movement); media.add(artwork.features.mediumCategory); chosen.push(artwork);
  }
  return chosen;
}
