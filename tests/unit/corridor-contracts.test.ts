import assert from "node:assert/strict";
import test from "node:test";
import { corridorEligibility, corridorNote, corridorPage } from "../../lib/corridor/contracts.ts";

const own = {
  id: "81000000-0000-0000-0000-000000000001", noteText: "A pause in the light.",
  createdAt: "2026-09-29T12:00:00.123456+00:00", updatedAt: "2026-09-29T12:01:00+00:00", isOwn: true,
};

test("the hosted one-row access contract grants only an explicit boolean", () => {
  assert.equal(corridorEligibility(true), true);
  assert.equal(corridorEligibility(false), false);
  assert.equal(corridorEligibility([{ has_access: true, note: "private" }]), true);
  assert.equal(corridorEligibility([{ has_access: false, note: null }]), false);
  for (const value of ["true", 1, null, [], [{ has_access: "true" }], [{ has_access: true }, { has_access: false }]]) {
    assert.throws(() => corridorEligibility(value), /Unexpected Shared Corridor response/);
  }
});

test("note DTOs strip identifiers and metadata while preserving cursor precision", () => {
  assert.deepEqual(corridorNote({ ...own, user_id: "private-owner", email: "private@example.test" }), own);
  const cursor = { id: own.id, createdAt: own.createdAt };
  assert.deepEqual(corridorPage({ notes: [own], ownNote: own, nextCursor: cursor, members: ["private-owner"] }), {
    notes: [own], ownNote: own, nextCursor: cursor,
  });
  assert.deepEqual(corridorPage({ notes: [], ownNote: null, nextCursor: null }), { notes: [], ownNote: null, nextCursor: null });
});

test("malformed pages produce a recoverable contract error instead of a UI crash", () => {
  for (const value of [[], null, { notes: [] }, { notes: null, ownNote: null, nextCursor: null },
    { notes: [own], ownNote: { ...own, isOwn: false }, nextCursor: null },
    { notes: Array(7).fill(own), ownNote: null, nextCursor: null },
    { notes: [], ownNote: null, nextCursor: { id: "invalid", createdAt: own.createdAt } }]) {
    assert.throws(() => corridorPage(value), /Unexpected Shared Corridor response/);
  }
  assert.throws(() => corridorNote({ ...own, noteText: "🌿".repeat(141) }));
});
