import type { Artwork } from "@/lib/artworks/types";
import { ArtworkActions } from "./ArtworkActions";
import { ArtworkMetadata } from "./ArtworkMetadata";
import { ArtworkVisual } from "./ArtworkVisual";

export function ArtworkSlide({ artwork, onHide }: { artwork: Artwork; onHide: () => void }) {
  return (
    <article
      id={`artwork-${artwork.slug}`}
      data-artwork-id={artwork.id}
      data-artwork-slug={artwork.slug}
      className="grid min-h-[calc(100svh-5rem)] snap-start border-b border-[var(--hairline)] bg-[var(--gallery-ivory)] lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex items-center justify-center px-4 py-8 md:px-10 lg:px-14">
        <ArtworkVisual artwork={artwork} />
      </div>
      <aside className="border-t border-[var(--hairline)] px-6 py-8 lg:flex lg:flex-col lg:justify-center lg:border-l lg:border-t-0 lg:px-7">
        <ArtworkMetadata artwork={artwork} />
        <ArtworkActions artwork={artwork} onHide={onHide} />
      </aside>
    </article>
  );
}
