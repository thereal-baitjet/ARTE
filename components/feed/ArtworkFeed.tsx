"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hideArtworkLocally, readHiddenArtworkIds, readStoredEvents, recordAnalyticsEvent, restoreHiddenArtworkHistory } from "@/lib/analytics/client";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import type { RecommendationPage, RecommendedArtwork } from "@/lib/recommendations/types";
import { ArtworkSlide } from "@/components/artwork/ArtworkSlide";

const SCROLL_KEY = "arte:discover:scrollY";
const NEXT_ROOM_SIZE = 2;
const AUTOLOAD_COOLDOWN_MS = 1_200;
const END_PROXIMITY_PX = 150;

type ApiPage = RecommendationPage & { profileEventCount?: number };

async function requestPage(events: AnalyticsEvent[], hiddenArtworkIds: string[], cursor: string | null, limit = 4): Promise<ApiPage> {
  const response = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events, hiddenArtworkIds, cursor, limit }),
  });
  if (!response.ok) throw new Error("Recommendation request failed");
  return response.json() as Promise<ApiPage>;
}

export function ArtworkFeed({ initialItems, initialCursor }: { initialItems: RecommendedArtwork[]; initialCursor: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(true);
  const generationRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<AnalyticsEvent[]>([]);
  const hiddenRef = useRef<string[]>([]);
  const automaticRef = useRef({ checkpointY: 0, lastScrollY: 0, mustLeaveEnd: false, nextAllowedAt: 0 });

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const refresh = () => {
      loadingRef.current = true;
      const generation = ++generationRef.current;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setHydrated(false);
        setLoading(false);
        setError(null);
        eventsRef.current = readStoredEvents();
        hiddenRef.current = readHiddenArtworkIds();
        const hidden = new Set(hiddenRef.current);
        setItems((current) => current.filter(({ id }) => !hidden.has(id)));
        void requestPage(eventsRef.current, hiddenRef.current, null)
          .then((page) => {
            if (cancelled || generation !== generationRef.current) return;
            const latestHidden = new Set(readHiddenArtworkIds());
            setItems(page.items.filter(({ id }) => !latestHidden.has(id)));
            setCursor(page.nextCursor);
            recordAnalyticsEvent({ eventType: "feed_refresh", source: "discover_feed", payload: { profileEventCount: page.profileEventCount ?? 0 } });
          })
          .catch(() => {
            if (cancelled || generation !== generationRef.current) return;
            // Keep fallback pagination aligned with the server-rendered ranking.
            eventsRef.current = [];
            hiddenRef.current = [];
            const latestHidden = new Set(readHiddenArtworkIds());
            setItems(initialItems.filter(({ id }) => !latestHidden.has(id)));
            setCursor(initialCursor);
            setError("Personalization is temporarily unavailable. The default gallery remains available.");
          })
          .finally(() => {
            if (cancelled || generation !== generationRef.current) return;
            // Restoring the previous position or refreshing preferences is not
            // permission to page through the gallery without another scroll.
            automaticRef.current = { checkpointY: window.scrollY, lastScrollY: window.scrollY, mustLeaveEnd: false, nextAllowedAt: 0 };
            loadingRef.current = false;
            setHydrated(true);
          });
      });
    };
    refresh();
    window.addEventListener("arte:analytics-reset", refresh);
    return () => {
      cancelled = true;
      generationRef.current += 1;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("arte:analytics-reset", refresh);
    };
  }, [initialItems, initialCursor]);

  useEffect(() => {
    // Disable anchoring on the actual page scroller while this feed is mounted.
    // Excluding only the feed still lets the browser anchor its changing shell
    // and jump past newly inserted works to keep the end button in view.
    const scroller = document.documentElement;
    const previousAnchor = scroller.style.overflowAnchor;
    scroller.style.overflowAnchor = "none";
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
      scroller.style.overflowAnchor = previousAnchor;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    automaticRef.current.mustLeaveEnd = true;
    const generation = generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await requestPage(eventsRef.current, hiddenRef.current, cursor, NEXT_ROOM_SIZE);
      if (generation !== generationRef.current) return;
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        const hidden = new Set(readHiddenArtworkIds());
        return [...current, ...page.items.filter(({ id }) => !known.has(id) && !hidden.has(id))];
      });
      setCursor(page.nextCursor);
    } catch {
      if (generation === generationRef.current) setError("The next gallery room could not be loaded.");
    } finally {
      if (generation === generationRef.current) {
        automaticRef.current.checkpointY = window.scrollY;
        automaticRef.current.lastScrollY = window.scrollY;
        automaticRef.current.nextAllowedAt = performance.now() + AUTOLOAD_COOLDOWN_MS;
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [cursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor || !hydrated) return;
    let nearEnd = false;
    let timer = 0;
    const tryAutomaticLoad = () => {
      const automatic = automaticRef.current;
      const minimumProgress = Math.max(160, Math.min(480, window.innerHeight / 2));
      if (!nearEnd || loadingRef.current || error || automatic.mustLeaveEnd ||
        automatic.lastScrollY - automatic.checkpointY < minimumProgress ||
        window.scrollY - automatic.checkpointY < minimumProgress) return;
      const remaining = automatic.nextAllowedAt - performance.now();
      if (remaining > 0) {
        window.clearTimeout(timer);
        timer = window.setTimeout(tryAutomaticLoad, remaining);
        return;
      }
      void loadMore();
    };
    const onScroll = () => {
      if (loadingRef.current) return;
      automaticRef.current.lastScrollY = window.scrollY;
      tryAutomaticLoad();
    };
    const observer = new IntersectionObserver(([entry]) => {
      nearEnd = entry.isIntersecting;
      if (!nearEnd) {
        automaticRef.current.mustLeaveEnd = false;
        window.clearTimeout(timer);
      }
      tryAutomaticLoad();
    }, { rootMargin: `0px 0px ${END_PROXIMITY_PX}px 0px` });
    observer.observe(sentinel);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [cursor, loadMore, hydrated, error]);

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
    // Pagination must retain its initial ranking snapshot. A newly hidden cursor
    // would otherwise disappear from the API ranking and strand the next page.
    // Local filtering suppresses hides immediately; the next refresh re-ranks.
    setItems((current) => current.filter(({ id }) => id !== artwork.id));
  }

  if (hydrated && !items.length && !cursor) {
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
        {error ? <div><p role="alert" className="text-sm text-[var(--muted-text)]">{error}</p>{cursor ? <button type="button" onClick={() => void loadMore()} disabled={loading || !hydrated} className="focus-ring mt-4 border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.12em]">Try again</button> : null}</div> : null}
        {cursor && !error && !loading ? <button type="button" onClick={() => void loadMore()} disabled={!hydrated} className="focus-ring border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.12em] disabled:opacity-50">Load more works</button> : null}
        {!cursor && !loading && !error ? <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted-text)]">End of the current collection</p> : null}
      </div>
    </div>
  );
}
