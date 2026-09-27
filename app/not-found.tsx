import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">404</p>
        <h1 className="display-serif mt-5 text-5xl">This room is not in the museum.</h1>
        <Link href="/" className="focus-ring mt-8 inline-block border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.14em]">
          Return to ARTE
        </Link>
      </div>
    </main>
  );
}
