"use client";

import { useMemo, useState } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artwork } from "@/lib/artworks/types";
import { findSimilarArtworks } from "@/lib/recommendations/similarity";
import type { SimilarityMode } from "@/lib/recommendations/types";

const modes: Array<{ value: SimilarityMode; label: string }> = [
  { value: "visual", label: "Visually Similar" },
  { value: "mood", label: "Similar Mood" },
  { value: "movement", label: "Similar Movement" },
  { value: "palette", label: "Similar Palette" },
  { value: "unexpected", label: "Unexpected Connection" },
];

export function MoreLikeThisPanel({ source, candidates }: { source: Artwork; candidates: Artwork[] }) {
  const [mode, setMode] = useState<SimilarityMode>("visual");
  const results = useMemo(() => findSimilarArtworks(source, candidates, mode), [candidates, mode, source]);

  function selectMode(nextMode: SimilarityMode) {
    setMode(nextMode);
    recordAnalyticsEvent({
      eventType: "more_like_this_open",
      artwork: source,
      source: "artwork_detail",
      payload: { mode: nextMode },
    });
  }

  return (
    <section id="related" className="mt-20 border-t border-[var(--hairline)] pt-10">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-text)]">More like this</p>
      <div className="mt-3 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="display-serif text-4xl">Continue the connection</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-text)]">Choose the kind of relationship you want to explore. Every connection below names the metadata signal it actually uses.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Similarity mode">
          {modes.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => selectMode(option.value)}
              className="focus-ring min-h-11 border px-3 text-[10px] uppercase tracking-[0.1em] aria-pressed:border-[var(--primary-ink)] aria-pressed:bg-[var(--primary-ink)] aria-pressed:text-[var(--soft-white)]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-9 grid gap-9 md:grid-cols-2 xl:grid-cols-4">
        {results.map((result) => (
          <div key={result.artwork.id} data-testid="similarity-result">
            <ArtworkCard artwork={result.artwork} />
            <p className="mt-4 border-l border-[var(--antique-gold)] pl-4 text-xs leading-6 text-[var(--muted-text)]">{result.connection.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
