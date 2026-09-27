import { AuthPanel } from "@/components/auth/AuthPanel";

export default function AuthPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Account</p>
      <h1 className="display-serif mt-5 text-5xl font-medium md:text-7xl">Keep what moves you.</h1>
      <p className="mt-6 max-w-xl text-base leading-8 text-[var(--secondary-ink)]">
        Guest exploration stays open. Sign in when you want persistent likes, saves, collections, follows, or Art DNA.
      </p>
      <AuthPanel />
    </section>
  );
}
