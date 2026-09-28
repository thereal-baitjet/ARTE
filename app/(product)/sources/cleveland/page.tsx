import Link from "next/link";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { museumProviderForSourceUrl } from "@/lib/artworks/providers";

export const metadata = { title: "Cleveland Museum of Art source & rights — ARTE" };

export default function ClevelandSourcePage() {
  const count = PUBLIC_ARTWORKS.filter((artwork) => museumProviderForSourceUrl(artwork.rights.sourceUrl)?.id === "cleveland").length;
  return (
    <section className="mx-auto max-w-4xl px-6 py-14 md:px-12 md:py-20">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Museum collection · Open Access</p>
      <h1 className="display-serif mt-5 text-5xl leading-tight md:text-7xl">Cleveland Museum of Art</h1>
      <p className="mt-7 text-base leading-8">ARTE presents {count} works from the Cleveland Museum of Art’s Open Access collection. The museum publishes collection metadata under CC0, but only records with a CC0 image designation qualify for image display here.</p>
      <h2 className="display-serif mt-9 text-3xl">A rights check for each work</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--secondary-ink)]">The import checks the individual record’s image license, source link, and available image. Its <code>share_license_status</code> must be <code>CC0</code>; a general open-data label is not sufficient. The source record and verification evidence are retained, and each artwork page links back to the museum’s original object record.</p>
      <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Source information comes from the museum’s official bulk dataset on GitHub, pinned to the revision linked below. The CC0 designation was reviewed in that published dataset. Images come from the museum’s Open Access image service.</p>
      <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">Titles, creator attributions, dates, materials, credit lines, and classifications come from the museum’s catalog. Images retain their proportions and come from the museum’s Open Access service or locally prepared WebP copies. Missing catalog information stays unfilled; source metadata is not a claim of visual image analysis.</p>
      <p className="mt-5 text-sm leading-7 text-[var(--secondary-ink)]">These works are for discovery, not for sale. ARTE is independent and is not affiliated with or endorsed by the Cleveland Museum of Art. Source information reflects the import review and can change; consult the linked museum record for its current information.</p>
      <div className="mt-9 flex flex-wrap gap-6 border-t border-[var(--hairline)] pt-6 text-sm">
        <a className="focus-ring underline underline-offset-4" href="https://www.clevelandart.org/open-access">Cleveland’s Open Access policy</a>
        <a className="focus-ring underline underline-offset-4" href="https://openaccess-api.clevelandart.org/">Open Access API documentation</a>
        <a className="focus-ring underline underline-offset-4" href="https://github.com/ClevelandMuseumArt/openaccess/tree/4684c48c7c07b1452db7963adf4aad8052055b7d">Official dataset revision used</a>
        <a className="focus-ring underline underline-offset-4" href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>
        <Link className="focus-ring underline underline-offset-4" href="/search?q=Cleveland">Explore Cleveland works</Link>
        <Link className="focus-ring underline underline-offset-4" href="/sources">All museum sources</Link>
      </div>
    </section>
  );
}
