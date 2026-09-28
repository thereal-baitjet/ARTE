import type { Artwork, ArtworkSummary } from "../artworks/types.ts";
import { artworkSummary } from "../artworks/summary.ts";
import { findSimilarArtworks } from "./similarity.ts";
import type { SimilarityMode, SimilarityResult } from "./types.ts";

type RelatedArtwork = {
  artwork: ArtworkSummary;
  connection: SimilarityResult["connection"];
};

export type RelatedArtworkGroups = Record<SimilarityMode, RelatedArtwork[]>;

function cardResults(results: SimilarityResult[]): RelatedArtwork[] {
  return results.map(({ artwork, connection }) => ({
    artwork: artworkSummary(artwork),
    connection,
  }));
}

/** Only these bounded result sets cross the artwork page's server/client boundary. */
export function getRelatedArtworkGroups(source: Artwork, candidates: Artwork[]): RelatedArtworkGroups {
  const publicCandidates = candidates.filter((artwork) => !artwork.isDemo);
  return {
    visual: cardResults(findSimilarArtworks(source, publicCandidates, "visual", 4)),
    mood: cardResults(findSimilarArtworks(source, publicCandidates, "mood", 4)),
    movement: cardResults(findSimilarArtworks(source, publicCandidates, "movement", 4)),
    palette: cardResults(findSimilarArtworks(source, publicCandidates, "palette", 4)),
    unexpected: cardResults(findSimilarArtworks(source, publicCandidates, "unexpected", 4)),
  };
}
