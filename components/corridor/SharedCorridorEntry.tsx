"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCorridorAccess } from "@/lib/corridor/useCorridorAccess";

type Props = { artworkId: string; artworkSlug: string; location?: "feed" | "account" };

export function SharedCorridorEntry({ artworkId, artworkSlug, location = "feed" }: Props) {
  const anchor = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(location === "account");
  const { eligible, token } = useCorridorAccess(artworkId, nearby);
  const signedIn = Boolean(token);

  useEffect(() => {
    if (!signedIn || location === "account" || !anchor.current) return;
    // Discover checks only entries near the viewport, rather than every loaded work.
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { rootMargin: "200px" });
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, [signedIn, location]);

  if (!signedIn) return null;
  const entry = eligible ? <Link href={`/artwork/${artworkSlug}#shared-corridor`} prefetch={false}
      className={location === "account"
        ? "focus-ring block min-h-32 border-b border-[var(--hairline)] pb-7"
        : "focus-ring mt-3 flex min-h-11 items-center text-sm text-[var(--secondary-ink)] underline decoration-current/30 underline-offset-4"}>
      {location === "account" ? <>
        <h2 className="display-serif text-3xl">Shared Corridor <span aria-hidden="true" className="ml-2 text-lg text-[var(--muted-text)]">↗</span></h2>
        <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--muted-text)]">A private guestbook beside the art. Leave a quiet note for others viewing the same work.</p>
      </> : "Open the Shared Corridor guestbook"}
    </Link> : null;
  return location === "account" ? entry : <div ref={anchor}>{entry}</div>;
}
