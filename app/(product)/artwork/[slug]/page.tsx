import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtworkActions } from "@/components/artwork/ArtworkActions";
import { ArtworkRights } from "@/components/artwork/ArtworkRights";
import { ArtworkVisual } from "@/components/artwork/ArtworkVisual";
import { ArtworkDetailSignal } from "@/components/analytics/ArtworkDetailSignal";
import { BackToFeed } from "@/components/navigation/BackToFeed";
import { MoreLikeThisPanel } from "@/components/recommendation/MoreLikeThisPanel";
import { getAllArtworkSlugs, getArtworkBySlug, getArtworkCatalog } from "@/lib/artworks/feed";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return getAllArtworkSlugs(); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artwork = getArtworkBySlug(slug);
  return artwork ? { title: artwork.title, description: artwork.description } : { title: "Artwork not found" };
}

export default async function ArtworkPage({ params }: Props) {
  const { slug } = await params;
  const artwork = getArtworkBySlug(slug);
  if (!artwork) notFound();
  const candidates = getArtworkCatalog().filter((candidate) => candidate.id !== artwork.id);

  return (
    <article className="px-6 py-8 md:px-10 lg:px-14 lg:py-12">
      <ArtworkDetailSignal artwork={artwork} />
      <div className="flex items-center justify-between gap-4"><BackToFeed /><p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Demo artwork</p></div>
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex justify-center"><ArtworkVisual artwork={artwork} /></div>
        <aside>
          <p className="text-sm text-[var(--secondary-ink)]">{artwork.artist.name}</p>
          <h1 className="display-serif mt-2 text-5xl font-medium leading-none">{artwork.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted-text)]">{artwork.year}</p>
          <p className="mt-7 text-sm leading-7">{artwork.medium}<br />{artwork.dimensions}<br />{artwork.movement}</p>
          <p className="mt-7 text-sm leading-7 text-[var(--secondary-ink)]">{artwork.description}</p>
          <ArtworkActions artwork={artwork} context="detail" />
        </aside>
      </div>
      <div className="mx-auto mt-16 max-w-4xl"><ArtworkRights rights={artwork.rights} /></div>
      <MoreLikeThisPanel source={artwork} candidates={candidates} />
    </article>
  );
}
