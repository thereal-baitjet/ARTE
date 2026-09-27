import type { Artwork } from "@/lib/artworks/types";

export function ArtworkMetadata({ artwork }: { artwork: Artwork }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Demo artwork</p>
      <p className="mt-5 text-sm text-[var(--secondary-ink)]">{artwork.artist.name}</p>
      <h2 className="display-serif mt-2 text-4xl font-medium leading-none lg:text-5xl">
        <cite className="not-italic">{artwork.title}</cite>
      </h2>
      <p className="mt-3 text-sm text-[var(--muted-text)]">{artwork.year}</p>
      <dl className="mt-7 space-y-3 border-t border-[var(--hairline)] pt-5 text-sm leading-6">
        <div><dt className="sr-only">Medium</dt><dd>{artwork.medium}</dd></div>
        <div><dt className="sr-only">Dimensions</dt><dd>{artwork.dimensions}</dd></div>
        <div><dt className="sr-only">Movement</dt><dd>{artwork.movement}</dd></div>
      </dl>
      <p className="mt-6 text-sm leading-7 text-[var(--secondary-ink)]">{artwork.description}</p>
      <details className="mt-6 border-t border-[var(--hairline)] pt-4">
        <summary className="focus-ring cursor-pointer text-[11px] uppercase tracking-[0.15em] text-[var(--muted-text)]">Why this?</summary>
        <p className="mt-3 text-xs leading-6 text-[var(--muted-text)]">{artwork.recommendationReason}</p>
      </details>
    </div>
  );
}
