import type { Metadata } from "next";
import { ArtworkFeed } from "@/components/feed/ArtworkFeed";
import { DEMO_ARTWORKS } from "@/lib/artworks/demoArtworks";
import { buildTasteProfile, getRecommendationPage, rankArtworks } from "@/lib/recommendations/engine";

export const metadata: Metadata = { title: "Discover", description: "An artwork-first, rights-aware and explainable demo feed for ARTE." };

export default function DiscoverPage() {
  const defaultProfile = buildTasteProfile([], DEMO_ARTWORKS);
  const initialPage = getRecommendationPage(rankArtworks(DEMO_ARTWORKS, defaultProfile), null, 4);

  return (
    <>
      <header className="border-b border-[var(--hairline)] px-6 py-5 md:px-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-text)]">Discover</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display-serif text-4xl font-medium md:text-5xl">Your private museum</h1>
          <p className="max-w-md text-xs leading-6 text-[var(--muted-text)]">Synthetic demo works are clearly labeled. Your explicit actions shape the next refresh, while diversity constraints prevent the feed from collapsing into one artist or movement.</p>
        </div>
      </header>
      <ArtworkFeed initialItems={initialPage.items} initialCursor={initialPage.nextCursor} />
    </>
  );
}
