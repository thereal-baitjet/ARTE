"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">ARTE</p>
        <h1 className="display-serif mt-5 text-4xl">The gallery lost its place.</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-text)]">
          The current view could not be loaded. Your previous context has not been intentionally cleared.
        </p>
        <button type="button" onClick={reset} className="focus-ring mt-8 border border-[var(--primary-ink)] px-5 py-3 text-xs uppercase tracking-[0.12em]">
          Try again
        </button>
      </div>
    </main>
  );
}
