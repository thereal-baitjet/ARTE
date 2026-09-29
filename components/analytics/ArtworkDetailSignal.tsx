"use client";

import { useEffect } from "react";
import { getAuthSnapshot, useAuth } from "@/lib/auth/session";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artwork } from "@/lib/artworks/types";

export function ArtworkDetailSignal({ artwork }: { artwork: Artwork }) {
  const auth = useAuth();
  useEffect(() => {
    if (auth.status !== "authenticated" && auth.status !== "guest") return;
    const revision = auth.revision;
    const frame = window.requestAnimationFrame(() => {
      if (getAuthSnapshot().revision !== revision) return;
      recordAnalyticsEvent({ eventType: "artwork_detail_open", artwork, source: "artwork_detail" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [artwork, auth.status, auth.revision]);

  return null;
}
