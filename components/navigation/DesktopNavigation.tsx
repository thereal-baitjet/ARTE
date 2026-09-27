import Link from "next/link";

const links = [
  ["Discover", "/discover"],
  ["Search", "/search"],
  ["Trending", "/trending"],
  ["Collections", "/collections"],
  ["Market", "/market"],
] as const;

export function DesktopNavigation() {
  return (
    <aside className="hidden min-h-screen w-56 shrink-0 border-r border-[var(--hairline)] px-7 py-8 lg:flex lg:flex-col">
      <Link href="/" className="focus-ring display-serif text-3xl tracking-[0.18em]" aria-label="ARTE home">
        ARTE
      </Link>
      <nav aria-label="Primary" className="mt-16">
        <ul className="space-y-5">
          {links.map(([label, href]) => (
            <li key={href}>
              <Link className="focus-ring text-sm tracking-[0.08em] text-[var(--secondary-ink)] transition-opacity hover:opacity-55" href={href}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto border-t border-[var(--hairline)] pt-6 text-xs leading-5 text-[var(--muted-text)]">
        A private museum shaped by your attention.
      </div>
    </aside>
  );
}
