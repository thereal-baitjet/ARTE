import Link from "next/link";

export default function OnboardingPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:px-10 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Optional visual onboarding</p>
      <h1 className="display-serif mt-5 text-6xl font-medium md:text-8xl">What moves you?</h1>
      <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--secondary-ink)]">
        The full visual-selection experience is intentionally deferred until licensed seed artwork and the recommendation event model are available.
      </p>
      <Link href="/discover" className="focus-ring mt-10 inline-block border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.14em]">
        Skip for now
      </Link>
    </section>
  );
}
