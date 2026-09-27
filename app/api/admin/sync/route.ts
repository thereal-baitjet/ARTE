import { adminResponse, requireAdmin } from "@/lib/admin/auth";
import { demoSourceAdapter, synchronize } from "@/lib/ingestion/adapters";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  // Source is fixed server-side; a caller cannot inject a URL or arbitrary records.
  const run = await auth.client.from("source_sync_runs").insert({ source_name: demoSourceAdapter.id, status: "running" }).select("id").single();
  if (run.error || !run.data) return adminResponse({ error: "Could not start an observable synchronization. No records were imported." }, 503);
  const report = await synchronize(demoSourceAdapter, async (record) => {
    const result = await auth.client.rpc("admin_upsert_demo_artwork", { record });
    if (result.error) throw new Error("Database rejected record");
  });
  const saved = await auth.client.from("source_sync_runs").update({ status: report.status, finished_at: new Date().toISOString(), records_seen: report.recordsSeen, records_upserted: report.recordsUpserted, records_rejected: report.recordsRejected, error_summary: { errors: report.errors } }).eq("id", run.data.id).select("id").single();
  if (saved.error || !saved.data) return adminResponse({ error: "Synchronization ran, but its final report could not be saved. Inspect the running record before retrying." }, 503);
  return adminResponse({ runId: run.data.id, ...report }, report.status === "failed" ? 422 : 200);
}
