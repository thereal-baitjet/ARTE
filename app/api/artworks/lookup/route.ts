import { artworkSummary } from "@/lib/artworks/summary";
import { DEMO_ARTWORKS } from "@/lib/artworks/demoArtworks";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { ActivityRequestError, activityErrorResponse, readBoundedJson } from "@/lib/activity/request";

export async function POST(request: Request) {
  try {
    const body = await readBoundedJson(request, 12 * 1024);
    if (!Array.isArray(body.ids) || body.ids.length > 40 || !body.ids.every((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 128)) throw new ActivityRequestError("Provide at most 40 artwork IDs.");
    const ids = [...new Set(body.ids)];
    // Legacy fixtures resolve only by explicit ID; public choices and discovery never list them.
    const index = new Map([...DEMO_ARTWORKS.filter((artwork) => artwork.isDemo), ...PUBLIC_ARTWORKS].map((artwork) => [artwork.id, artwork]));
    return Response.json({ items: ids.flatMap((id) => index.get(id) ?? []).map(artworkSummary), missingIds: ids.filter((id) => !index.has(id)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityErrorResponse(error); }
}
