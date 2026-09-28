import { NextRequest, NextResponse } from "next/server";
import { isAnalyticsEvent, MAX_HIDDEN_ARTWORK_IDS } from "@/lib/analytics/types";
import { getPublicRecommendationPage } from "@/lib/recommendations/pageCache";

const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Recommendation request is too large." }, { status: 413 });
  }
  // Bound the actual stream too: Content-Length is optional and cannot be trusted.
  const reader = request.body?.getReader();
  let bodyText = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel();
          return NextResponse.json({ error: "Recommendation request is too large." }, { status: 413 });
        }
        bodyText += decoder.decode(value, { stream: true });
      }
      bodyText += decoder.decode();
    }
  } catch {
    return NextResponse.json({ error: "Invalid recommendation request." }, { status: 400 });
  }
  let body: unknown;
  try { body = JSON.parse(bodyText); } catch { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid recommendation request." }, { status: 400 });
  }

  const candidate = body as {
    events?: unknown;
    hiddenArtworkIds?: unknown;
    cursor?: unknown;
    limit?: unknown;
  };

  const events = candidate.events ?? [];
  const hiddenArtworkIds = candidate.hiddenArtworkIds ?? [];
  const cursor = candidate.cursor ?? null;
  const limit = candidate.limit ?? 4;
  if (
    !Array.isArray(events) || events.length > 500 || !events.every(isAnalyticsEvent) ||
    !Array.isArray(hiddenArtworkIds) || hiddenArtworkIds.length > MAX_HIDDEN_ARTWORK_IDS ||
    !hiddenArtworkIds.every((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 128) ||
    (cursor !== null && (typeof cursor !== "string" || cursor.length === 0 || cursor.length > 160)) ||
    typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 8
  ) {
    return NextResponse.json({ error: "Invalid recommendation request." }, { status: 400 });
  }

  const page = getPublicRecommendationPage(events, hiddenArtworkIds, cursor, limit);

  if (!page.validCursor) {
    return NextResponse.json({ error: "Invalid recommendation cursor." }, { status: 400 });
  }

  return NextResponse.json(
    { items: page.items, nextCursor: page.nextCursor, profileEventCount: page.profileEventCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
