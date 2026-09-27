"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Discover", "/discover"],
  ["Search", "/search"],
  ["Trending", "/trending"],
  ["Collections", "/collections"],
  ["Market", "/market"],
  ["Art DNA", "/profile/taste"],
  ["Settings", "/settings"],
] as const;

export function DesktopNavigation() {
  const pathname = usePathname();
  return (
    <aside className="hidden min-h-screen w-56 shrink-0 border-r border-[var(--hairline)] px-7 py-8 lg:flex lg:flex-col">
      <Link href="/" className="focus-ring display-serif text-3xl tracking-[0.18em]" aria-label="ARTE home">
        ARTE
      </Link>
      <nav aria-label="Primary" className="mt-16">
        <ul className="space-y-5">
          {links.map(([label, href]) => (
            <li key={href}>
              <Link aria-current={pathname === href ? "page" : undefined} className={`focus-ring text-sm tracking-[0.08em] text-[var(--secondary-ink)] transition-opacity hover:opacity-70 ${pathname === href ? "border-b border-[var(--oxblood)] pb-1 font-semibold" : ""}`} href={href}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto border-t border-[var(--hairline)] pt-6 text-xs leading-5 text-[var(--muted-text)]">
        <p>A private museum shaped by your attention.</p>
        <Link href="/profile" className="focus-ring mt-4 block underline underline-offset-4">Your account</Link>
        <p className="mt-4">Early access · museum art & demo studies</p>
      </div>
    </aside>
  );
}
