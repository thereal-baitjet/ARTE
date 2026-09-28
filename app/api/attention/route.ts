import { artworkSummary } from "@/lib/artworks/summary";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { ActivityRequestError, activityErrorResponse, readBoundedJson, validatedActivity } from "@/lib/activity/request";
import { buildAttentionRanking, mostSavedAttention } from "@/lib/trending/attention";

export async function POST(request: Request) {
  try {
    const body = await readBoundedJson(request);
    const { events, hiddenArtworkIds } = validatedActivity(body);
    const mode = body.mode ?? "attention";
    if (mode !== "attention" && mode !== "saved") throw new ActivityRequestError("Invalid attention view.");
    const hidden = new Set(hiddenArtworkIds);
    const ranking = buildAttentionRanking(events, PUBLIC_ARTWORKS).filter(({ artwork }) => !hidden.has(artwork.id));
    const ordered = mode === "saved" ? mostSavedAttention(ranking) : ranking;
    // Only the current top twenty cards cross the client boundary; guest events are never persisted here.
    return Response.json({ items: ordered.slice(0, 20).map(({ artwork, ...result }) => ({ ...result, artwork: artworkSummary(artwork) })), total: ordered.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityErrorResponse(error); }
}
