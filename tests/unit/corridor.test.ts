import assert from "node:assert/strict";
import test from "node:test";
import { isUuid, noteText, parseCursor } from "../../lib/corridor/validation.ts";

test("notes preserve Unicode, normalize space, and reject ownership injection", () => {
  assert.equal(noteText({ noteText: "  Quiet\n light  " }), "Quiet light");
  assert.equal(noteText({ noteText: "🌿".repeat(140) }), "🌿".repeat(140));
  assert.throws(() => noteText({ noteText: "🌿".repeat(141) }));
  assert.throws(() => noteText({ noteText: "   " }));
  assert.throws(() => noteText({ noteText: "Hello", user_id: "someone-else" }));
  assert.throws(() => noteText({ noteText: "ﬃ".repeat(50) }));
});
test("pagination preserves PostgreSQL microseconds and rejects malformed cursors", () => {
  const cursor = { id: "81000000-0000-0000-0000-000000000001", createdAt: "2026-09-29T12:00:00.123456+00:00" };
  assert.deepEqual(parseCursor(Buffer.from(JSON.stringify(cursor)).toString("base64url")), cursor);
  assert.equal(parseCursor(null), null);
  for (const value of ["?", "x".repeat(257), Buffer.from('{"id":"bad"}').toString("base64url")]) assert.throws(() => parseCursor(value));
  assert.equal(isUuid("../private"), false);
});
