"use client";

import { useEffect } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artwork } from "@/lib/artworks/types";

export function ArtworkDetailSignal({ artwork }: { artwork: Artwork }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      recordAnalyticsEvent({ eventType: "artwork_detail_open", artwork, source: "artwork_detail" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [artwork]);

  return null;
}
