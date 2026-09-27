import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { getAllArtistSlugs, getArtistBySlug, getArtworksByArtist } from "@/lib/artworks/feed";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllArtistSlugs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);
  return artist ? { title: artist.name, description: artist.biography } : { title: "Artist not found" };
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);
  if (!artist) notFound();
  const artworks = getArtworksByArtist(slug);

  return (
    <section className="px-6 py-12 md:px-10 lg:px-14 lg:py-20">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Synthetic demo identity</p>
      <h1 className="display-serif mt-5 text-6xl font-medium md:text-8xl">{artist.name}</h1>
      <p className="mt-5 text-xs uppercase tracking-[0.14em] text-[var(--muted-text)]">{artist.nationality}</p>
      <p className="mt-8 max-w-3xl text-base leading-8 text-[var(--secondary-ink)]">{artist.biography}</p>
      <div className="mt-14 border-t border-[var(--hairline)] pt-9">
        <h2 className="display-serif text-4xl">Works in this demo set</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {artworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} />)}
        </div>
      </div>
    </section>
  );
}
