/** Display/source metadata only; this module does not import artwork records. */
export type MuseumProvider = {
  id: "met" | "cleveland" | "nga" | "moma";
  name: string;
  shortName: string;
  guideUrl: string;
  policyUrl: string;
  apiUrl: string;
};

export const MUSEUM_PROVIDERS: readonly MuseumProvider[] = [
  { id: "met", name: "The Metropolitan Museum of Art", shortName: "The Met", guideUrl: "/sources/met", policyUrl: "https://www.metmuseum.org/policies/image-resources", apiUrl: "https://metmuseum.github.io/" },
  { id: "cleveland", name: "Cleveland Museum of Art", shortName: "Cleveland Museum of Art", guideUrl: "/sources/cleveland", policyUrl: "https://www.clevelandart.org/open-access", apiUrl: "https://openaccess-api.clevelandart.org/" },
  { id: "nga", name: "National Gallery of Art", shortName: "National Gallery of Art", guideUrl: "/sources/nga", policyUrl: "https://www.nga.gov/artworks/free-images-and-open-access", apiUrl: "https://github.com/NationalGalleryOfArt/opendata" },
  { id: "moma", name: "The Museum of Modern Art", shortName: "MoMA", guideUrl: "/sources/moma", policyUrl: "https://www.moma.org/collection/about/licensing", apiUrl: "https://github.com/MuseumofModernArt/collection" },
];

export function museumProviderForSourceUrl(sourceUrl: string): MuseumProvider | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (["metmuseum.org", "www.metmuseum.org", "collectionapi.metmuseum.org"].includes(host)) return MUSEUM_PROVIDERS[0];
    if (["clevelandart.org", "www.clevelandart.org", "openaccess-api.clevelandart.org"].includes(host)) return MUSEUM_PROVIDERS[1];
    if (["nga.gov", "www.nga.gov"].includes(host)) return MUSEUM_PROVIDERS[2];
    if (["moma.org", "www.moma.org"].includes(host)) return MUSEUM_PROVIDERS[3];
  } catch { /* Synthetic sources are local routes, not museum providers. */ }
  return null;
}

export function museumSourceLabel(sourceUrl: string, museumName?: string) {
  const provider = museumProviderForSourceUrl(sourceUrl);
  return `${provider?.shortName ?? museumName ?? "Museum collection"} · ${provider?.id === "moma" ? "Public-domain image" : "Open Access"}`;
}
