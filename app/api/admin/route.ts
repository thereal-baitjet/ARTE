import { adminResponse, requireAdmin } from "@/lib/admin/auth";
import { parseAdminMutation } from "@/lib/admin/validation";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { client } = auth;
  const results = await Promise.all([
    client.from("artworks").select("id,title,image_rights_state,is_published,source_name").order("created_at", { ascending: false }).limit(100),
    client.from("artworks").select("id,title,image_rights_state,source_name").in("image_rights_state", ["unclear", "restricted"]).order("created_at", { ascending: false }).limit(100),
    client.from("listings").select("id,artwork_id,status,is_demo,last_verified_at,expires_at").order("updated_at", { ascending: false }).limit(100),
    client.from("source_sync_runs").select("id,source_name,status,started_at,records_seen,records_upserted,records_rejected,error_summary").order("started_at", { ascending: false }).limit(30),
    client.from("admin_audit_logs").select("id,action,resource_type,resource_id,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("artists").select("id,name,nationality").order("name").limit(100),
    client.from("events").select("event_type").order("created_at", { ascending: false }).limit(1000),
  ]);
  if (results.some((result) => result.error)) return adminResponse({ error: "Administrative records could not be loaded. Check the database migrations and retry." }, 503);
  const [artworks, rightsQueue, listings, syncRuns, auditLogs, artists, events] = results;
  const counts: Record<string, number> = {};
  for (const event of events.data ?? []) counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
  return adminResponse({ artists: artists.data, artworks: artworks.data, rightsQueue: rightsQueue.data, listings: listings.data, syncRuns: syncRuns.data, auditLogs: auditLogs.data, diagnostics: { sampleSize: events.data?.length ?? 0, events: counts, recommendationProvider: "Deterministic metadata similarity; no production visual embeddings", availableSources: ["arte-demo-v1"] } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const text = await request.text();
  if (text.length > 2048) return adminResponse({ error: "Request is too large." }, 413);
  let input: unknown;
  try { input = JSON.parse(text); } catch { return adminResponse({ error: "Invalid request." }, 400); }
  const mutation = parseAdminMutation(input);
  if (!mutation) return adminResponse({ error: "Invalid administrative action." }, 400);
  const result = mutation.action === "archive_artwork"
    ? await auth.client.from("artworks").update({ is_published: false, updated_at: new Date().toISOString() }).eq("id", mutation.id).select("id").single()
    : await auth.client.from("listings").update({ status: mutation.status, updated_at: new Date().toISOString() }).eq("id", mutation.id).select("id").single();
  // The database audit trigger is in the same transaction. Audit failure blocks the change.
  if (result.error || !result.data) return adminResponse({ error: "The change was not saved. Refresh the records and try again." }, 409);
  return adminResponse({ saved: true, id: result.data.id });
}
