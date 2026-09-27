"use client";

import { useEffect, useRef } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { RecommendedArtwork } from "@/lib/recommendations/types";
import { ArtworkActions } from "./ArtworkActions";
import { ArtworkMetadata } from "./ArtworkMetadata";
import { ArtworkVisual } from "./ArtworkVisual";

export function ArtworkSlide({ artwork, onHide, position }: { artwork: RecommendedArtwork; onHide: () => void; position: number }) {
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    let visibleSince: number | null = null;
    let impressionRecorded = false;

    const finishDwell = () => {
      if (visibleSince === null) return;
      const durationMs = Math.round(performance.now() - visibleSince);
      visibleSince = null;
      if (durationMs >= 250) {
        recordAnalyticsEvent({ eventType: "artwork_dwell", artwork, source: "discover_feed", position, recommendationReason: artwork.recommendation.explanation.text, payload: { durationMs } });
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      const meaningfullyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      if (meaningfullyVisible) {
        if (!impressionRecorded) {
          impressionRecorded = true;
          recordAnalyticsEvent({ eventType: "artwork_impression", artwork, source: "discover_feed", position, recommendationReason: artwork.recommendation.explanation.text });
          recordAnalyticsEvent({ eventType: "artwork_visible", artwork, source: "discover_feed", position, recommendationReason: artwork.recommendation.explanation.text });
        }
        if (visibleSince === null) visibleSince = performance.now();
      } else {
        finishDwell();
      }
    }, { threshold: [0, 0.6, 1] });

    observer.observe(article);
    return () => { finishDwell(); observer.disconnect(); };
  }, [artwork, position]);

  return (
    <article
      ref={articleRef}
      id={`artwork-${artwork.slug}`}
      data-artwork-id={artwork.id}
      data-artwork-slug={artwork.slug}
      data-recommendation-signals={artwork.recommendation.explanation.signals.map((signal) => signal.key).join(",")}
      className="grid min-h-[calc(100svh-5rem)] snap-start border-b border-[var(--hairline)] bg-[var(--gallery-ivory)] lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex items-center justify-center px-4 py-8 md:px-10 lg:px-14"><ArtworkVisual artwork={artwork} /></div>
      <aside className="border-t border-[var(--hairline)] px-6 py-8 lg:flex lg:flex-col lg:justify-center lg:border-l lg:border-t-0 lg:px-7">
        <ArtworkMetadata artwork={artwork} position={position} />
        <ArtworkActions artwork={artwork} onHide={onHide} position={position} />
      </aside>
    </article>
  );
}
