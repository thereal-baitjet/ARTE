import Link from "next/link";
import { ArtworkVisual } from "@/components/artwork/ArtworkVisual";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";

const principles = [
  "Museum masterpieces and public-domain collections",
  "Painting, prints, and sculpture across cultures",
  "Personalized discovery that remains explainable",
  "Commercial listings clearly separated from museum records",
];

export default function Home() {
  const featured = PUBLIC_ARTWORKS.find((artwork) => artwork.slug === "corridor-in-the-asylum-met-336327") ?? PUBLIC_ARTWORKS[0];
  return (
    <main id="main-content" className="min-h-screen overflow-hidden">
      <header className="page-shell flex items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="focus-ring display-serif text-2xl tracking-[0.18em]" aria-label="ARTE home">
          ARTE
        </Link>
        <Link href="/discover" className="focus-ring border-b border-[var(--primary-ink)] pb-1 text-[11px] uppercase tracking-[0.14em]">
          Enter the gallery
        </Link>
      </header>

      <section className="page-shell grid min-h-[78vh] items-center gap-12 px-6 py-14 md:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted-text)]">
            The personalized world of fine art · Early access
          </p>
          <h1 className="display-serif mt-7 max-w-4xl text-[clamp(4rem,9vw,8.8rem)] font-medium leading-[0.82] tracking-[-0.045em]">
            Discover art that discovers you.
          </h1>
          <p className="mt-9 max-w-xl text-base leading-8 text-[var(--secondary-ink)] md:text-lg">
            A private gallery that learns from what holds your attention. Explore visual connections, collect what moves you, and discover your Art DNA.
          </p>
          <div className="mt-10 flex flex-wrap gap-5">
            <Link href="/discover" className="focus-ring bg-[var(--primary-ink)] px-6 py-4 text-xs uppercase tracking-[0.14em] text-[var(--soft-white)]">
              Start discovering
            </Link>
            <Link href="/onboarding" className="focus-ring border border-[var(--primary-ink)] px-6 py-4 text-xs uppercase tracking-[0.14em]">
              Shape your taste
            </Link>
          </div>
          <p className="mt-6 max-w-xl text-xs leading-6 text-[var(--muted-text)]">Explore {PUBLIC_ARTWORKS.length.toLocaleString("en-US")} public-domain artworks from four museum collections without an account. Save favorites, discover connections, and build your own collection.</p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <Link href={`/artwork/${featured.slug}`} aria-label={`View ${featured.title}`} className="focus-ring block border border-[var(--hairline)] bg-[var(--soft-white)] p-5 md:p-8">
            <ArtworkVisual artwork={featured} />
          </Link>
          <p className="mt-3 text-xs leading-5 text-[var(--muted-text)]">
            {featured.title} · {featured.artist.name}<br />{featured.museum?.name ?? "Museum collection"} · Public domain
          </p>
        </div>
      </section>
      <footer className="page-shell flex flex-wrap items-center justify-between gap-6 px-6 py-9 text-xs text-[var(--muted-text)] md:px-10">
        <span>ARTE · Discover art that discovers you.</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-6">
          <Link href="/sources" className="focus-ring underline underline-offset-4">Sources & rights</Link>
          <Link href="/settings" className="focus-ring underline underline-offset-4">Privacy controls</Link>
          <Link href="/profile" className="focus-ring underline underline-offset-4">Your account</Link>
        </nav>
      </footer>

      <section className="border-y border-[var(--hairline)] bg-[var(--soft-white)]">
        <div className="page-shell grid gap-10 px-6 py-14 md:grid-cols-2 md:px-10 lg:grid-cols-4">
          {principles.map((item, index) => (
            <article key={item} className="border-t border-[var(--hairline)] pt-5">
              <p className="text-[10px] tracking-[0.18em] text-[var(--muted-text)]">0{index + 1}</p>
              <p className="display-serif mt-4 text-2xl leading-tight">{item}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
