import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata = { title: "Your account — ARTE", robots: { index: false, follow: false } };

export default function AuthPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Account</p>
      <h1 className="display-serif mt-5 text-5xl font-medium md:text-7xl">Keep what moves you.</h1>
      <p className="mt-6 max-w-xl text-base leading-8 text-[var(--secondary-ink)]">
        Keep your discoveries with your private account. Saved works, collections, and recent activity travel with you; guest exploration is always open.
      </p>
      <div className="mt-10 border-t border-[var(--hairline)] pt-8"><AuthPanel /></div>
    </section>
  );
}
