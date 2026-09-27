import type { Metadata } from "next";
import { ArtworkFeed } from "@/components/feed/ArtworkFeed";
import { getDemoFeedPage } from "@/lib/artworks/feed";

export const metadata: Metadata = {
  title: "Discover",
  description: "An artwork-first, rights-aware demo feed for ARTE.",
};

export default function DiscoverPage() {
  const initialPage = getDemoFeedPage(null, 4);

  return (
    <>
      <header className="border-b border-[var(--hairline)] px-6 py-5 md:px-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-text)]">Discover</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display-serif text-4xl font-medium md:text-5xl">Your private museum</h1>
          <p className="max-w-md text-xs leading-6 text-[var(--muted-text)]">Synthetic demo works are clearly labeled. Likes and saves persist locally for guests and use Supabase when an authenticated environment is connected.</p>
        </div>
      </header>
      <ArtworkFeed initialItems={initialPage.items} initialCursor={initialPage.nextCursor} />
    </>
  );
}
