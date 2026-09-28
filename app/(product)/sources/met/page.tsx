import Link from "next/link";
import { MET_ARTWORKS } from "@/lib/artworks/metArtworks";

export default function MetSourcePage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-14 md:px-12 md:py-20">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Museum collection · Open Access</p>
      <h1 className="display-serif mt-5 text-5xl leading-tight md:text-7xl">The Metropolitan Museum of Art</h1>
      <p className="mt-7 text-base leading-8">ARTE presents {MET_ARTWORKS.length} works drawn from The Met’s Open Access collection. Every included record was marked public domain by the museum’s Collection API when imported. The museum makes those images and its basic collection data available under CC0.</p>
      <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Titles, creator attributions, dates, media, dimensions, categories, and credit lines come from the museum’s records. The original source record is linked on each artwork. Image files are resized to WebP for display, with their proportions preserved and no cropping.</p>
      <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Search and recommendations use catalog metadata. Museum categories are shown as categories, rather than inferred art movements; no mood, palette, or image embeddings have been invented. Missing metadata remains unfilled.</p>
      <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Museum collection works are presented for discovery and are not offered for sale. This independent project is not affiliated with or endorsed by The Met.</p>
      <div className="mt-9 flex flex-wrap gap-6 border-t border-[var(--hairline)] pt-6 text-sm">
        <a className="focus-ring underline underline-offset-4" href="https://www.metmuseum.org/policies/image-resources">The Met’s Open Access policy</a>
        <a className="focus-ring underline underline-offset-4" href="https://metmuseum.github.io/">Collection API documentation</a>
        <a className="focus-ring underline underline-offset-4" href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>
        <Link className="focus-ring underline underline-offset-4" href="/search?q=Metropolitan">Explore Met works</Link>
        <Link className="focus-ring underline underline-offset-4" href="/sources">All museum sources</Link>
      </div>
    </section>
  );
}
