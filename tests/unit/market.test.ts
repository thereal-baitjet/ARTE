import assert from "node:assert/strict";
import test from "node:test";
import { canDraftInquiry, DEFAULT_FILTERS, DEMO_LISTINGS, filterListings, listingFreshness } from "../../lib/market/listings.ts";
import { createInquiryDraft, MAX_INQUIRY_LENGTH, parseInquiryDrafts } from "../../lib/market/drafts.ts";

const now = Date.parse("2026-09-27T12:00:00Z");
const listing = DEMO_LISTINGS[0];

test("demo inventory can never pass the verified-only filter", () => {
  assert.ok(DEMO_LISTINGS.every((item) => item.isDemo));
  assert.equal(filterListings(DEMO_LISTINGS, { ...DEFAULT_FILTERS, trust: "verified" }, now).length, 0);
});

test("budgets use a single currency and price-on-request remains distinct", () => {
  assert.deepEqual(filterListings(DEMO_LISTINGS, { ...DEFAULT_FILTERS, currency: "USD", price: "under1000" }, now).map(({ id }) => id), ["demo-quiet-red"]);
  assert.deepEqual(filterListings(DEMO_LISTINGS, { ...DEFAULT_FILTERS, price: "request" }, now).map(({ id }) => id), ["demo-form-three"]);
  assert.equal(filterListings(DEMO_LISTINGS, { ...DEFAULT_FILTERS, price: "under1000" }, now).length, 0);
  const boundary = { ...listing, priceCents: 100000 };
  assert.equal(filterListings([boundary], { ...DEFAULT_FILTERS, currency: "USD", price: "under1000" }, now).length, 0);
  assert.equal(filterListings([boundary], { ...DEFAULT_FILTERS, currency: "USD", price: "1000to5000" }, now).length, 1);
});

test("availability and fresh-only filters exclude expired samples", () => {
  const available = filterListings(DEMO_LISTINGS, { ...DEFAULT_FILTERS, availability: "available" }, now);
  assert.equal(available.length, 4);
  assert.equal(available.some(({ id }) => id === "demo-dust-gold"), false);
  const fresh = filterListings(DEMO_LISTINGS, { ...DEFAULT_FILTERS, currentOnly: true }, now);
  assert.equal(fresh.length, 4);
  assert.ok(fresh.every((item) => listingFreshness(item, now) === "current"));
});

test("inquiry drafts fail closed for expired, stale, future-dated, unverified and reserved records", () => {
  assert.equal(canDraftInquiry(listing, now), true);
  const restricted = [
    { ...listing, expiresAt: "2026-09-27T12:00:00Z" },
    { ...listing, expiresAt: "not a date" },
    { ...listing, checkedAt: "2026-08-01T00:00:00Z" },
    { ...listing, checkedAt: "2026-10-01T00:00:00Z" },
    { ...listing, checkedAt: null },
    { ...listing, status: "reserved" as const },
  ];
  for (const item of restricted) {
    assert.equal(canDraftInquiry(item, now), false);
    assert.throws(() => createInquiryDraft(item, "Interested in this work", now), /no longer available/);
  }
});

test("inquiry validation creates only bounded local draft records", () => {
  assert.throws(() => createInquiryDraft(listing, "   ", now), /Add a message/);
  assert.throws(() => createInquiryDraft(listing, "a".repeat(MAX_INQUIRY_LENGTH + 1), now), /within 2000/);
  const draft = createInquiryDraft(listing, "  Is a condition report available?  ", now);
  assert.equal(draft.status, "draft");
  assert.equal(draft.message, "Is a condition report available?");
  assert.deepEqual(parseInquiryDrafts(JSON.stringify([draft])), [draft]);
});

test("corrupt, oversized, or non-draft browser records are discarded", () => {
  assert.deepEqual(parseInquiryDrafts("broken json"), []);
  assert.deepEqual(parseInquiryDrafts('{"draft":true}'), []);
  const valid = createInquiryDraft(listing, "Hello", now);
  assert.deepEqual(parseInquiryDrafts(JSON.stringify([null, {}, { ...valid, status: "submitted" }, { ...valid, updatedAt: "bad" }, { ...valid, message: "a".repeat(2001) }, valid])), [valid]);
});
