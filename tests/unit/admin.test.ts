import assert from "node:assert/strict";
import test from "node:test";
import { bearerToken, parseAdminMutation } from "../../lib/admin/validation.ts";
import { demoSourceAdapter, synchronize, validateSourceRecord } from "../../lib/ingestion/adapters.ts";

test("admin input allows only bounded explicit catalog actions", () => {
  const id = "30000000-0000-0000-0000-000000000001";
  assert.deepEqual(parseAdminMutation({ action: "archive_artwork", id, role: "admin" }), { action: "archive_artwork", id });
  assert.equal(parseAdminMutation({ action: "set_listing_status", id, status: "active" }), null);
  assert.equal(parseAdminMutation({ action: "set_listing_status", id: "' or 1=1", status: "sold" }), null);
  assert.equal(parseAdminMutation({ action: "promote_user", id }), null);
  assert.equal(parseAdminMutation(null), null);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("Basic administrator"), null);
  assert.equal(bearerToken(`Bearer ${"x".repeat(8193)}`), null);
});

test("ingestion never imports unclear rights or an untrusted source", async () => {
  const records = await demoSourceAdapter.fetch();
  assert.ok(records.length > 0 && records.every(record => record.isDemo));
  const normalized = demoSourceAdapter.normalize(records[0]);
  assert.deepEqual(validateSourceRecord(normalized), []);
  assert.ok(validateSourceRecord({ ...normalized, image_rights_state: "unclear" }).length);
  assert.ok(validateSourceRecord({ ...normalized, is_synthetic: false }).length);
  assert.ok(validateSourceRecord({ ...normalized, source_url: "javascript:alert(1)" }).length);
  let writes = 0;
  const report = await synchronize({ ...demoSourceAdapter, async fetch() { return [records[0]]; }, normalize(raw) { return { ...demoSourceAdapter.normalize(raw), image_rights_state: "unclear" }; } }, async () => { writes++; });
  assert.equal(writes, 0);
  assert.equal(report.status, "failed");
  assert.equal(report.recordsRejected, 1);
});

test("ingestion observes failures and continues valid records without leaking database errors", async () => {
  let attempts = 0;
  const report = await synchronize(demoSourceAdapter, async () => { attempts++; if (attempts === 1) throw new Error("secret connection string"); });
  assert.equal(report.status, "partial");
  assert.equal(report.recordsRejected, 1);
  assert.equal(report.recordsUpserted, report.recordsSeen - 1);
  assert.ok(!JSON.stringify(report).includes("secret"));
  const failed = await synchronize({ ...demoSourceAdapter, async fetch() { throw new Error("secret provider token"); } }, async () => {});
  assert.equal(failed.status, "failed");
  assert.equal(failed.recordsSeen, 0);
});
