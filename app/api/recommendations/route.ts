import { NextRequest, NextResponse } from "next/server";
import { isAnalyticsEvent } from "@/lib/analytics/types";
import { DEMO_ARTWORKS } from "@/lib/artworks/demoArtworks";
import { buildTasteProfile, getRecommendationPage, rankArtworks } from "@/lib/recommendations/engine";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid recommendation request." }, { status: 400 });
  }

  const candidate = body as {
    events?: unknown;
    hiddenArtworkIds?: unknown;
    cursor?: unknown;
    limit?: unknown;
  };

  const events = Array.isArray(candidate.events)
    ? candidate.events.filter(isAnalyticsEvent).slice(-500)
    : [];
  const hiddenArtworkIds = Array.isArray(candidate.hiddenArtworkIds)
    ? candidate.hiddenArtworkIds.filter((value): value is string => typeof value === "string").slice(0, 100)
    : [];
  const cursor = typeof candidate.cursor === "string" ? candidate.cursor : null;
  const rawLimit = typeof candidate.limit === "number" ? candidate.limit : 4;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 4;

  const profile = buildTasteProfile(events, DEMO_ARTWORKS);
  const ranked = rankArtworks(DEMO_ARTWORKS, profile, hiddenArtworkIds);
  const page = getRecommendationPage(ranked, cursor, limit);

  if (!page.validCursor) {
    return NextResponse.json({ error: "Invalid recommendation cursor." }, { status: 400 });
  }

  return NextResponse.json(
    { items: page.items, nextCursor: page.nextCursor, profileEventCount: profile.eventCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
