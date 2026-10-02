import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "@/lib/admin/validation";
import { ActivityRequestError, readBoundedJson } from "@/lib/activity/request";
import { isUuid, noteText, parseCursor } from "@/lib/corridor/validation";
import { CorridorContractError, corridorEligibility, corridorNote, corridorPage } from "@/lib/corridor/contracts";

type Context = { params: Promise<{ artworkId: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Authorization", "X-Robots-Tag": "noindex, nofollow, noarchive" },
});
const errors: Record<string, [number, string]> = {
  "42501": [403, "The Shared Corridor is unavailable."],
  "23505": [409, "You already have a note here. Refresh to edit it."],
  P0404: [404, "This note has changed. Please refresh."],
  P0414: [400, "Please keep your note between 1 and 140 characters."],
  P0422: [422, "Please keep your note thoughtful and free of links or promotional language."],
  P0429: [429, "You have reached today's note allowance. You can return tomorrow."],
  "22023": [400, "Please refresh and try again."],
};

function rpcError(error: { code?: string }, operation: string) {
  const code = error.code ?? "unknown";
  const [status, message] = errors[code] ?? [503, "The Shared Corridor is resting. Please try again shortly."];
  if (status === 503) console.error("[corridor] database request failed", { operation, code });
  return reply({ error: message }, status);
}

async function handle(request: Request, context: Context) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return reply({ error: "Please sign in again." }, 401);
  const { artworkId } = await context.params;
  if (!isUuid(artworkId)) return reply({ error: "Artwork unavailable." }, 404);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply({ error: "The Shared Corridor is resting. Please try again later." }, 503);
  try {
    const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const user = await client.auth.getUser(token);
    if (user.error || !user.data.user) return reply({ error: "Please sign in again." }, 401);
    const search = new URL(request.url).searchParams;
    const access = await client.rpc("shared_corridor_access", { p_artwork_id: artworkId });
    if (access.error) return rpcError(access.error, "access");
    const eligible = corridorEligibility(access.data);
    if (request.method === "GET" && search.get("access") === "1") return reply({ eligible });
    if (!eligible) return reply({ error: "The Shared Corridor is unavailable." }, 403);
    let result;
    if (request.method === "GET") {
      let cursor;
      try { cursor = parseCursor(search.get("cursor")); } catch { return reply({ error: "Please refresh and try again." }, 400); }
      result = await client.rpc("shared_corridor_page", { p_artwork_id: artworkId, p_before: cursor?.createdAt ?? null, p_before_id: cursor?.id ?? null });
    } else {
      let text: string | null = null;
      if (request.method !== "DELETE") {
        try { text = noteText(await readBoundedJson(request, 2048)); }
        catch (error) { return reply({ error: error instanceof Error ? error.message : "Please enter a short note." }, error instanceof ActivityRequestError ? error.status : 400); }
      }
      result = await client.rpc("shared_corridor_write", { p_artwork_id: artworkId,
        p_operation: request.method === "POST" ? "create" : request.method === "PATCH" ? "update" : "delete", p_note_text: text });
    }
    if (result.error) return rpcError(result.error, request.method);
    if (request.method === "GET") return reply(corridorPage(result.data));
    if (request.method === "DELETE") return reply(null);
    const saved = corridorNote(result.data);
    if (!saved.isOwn) throw new CorridorContractError("write");
    return reply(saved);
  } catch (error) {
    console.error("[corridor] request unavailable", {
      operation: error instanceof CorridorContractError ? error.operation : request.method,
      code: error instanceof CorridorContractError ? "invalid_response" : "request_failed",
    });
    return reply({ error: "The Shared Corridor is resting. Please try again shortly." }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
