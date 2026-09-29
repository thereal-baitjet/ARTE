"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Discover", "/discover"],
  ["Search", "/search"],
  ["Saved", "/collections"],
  ["Market", "/market"],
  ["You", "/profile"],
] as const;

export function MobileNavigation() {
  const pathname = usePathname();
  function active(href: string) {
    if (href === "/profile") return ["/profile", "/taste", "/settings", "/auth", "/onboarding"].some((path) => pathname === path || pathname.startsWith(path + "/"));
    return pathname === href || pathname.startsWith(href + "/");
  }
  return (
    <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--hairline)] bg-[color:var(--gallery-ivory)]/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {links.map(([label, href]) => <li key={href}>
          <Link href={href} aria-current={active(href) ? "page" : undefined} className={`focus-ring flex min-h-11 items-center justify-center text-[11px] uppercase tracking-[0.11em] ${active(href) ? "font-semibold text-[var(--primary-ink)] underline decoration-[var(--oxblood)] underline-offset-8" : "text-[var(--muted-text)]"}`}>
            {label}
          </Link>
        </li>)}
      </ul>
    </nav>
  );
}
