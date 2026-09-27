import Link from "next/link";
import type { Artwork } from "@/lib/artworks/types";
import { ArtworkVisual } from "./ArtworkVisual";

export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  return (
    <article>
      <Link href={`/artwork/${artwork.slug}`} className="focus-ring block">
        <ArtworkVisual artwork={artwork} compact />
        <p className="mt-4 text-xs text-[var(--muted-text)]">{artwork.artist.name}</p>
        <h3 className="display-serif mt-1 text-2xl leading-tight">{artwork.title}</h3>
        <p className="mt-2 text-xs text-[var(--muted-text)]">{artwork.year} · {artwork.medium}</p>
      </Link>
    </article>
  );
}
