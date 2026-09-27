export type ArtworkRightsState =
  | "public_domain"
  | "licensed"
  | "owned"
  | "demo"
  | "unclear"
  | "restricted";

export type RightsCandidate = {
  state: ArtworkRightsState;
  sourceUrl?: string | null;
  license?: string | null;
  isSynthetic?: boolean;
};

export function canPublishArtwork(candidate: RightsCandidate): boolean {
  if (!candidate.sourceUrl) return false;
  if (candidate.state === "unclear" || candidate.state === "restricted") return false;
  if (candidate.state === "demo") return candidate.isSynthetic === true;
  return Boolean(candidate.license);
}
