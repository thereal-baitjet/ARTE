import Link from "next/link";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { MUSEUM_PROVIDERS, museumProviderForSourceUrl } from "@/lib/artworks/providers";

export const metadata = { title: "Museum sources & rights — ARTE" };

export default function MuseumSourcesPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-14 md:px-12 md:py-20">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Museum collections · Open Access</p>
      <h1 className="display-serif mt-5 text-5xl leading-tight md:text-7xl">Sources & rights</h1>
      <p className="mt-7 max-w-3xl text-base leading-8">Explore works from The Met, Cleveland Museum of Art, National Gallery of Art, and MoMA. Each artwork links to its museum record and displays its own image source, attribution, and license.</p>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--secondary-ink)]">An open metadata record does not automatically clear its image. ARTE includes images only after checking their individual public-domain or CC0 evidence. MoMA images come from separately reviewed Wikimedia Commons files. Records with unclear or restricted image rights are excluded. Museum works are presented for discovery and are not offered for sale.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {MUSEUM_PROVIDERS.map((provider) => {
          const count = PUBLIC_ARTWORKS.filter((artwork) => museumProviderForSourceUrl(artwork.rights.sourceUrl)?.id === provider.id).length;
          return <section key={provider.id} className="border border-[var(--hairline)] p-6"><h2 className="display-serif text-3xl">{provider.name}</h2><p className="mt-4 text-sm text-[var(--muted-text)]">{count} {count === 1 ? "work" : "works"} in ARTE’s current public catalog</p><Link href={provider.guideUrl} className="focus-ring mt-6 inline-block border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.12em]">Read source & rights details</Link></section>;
        })}
      </div>
      <p className="mt-9 text-sm leading-7 text-[var(--secondary-ink)]">Attribution describes where an image and its catalog information come from. ARTE is an independent project; inclusion does not imply museum affiliation, endorsement, or availability for purchase.</p>
    </section>
  );
}
