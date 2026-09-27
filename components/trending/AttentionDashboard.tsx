"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { readHiddenArtworkIds, readStoredEvents } from "@/lib/analytics/client";
import { DEMO_ARTWORKS } from "@/lib/artworks/demoArtworks";
import { buildAttentionRanking, mostSavedAttention, type AttentionResult } from "@/lib/trending/attention";

export function AttentionDashboard() {
  const [ranking, setRanking] = useState<AttentionResult[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"attention" | "saved">("attention");
  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const hidden = new Set(readHiddenArtworkIds());
        setRanking(buildAttentionRanking(readStoredEvents(), DEMO_ARTWORKS).filter(({ artwork }) => !hidden.has(artwork.id)));
        setReady(true);
      });
    };
    refresh();
    window.addEventListener("arte:analytics-event", refresh);
    window.addEventListener("arte:analytics-reset", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("arte:analytics-event", refresh);
      window.removeEventListener("arte:analytics-reset", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const visible = mode === "saved" ? mostSavedAttention(ranking) : ranking;
  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-3" aria-label="Attention view">
        <button type="button" aria-pressed={mode === "attention"} onClick={() => setMode("attention")} className="focus-ring min-h-11 border border-[var(--hairline)] px-5 text-xs uppercase tracking-[0.12em] aria-pressed:bg-[var(--primary-ink)] aria-pressed:text-[var(--soft-white)]">Your attention</button>
        <button type="button" aria-pressed={mode === "saved"} onClick={() => setMode("saved")} className="focus-ring min-h-11 border border-[var(--hairline)] px-5 text-xs uppercase tracking-[0.12em] aria-pressed:bg-[var(--primary-ink)] aria-pressed:text-[var(--soft-white)]">Recently saved</button>
      </div>
      {!ready ? <p role="status" className="mt-10 text-sm">Reading your activity…</p> : visible.length ? (
        <div className="mt-8 grid gap-10 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ artwork, score, signals }) => (
            <article key={artwork.id} data-attention-artwork={artwork.id}>
              <ArtworkCard artwork={artwork} />
              <p className="mt-4 text-xs leading-6 text-[var(--muted-text)]">{signals.join(" · ")}</p>
              <p className="text-xs leading-6 text-[var(--muted-text)]">Personal attention score: {score.toFixed(1)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 border border-[var(--hairline)] p-8">
          <h2 className="display-serif text-3xl">{mode === "saved" ? "No recent save activity yet." : "Your attention starts with a work."}</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted-text)]">{mode === "saved" ? "Save a work in Discover to see it here. All saved works remain available in Collections." : "Explore, open a work, or save something you love. This view will reflect those actions."}</p>
          <Link href="/discover" className="focus-ring mt-6 inline-block border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.12em]">Explore the gallery</Link>
        </div>
      )}
      <details className="mt-12 max-w-3xl border-t border-[var(--hairline)] pt-5 text-sm leading-7 text-[var(--muted-text)]">
        <summary className="focus-ring cursor-pointer">How this view is calculated</summary>
        <p className="mt-4">We use available activity from the last 30 days in this browser. Saves, likes, shares, details, related works, and time spent contribute different weights. A signal loses half its weight every seven days. Repeated views and detail opens count once per artwork, session, and day; active likes and saves count once per session. Hidden works stay out of this view.</p>
        <p className="mt-3">This is personal attention, not a platform popularity chart or a measure of artistic quality. Paused or reset history can make this view incomplete.</p>
      </details>
    </div>
  );
}
