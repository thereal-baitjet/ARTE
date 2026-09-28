import { isAnalyticsEvent, MAX_HIDDEN_ARTWORK_IDS, type AnalyticsEvent } from "../analytics/types.ts";

export class ActivityRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function readBoundedJson(request: Request, maximumBytes = 512 * 1024): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > maximumBytes) throw new ActivityRequestError("Request is too large.", 413);
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maximumBytes) { await reader.cancel(); throw new ActivityRequestError("Request is too large.", 413); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } catch (error) {
      if (error instanceof ActivityRequestError) throw error;
      throw new ActivityRequestError("Could not read the request.");
    } finally { reader.releaseLock(); }
  }
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new ActivityRequestError("Invalid JSON request."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ActivityRequestError("Invalid request.");
  return value as Record<string, unknown>;
}

export function validatedActivity(body: Record<string, unknown>): { events: AnalyticsEvent[]; hiddenArtworkIds: string[] } {
  const events = body.events ?? [];
  const hiddenArtworkIds = body.hiddenArtworkIds ?? [];
  if (!Array.isArray(events) || events.length > 500 || !events.every(isAnalyticsEvent) || !Array.isArray(hiddenArtworkIds) || hiddenArtworkIds.length > MAX_HIDDEN_ARTWORK_IDS || !hiddenArtworkIds.every((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 128)) throw new ActivityRequestError("Invalid or oversized activity history.");
  return { events, hiddenArtworkIds };
}

export function activityErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof ActivityRequestError ? error.message : "The view could not be calculated." }, { status: error instanceof ActivityRequestError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
}
