import type { Metadata } from "next";
import { ArtworkFeed } from "@/components/feed/ArtworkFeed";
import { getPublicRecommendationPage } from "@/lib/recommendations/pageCache";

export const metadata: Metadata = { title: "Discover", description: "Discover public-domain museum artworks in your personalized ARTE gallery." };

export default function DiscoverPage() {
  const initialPage = getPublicRecommendationPage([], [], null, 4);

  return (
    <>
      <header className="border-b border-[var(--hairline)] px-6 py-5 md:px-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-text)]">Discover</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display-serif text-4xl font-medium md:text-5xl">Your private museum</h1>
          <p className="max-w-md text-xs leading-6 text-[var(--muted-text)]">Explore public-domain works from four museum collections. Your likes and saves help shape what appears next.</p>
        </div>
      </header>
      <ArtworkFeed initialItems={initialPage.items} initialCursor={initialPage.nextCursor} />
    </>
  );
}
