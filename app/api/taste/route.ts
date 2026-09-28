import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { activityErrorResponse, readBoundedJson, validatedActivity } from "@/lib/activity/request";
import { summarizeTaste } from "@/lib/taste/profile";

export async function POST(request: Request) {
  try {
    const { events } = validatedActivity(await readBoundedJson(request));
    // Ephemeral computation only: no analytics database, cookies, or logging of event bodies.
    return Response.json(summarizeTaste(events, PUBLIC_ARTWORKS), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return activityErrorResponse(error); }
}
