import Link from "next/link";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { museumProviderForSourceUrl } from "@/lib/artworks/providers";

export const metadata = { title: "National Gallery of Art source & rights — ARTE" };

export default function NationalGallerySourcePage() {
  const count = PUBLIC_ARTWORKS.filter(work => museumProviderForSourceUrl(work.rights.sourceUrl)?.id === "nga").length;
  return <section className="mx-auto max-w-4xl px-6 py-14 md:px-12 md:py-20">
    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Museum collection · Open Access</p>
    <h1 className="display-serif mt-5 text-5xl leading-tight md:text-7xl">National Gallery of Art</h1>
    <p className="mt-7 text-base leading-8">ARTE presents {count} works from the National Gallery of Art in Washington, DC. Each selected image is marked open access in the Gallery’s published image records.</p>
    <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">The Gallery’s open metadata license does not automatically clear every image. Only images marked for unrestricted open-access use are included here. Restricted images are excluded. Titles, dates, creator attributions, materials, dimensions, and credit lines retain their museum sources.</p>
    <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Images are served from the Gallery’s official image service with their proportions preserved. Each artwork links to its museum record and displays its image attribution and rights information. This independent project does not imply museum endorsement or availability for purchase.</p>
    <div className="mt-9 flex flex-wrap gap-6 border-t border-[var(--hairline)] pt-6 text-sm">
      <a className="focus-ring underline underline-offset-4" href="https://www.nga.gov/artworks/free-images-and-open-access">National Gallery Open Access policy</a>
      <a className="focus-ring underline underline-offset-4" href="https://github.com/NationalGalleryOfArt/opendata/tree/dfdbcf1a226ce1f2953f5e8422e71d923869b67e">Official dataset revision used</a>
      <Link className="focus-ring underline underline-offset-4" href="/sources">All museum sources</Link>
    </div>
  </section>;
}
