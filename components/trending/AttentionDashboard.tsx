"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { readHiddenArtworkIds, readStoredEvents, retryAccountActivity, useActivitySnapshot } from "@/lib/analytics/client";
import { useAuth } from "@/lib/auth/session";
import type { ArtworkSummary } from "@/lib/artworks/types";
import type { AttentionResult } from "@/lib/trending/attention";

type AttentionCard = Omit<AttentionResult, "artwork"> & { artwork: ArtworkSummary };

export function AttentionDashboard() {
  const auth = useAuth();
  return <AttentionDashboardView key={auth.revision} />;
}

function AttentionDashboardView() {
  const auth = useAuth();
  const activity = useActivitySnapshot();
  const [ranking, setRanking] = useState<AttentionCard[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"attention" | "saved">("attention");
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let controller: AbortController | null = null;
    let version = 0;
    const refresh = async () => {
      const current = ++version;
      controller?.abort();
      controller = new AbortController();
      setError("");
      setReady(false);
      setRanking([]); setTotal(0);
      if (activity.status !== "ready" || !activity.scope) return;
      try {
        const response = await fetch("/api/attention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: readStoredEvents(), hiddenArtworkIds: readHiddenArtworkIds(), mode }), signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Your attention view is temporarily unavailable. Your activity has not changed.");
        const result = await response.json() as { items: AttentionCard[]; total: number };
        if (current === version) { setRanking(result.items); setTotal(result.total); setReady(true); }
      } catch (cause) {
        if (current === version && !(cause instanceof Error && cause.name === "AbortError")) { setError(cause instanceof Error ? cause.message : "Could not read your activity."); setReady(true); }
      }
    };
    const notify = () => { void refresh(); };
    notify();
    window.addEventListener("arte:analytics-event", notify);
    window.addEventListener("arte:analytics-reset", notify);
    window.addEventListener("storage", notify);
    return () => {
      version++; controller?.abort();
      window.removeEventListener("arte:analytics-event", notify);
      window.removeEventListener("arte:analytics-reset", notify);
      window.removeEventListener("storage", notify);
    };
  }, [mode, attempt, activity.scope, activity.status]);
  const visible = ranking;
  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-3" aria-label="Attention view">
        <button type="button" aria-pressed={mode === "attention"} onClick={() => setMode("attention")} className="focus-ring min-h-11 border border-[var(--hairline)] px-5 text-xs uppercase tracking-[0.12em] aria-pressed:bg-[var(--primary-ink)] aria-pressed:text-[var(--soft-white)]">Your attention</button>
        <button type="button" aria-pressed={mode === "saved"} onClick={() => setMode("saved")} className="focus-ring min-h-11 border border-[var(--hairline)] px-5 text-xs uppercase tracking-[0.12em] aria-pressed:bg-[var(--primary-ink)] aria-pressed:text-[var(--soft-white)]">Recently saved</button>
      </div>
      {activity.status === "error" ? <div role="alert" className="mt-8 text-sm"><p>{activity.error}</p><button type="button" onClick={() => void retryAccountActivity()} className="focus-ring min-h-11 underline">Retry account activity</button></div> : null}
      {error ? <div role="alert" className="mt-8 text-sm"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="focus-ring min-h-11 underline">Retry attention view</button></div> : null}
      {ready && total > visible.length ? <p className="mt-5 text-xs text-[var(--muted-text)]">Showing your strongest {visible.length} connections from {total} works with activity.</p> : null}
      {activity.status === "error" ? null : !ready ? <p role="status" className="mt-10 text-sm">Reading your activity…</p> : visible.length ? (
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
        <p className="mt-4">We use up to 500 recent signals from the last 30 days {auth.status === "authenticated" ? "from your account activity and saved preferences" : "in this browser"}. A limited copy is sent to ARTE to calculate this view and is not saved by this calculation. Guest activity is not written to an account database. Saves, likes, shares, details, related works, and time spent contribute different weights. A signal loses half its weight every seven days. Repeated views and detail opens count once per artwork, session, and day; active likes and saves count once {auth.status === "authenticated" ? "per account" : "per session"}. Hidden works stay out of this view.</p>
        <p className="mt-3">This is personal attention, not a platform popularity chart or a measure of artistic quality. Paused or reset history can make this view incomplete.</p>
      </details>
    </div>
  );
}
