export type ArtworkShape = "orb" | "bands" | "frame" | "veil";
export type ArtworkAspect = "portrait" | "landscape" | "square";

type ArtworkVisualBase = {
  aspect: ArtworkAspect;
  aspectRatio: string;
  background: string;
  alt: string;
};

export type ArtworkVisual = ArtworkVisualBase & ({
  kind: "gradient" | "missing";
  accent: string;
  shape: ArtworkShape;
} | {
  kind: "image";
  src: string;
  width: number;
  height: number;
});

export type ArtworkFeatures = {
  palette: string[];
  mood: string[];
  composition: string[];
  subjects: string[];
  mediumCategory: string;
  period: string;
  geography: string;
};

export type Artist = {
  id: string;
  slug: string;
  name: string;
  nationality: string;
  biography: string;
};

export type Artwork = {
  id: string;
  slug: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  movement: string;
  tags: string[];
  features: ArtworkFeatures;
  artist: Artist;
  visual: ArtworkVisual;
  recommendationReason: string;
  isDemo: boolean;
  museum?: { name: string; city: string; country: string; url: string };
  rights: {
    imageSource: string;
    rightsHolder: string;
    license: string;
    usageNotes: string;
    sourceUrl: string;
    imageSourceUrl?: string;
    licenseUrl?: string;
  };
};

export type ArtworkSummary = Pick<Artwork, "id" | "slug" | "title" | "year" | "medium" | "visual"> & {
  artist: Pick<Artist, "id" | "slug" | "name">;
};

export type FeedPage = {
  items: Artwork[];
  nextCursor: string | null;
  validCursor: boolean;
};
