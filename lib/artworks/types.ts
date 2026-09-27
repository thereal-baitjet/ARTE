export type ArtworkShape = "orb" | "bands" | "frame" | "veil";
export type ArtworkAspect = "portrait" | "landscape" | "square";

export type ArtworkVisual = {
  kind: "gradient" | "missing";
  aspect: ArtworkAspect;
  aspectRatio: string;
  background: string;
  accent: string;
  shape: ArtworkShape;
  alt: string;
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
  artist: Artist;
  visual: ArtworkVisual;
  recommendationReason: string;
  isDemo: true;
  rights: {
    imageSource: string;
    rightsHolder: string;
    license: string;
    usageNotes: string;
    sourceUrl: string;
  };
};

export type FeedPage = {
  items: Artwork[];
  nextCursor: string | null;
  validCursor: boolean;
};
