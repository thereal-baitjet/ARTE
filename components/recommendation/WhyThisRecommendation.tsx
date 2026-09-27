"use client";

import type { Artwork } from "@/lib/artworks/types";
import type { RecommendationExplanation } from "@/lib/recommendations/types";
import { recordAnalyticsEvent } from "@/lib/analytics/client";

export function WhyThisRecommendation({ artwork, explanation, position }: { artwork: Artwork; explanation: RecommendationExplanation; position?: number }) {
  return (
    <details
      className="mt-6 border-t border-[var(--hairline)] pt-4"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          recordAnalyticsEvent({
            eventType: "recommendation_explanation_open",
            artwork,
            source: "discover_feed",
            position,
            recommendationReason: explanation.text,
          });
        }
      }}
    >
      <summary className="focus-ring cursor-pointer text-[11px] uppercase tracking-[0.15em] text-[var(--muted-text)]">Why this?</summary>
      <div data-testid="why-this-explanation" className="mt-3">
        <p className="text-xs leading-6 text-[var(--muted-text)]">{explanation.text}</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Recommendation signals">
          {explanation.signals.map((signal) => (
            <li key={`${signal.key}-${signal.feature ?? signal.label}`} className="border border-[var(--hairline)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--muted-text)]">
              {signal.feature ?? signal.label}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
