"use client";

import { useRouter } from "next/navigation";

export function BackToFeed() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => { if (window.history.length > 1) router.back(); else router.push("/discover"); }}
      className="focus-ring border-b border-[var(--primary-ink)] pb-1 text-[11px] uppercase tracking-[0.14em]"
    >
      Back to discover
    </button>
  );
}
