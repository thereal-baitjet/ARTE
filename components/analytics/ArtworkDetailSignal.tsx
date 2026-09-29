"use client";

import { useEffect, useRef } from "react";
import { getAuthSnapshot, useAuth } from "@/lib/auth/session";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artwork } from "@/lib/artworks/types";

export function ArtworkDetailSignal({ artwork }: { artwork: Artwork }) {
  const auth = useAuth();
  const recordedArtwork = useRef<string | null>(null);
  useEffect(() => {
    if (recordedArtwork.current === artwork.id || (auth.status !== "authenticated" && auth.status !== "guest")) return;
    const revision = auth.revision;
    const frame = window.requestAnimationFrame(() => {
      if (getAuthSnapshot().revision !== revision) return;
      const event = recordAnalyticsEvent({ eventType: "artwork_detail_open", artwork, source: "artwork_detail" });
      // Changing accounts does not open the artwork again.
      if (event) recordedArtwork.current = artwork.id;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [artwork, auth.status, auth.revision]);

  return null;
}
