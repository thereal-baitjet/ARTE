"use client";

import { useEffect, useRef } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { RecommendedArtwork } from "@/lib/recommendations/types";
import { ArtworkActions } from "./ArtworkActions";
import { ArtworkMetadata } from "./ArtworkMetadata";
import { ArtworkVisual } from "./ArtworkVisual";

export function ArtworkSlide({ artwork, onHide, position }: { artwork: RecommendedArtwork; onHide: () => void; position: number }) {
  const visualRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    let visibleSince: number | null = null;
    let impressionRecorded = false;
    let meaningfullyVisible = false;
    let observer: IntersectionObserver | null = null;

    const finishDwell = () => {
      if (visibleSince === null) return;
      const durationMs = Math.round(performance.now() - visibleSince);
      visibleSince = null;
      if (durationMs >= 250) {
        recordAnalyticsEvent({ eventType: "artwork_dwell", artwork, source: "discover_feed", position, recommendationReason: artwork.recommendation.explanation.text, payload: { durationMs } });
      }
    };

    const updateVisibility = () => {
      if (meaningfullyVisible && document.visibilityState === "visible") {
        if (!impressionRecorded) {
          impressionRecorded = true;
          recordAnalyticsEvent({ eventType: "artwork_impression", artwork, source: "discover_feed", position, recommendationReason: artwork.recommendation.explanation.text });
          recordAnalyticsEvent({ eventType: "artwork_visible", artwork, source: "discover_feed", position, recommendationReason: artwork.recommendation.explanation.text });
        }
        if (visibleSince === null) visibleSince = performance.now();
      } else {
        finishDwell();
      }
    };

    const observeVisual = () => {
      finishDwell();
      observer?.disconnect();
      meaningfullyVisible = false;
      const bounds = visual.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const navigationHeight = window.innerWidth < 1024 ? 88 : 0;
      const availableHeight = Math.max(1, window.innerHeight - navigationHeight);
      // Tall works need to occupy 60% of the available viewport, not 60% of an
      // article whose metadata can extend far beyond a small mobile screen.
      const visibleArea = Math.min(bounds.width, window.innerWidth) * Math.min(bounds.height, availableHeight);
      const threshold = Math.min(0.6, 0.6 * visibleArea / (bounds.width * bounds.height));
      observer = new IntersectionObserver(([entry]) => {
        meaningfullyVisible = entry.isIntersecting && entry.intersectionRatio >= threshold;
        updateVisibility();
      }, { threshold: [0, threshold, 1], rootMargin: `0px 0px -${navigationHeight}px 0px` });
      observer.observe(visual);
    };

    const resizeObserver = new ResizeObserver(observeVisual);
    resizeObserver.observe(visual);
    observeVisual();
    window.addEventListener("resize", observeVisual, { passive: true });
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("pagehide", finishDwell);
    return () => {
      finishDwell();
      observer?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", observeVisual);
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("pagehide", finishDwell);
    };
  }, [artwork, position]);

  return (
    <article
      id={`artwork-${artwork.slug}`}
      data-artwork-id={artwork.id}
      data-artwork-slug={artwork.slug}
      data-recommendation-signals={artwork.recommendation.explanation.signals.map((signal) => signal.key).join(",")}
      className="grid min-h-[calc(100svh-5rem)] snap-start border-b border-[var(--hairline)] bg-[var(--gallery-ivory)] lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div ref={visualRef} data-artwork-observation className="flex items-center justify-center px-4 py-8 md:px-10 lg:px-14"><ArtworkVisual artwork={artwork} /></div>
      <aside className="border-t border-[var(--hairline)] px-6 py-8 lg:flex lg:flex-col lg:justify-center lg:border-l lg:border-t-0 lg:px-7">
        <ArtworkMetadata artwork={artwork} position={position} />
        <ArtworkActions artwork={artwork} onHide={onHide} position={position} />
      </aside>
    </article>
  );
}
