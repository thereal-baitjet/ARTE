"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/session";
import { AuthPanel } from "./AuthPanel";

const destinations = [
  ["Your collections", "/collections", "Return to the works you saved. Arrange them into private collections."],
  ["Your Art DNA", "/profile/taste", "A quiet reflection of the art that holds your attention."],
  ["Shape your taste", "/onboarding", "Choose a few works to give your next discovery a starting point."],
  ["Privacy & settings", "/settings", "Manage your session, activity, and recommendation history."],
] as const;

export function AccountOverview() {
  const auth = useAuth();
  const signedIn = auth.status === "authenticated";
  return (
    <section className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-20">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Your ARTE</p>
      <h1 className="display-serif mt-4 max-w-3xl text-5xl leading-[1.08] md:text-7xl">A gallery of your own.</h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--secondary-ink)]">{signedIn ? "A private place for the works you want to return to. Follow your curiosity, at your own pace." : "Keep a little of what moves you. Explore freely, save discoveries, and make space for your own way of seeing."}</p>
      <div className="mt-10 border-y border-[var(--hairline)] py-7 md:py-8"><AuthPanel compact /></div>
      <nav aria-label="Your gallery" className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        {destinations.map(([label, href, detail]) => <Link href={href} key={href} className="focus-ring block min-h-32 border-b border-[var(--hairline)] pb-7">
          <h2 className="display-serif text-3xl">{label} <span aria-hidden="true" className="ml-2 text-lg text-[var(--muted-text)]">↗</span></h2>
          <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--muted-text)]">{detail}</p>
        </Link>)}
      </nav>
      {signedIn && <section aria-labelledby="private-gallery-heading" className="mt-12 max-w-2xl">
        <h2 id="private-gallery-heading" className="text-xs uppercase tracking-[0.14em] text-[var(--secondary-ink)]">Made for a private gallery</h2>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-text)]">Your likes, saved works, collections, followed artists, and recent activity are linked to your account. Your Art DNA grows from that recent activity. Nothing here creates a public profile.</p>
      </section>}
    </section>
  );
}
