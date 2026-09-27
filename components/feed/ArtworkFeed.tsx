"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hideArtworkLocally, readHiddenArtworkIds, readStoredEvents, recordAnalyticsEvent, restoreHiddenArtworkHistory } from "@/lib/analytics/client";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import type { RecommendationPage, RecommendedArtwork } from "@/lib/recommendations/types";
import { ArtworkSlide } from "@/components/artwork/ArtworkSlide";

const SCROLL_KEY = "arte:discover:scrollY";

type ApiPage = RecommendationPage & { profileEventCount?: number };

async function requestPage(events: AnalyticsEvent[], hiddenArtworkIds: string[], cursor: string | null): Promise<ApiPage> {
  const response = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events, hiddenArtworkIds, cursor, limit: 4 }),
  });
  if (!response.ok) throw new Error("Recommendation request failed");
  return response.json() as Promise<ApiPage>;
}

export function ArtworkFeed({ initialItems, initialCursor }: { initialItems: RecommendedArtwork[]; initialCursor: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<AnalyticsEvent[]>([]);
  const hiddenRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      eventsRef.current = readStoredEvents();
      hiddenRef.current = readHiddenArtworkIds();
      void requestPage(eventsRef.current, hiddenRef.current, null)
        .then((page) => {
          if (cancelled) return;
          setItems(page.items);
          setCursor(page.nextCursor);
          recordAnalyticsEvent({ eventType: "feed_refresh", source: "discover_feed", payload: { profileEventCount: page.profileEventCount ?? 0 } });
        })
        .catch(() => {
          if (!cancelled) setError("Personalization is temporarily unavailable. The default gallery remains available.");
        });
    });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) ?? "0");
    const restoreFrame = window.requestAnimationFrame(() => {
      if (Number.isFinite(saved) && saved > 0) window.scrollTo({ top: saved, behavior: "auto" });
    });
    let frame = 0;
    const remember = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); frame = 0; });
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remember);
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await requestPage(eventsRef.current, hiddenRef.current, cursor);
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [...current, ...page.items.filter(({ id }) => !known.has(id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError("The next gallery room could not be loaded.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadMore(); }, { rootMargin: "500px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      const slides = Array.from(document.querySelectorAll<HTMLElement>("[data-artwork-id]"));
      if (!slides.length) return;
      const center = window.innerHeight / 2;
      const activeIndex = slides.reduce((best, slide, index) => {
        const rect = slide.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
      const active = slides[activeIndex];
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        slides[Math.max(0, Math.min(slides.length - 1, activeIndex + direction))]?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (event.key.toLowerCase() === "l") active.querySelector<HTMLButtonElement>('[data-action="like"]')?.click();
      else if (event.key.toLowerCase() === "s") active.querySelector<HTMLButtonElement>('[data-action="save"]')?.click();
      else if (event.key.toLowerCase() === "i") { const slug = active.dataset.artworkSlug; if (slug) router.push(`/artwork/${slug}`); }
      else if (event.key.toLowerCase() === "m") { const slug = active.dataset.artworkSlug; if (slug) router.push(`/artwork/${slug}#related`); }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [router]);

  function hideArtwork(artwork: RecommendedArtwork) {
    hideArtworkLocally(artwork.id);
    hiddenRef.current = [...new Set([...hiddenRef.current, artwork.id])];
    setItems((current) => current.filter(({ id }) => id !== artwork.id));
  }

  if (!items.length && !cursor) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="display-serif text-4xl">Your current gallery is empty.</p>
        <button type="button" onClick={() => { restoreHiddenArtworkHistory(); window.location.reload(); }} className="focus-ring mt-7 border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.14em]">Restore hidden works</button>
      </section>
    );
  }

  return (
    <div className="snap-y snap-proximity" data-feed-count={items.length}>
      {items.map((artwork, index) => <ArtworkSlide key={artwork.id} artwork={artwork} position={index} onHide={() => hideArtwork(artwork)} />)}
      <div ref={sentinelRef} data-feed-sentinel className="flex min-h-28 items-center justify-center px-6 py-10 text-center">
        {loading ? <p role="status" className="text-xs uppercase tracking-[0.15em] text-[var(--muted-text)]">Preparing the next room…</p> : null}
        {error ? <div><p className="text-sm text-[var(--muted-text)]">{error}</p>{cursor ? <button type="button" onClick={() => void loadMore()} className="focus-ring mt-4 border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.12em]">Try again</button> : null}</div> : null}
        {!cursor && !loading && !error ? <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted-text)]">End of the current demo collection</p> : null}
      </div>
    </div>
  );
}
