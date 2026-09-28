import Link from "next/link";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { museumProviderForSourceUrl } from "@/lib/artworks/providers";

export const metadata = { title: "MoMA collection source & image rights — ARTE" };

export default function MomaSourcePage() {
  const count = PUBLIC_ARTWORKS.filter(work => museumProviderForSourceUrl(work.rights.sourceUrl)?.id === "moma").length;
  return <section className="mx-auto max-w-4xl px-6 py-14 md:px-12 md:py-20">
    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Museum collection · Independently sourced images</p>
    <h1 className="display-serif mt-5 text-5xl leading-tight md:text-7xl">The Museum of Modern Art</h1>
    <p className="mt-7 text-base leading-8">ARTE presents {count} selected works in MoMA’s collection. Catalog facts come from MoMA’s open metadata. The images come from individually reviewed public-domain files on Wikimedia Commons.</p>
    <h2 className="display-serif mt-9 text-3xl">Two sources, checked separately</h2>
    <p className="mt-4 text-sm leading-7 text-[var(--secondary-ink)]">MoMA’s open-data license excludes images. Every work shown here is matched to its MoMA object record and a separate Commons image, with evidence for the artwork’s expired copyright and the reproduction’s public-domain status. A filename or a general metadata license is not enough to qualify.</p>
    <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Each artwork page links to both the museum record and the image source. Original credits, public-domain declarations, and verification evidence are retained. These images are not presented as supplied or licensed by MoMA. ARTE is independent; collection works are for discovery and are not offered for sale.</p>
    <div className="mt-9 flex flex-wrap gap-6 border-t border-[var(--hairline)] pt-6 text-sm">
      <a className="focus-ring underline underline-offset-4" href="https://github.com/MuseumofModernArt/collection">MoMA collection metadata and scope</a>
      <a className="focus-ring underline underline-offset-4" href="https://www.moma.org/collection/about/licensing">MoMA image licensing</a>
      <Link className="focus-ring underline underline-offset-4" href="/sources">All museum sources</Link>
    </div>
  </section>;
}
