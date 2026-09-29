import assert from "node:assert/strict";
import test from "node:test";
import { accountEvent, accountHiddenArtworkIds, composeAccountActivity, mergeAccountEvents, quarantineLegacyActivity, updateAccountChoices, type AccountChoices } from "../../lib/analytics/account.ts";
import type { AnalyticsEvent } from "../../lib/analytics/types.ts";

const owner = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";
const empty: AccountChoices = { likes: [], saves: [], follows: [] };
const event = (id: string, eventType: AnalyticsEvent["eventType"] = "artwork_detail_open", userId: string | null = owner): AnalyticsEvent => ({ id, userId, eventType, anonymousSessionId: "session", artworkId: "artwork-1", source: "test", timestamp: "2026-09-29T12:00:00.000Z" });

test("account history rejects guest and other-account activity, including valid-looking rows", () => {
  const mapped = { id: "event-1", user_id: owner, event_type: "artwork_detail_open", artwork_id: "artwork-1", source: "test", created_at: "2026-09-29T12:00:00.000Z", payload: {} };
  assert.equal(accountEvent(mapped, other), null);
  assert.equal(accountEvent({ ...mapped, user_id: null }, owner), null);
  assert.equal(accountEvent({ ...mapped, event_type: "invalid" }, owner), null);
  assert.equal(accountEvent(mapped, owner)?.userId, owner);
  assert.deepEqual(mergeAccountEvents(owner, [event("guest", "artwork_like", null), event("another", "artwork_like", other), event("own")]).map(({ id }) => id), ["own"]);
});

test("a local event returned by the server contributes only once after hydration", () => {
  const interaction = event("same-id");
  const merged = mergeAccountEvents(owner, [interaction], [{ ...interaction }]);
  assert.equal(merged.length, 1);
  assert.equal(composeAccountActivity(owner, merged, empty).length, 1);
});

test("fresh-device current choices shape taste once and supersede historical toggles", () => {
  const choices: AccountChoices = { likes: [{ id: "artwork-1", createdAt: event("x").timestamp }], saves: [{ id: "artwork-2", createdAt: event("x").timestamp }], follows: [{ id: "artist-1", createdAt: event("x").timestamp }] };
  const history = [event("like-first", "artwork_like"), event("unlike", "artwork_unlike"), event("like-again", "artwork_like")];
  const hydrated = composeAccountActivity(owner, history, choices);
  assert.equal(hydrated.length, 3);
  assert.equal(hydrated.filter(({ eventType }) => eventType === "artwork_like").length, 1);
  assert.deepEqual(composeAccountActivity(owner, [], choices), hydrated);
  assert.deepEqual(composeAccountActivity(other, history, empty), []);
});

test("successful unlike removes the persistent preference immediately without a negative duplicate", () => {
  const liked = updateAccountChoices(empty, event("like", "artwork_like"));
  assert.equal(liked.likes.length, 1);
  const unliked = updateAccountChoices(liked, event("unlike", "artwork_unlike"));
  assert.equal(unliked.likes.length, 0);
  assert.deepEqual(composeAccountActivity(owner, [event("like", "artwork_like"), event("unlike", "artwork_unlike")], unliked), []);
  assert.deepEqual(empty, { likes: [], saves: [], follows: [] });
});

test("account calculations stay bounded while preserving current explicit preferences", () => {
  const history = Array.from({ length: 600 }, (_, index) => ({ ...event(`event-${index}`), timestamp: new Date(Date.UTC(2026, 8, 29, 12, 0, index)).toISOString() }));
  const likes = Array.from({ length: 500 }, (_, index) => ({ id: `artwork-${index}`, createdAt: "2026-09-29T12:00:00.000Z" }));
  assert.equal(mergeAccountEvents(owner, history).length, 500);
  const summary = composeAccountActivity(owner, history, { ...empty, likes });
  assert.equal(summary.length, 500);
  assert.ok(summary.every(({ eventType }) => eventType === "artwork_like"));
  const bounded = composeAccountActivity(owner, history, { ...empty, likes: likes.slice(0, 1) });
  assert.equal(bounded.length, 500);
  assert.equal(bounded.filter(({ eventType }) => eventType === "artwork_like").length, 1);
});


test("ambiguous legacy history is archived and cannot reappear as guest history after account sign-out", () => {
  const entries = new Map<string, string>([
    ["arte:analytics:events", JSON.stringify([event("legacy", "artwork_like", null)])],
    ["arte:guest:hidden", '["old-hidden"]'], ["arte:analytics:anonymous-session", "old-session"],
    ["arte:guest:likes", '["guest-like"]'], ["arte:guest:saves", '["guest-save"]'],
    ["arte:guest:collections", '["guest-collection"]'], ["arte:analytics:personalization-enabled", "false"],
  ]);
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
  quarantineLegacyActivity(storage);
  assert.equal(storage.getItem("arte:analytics:events"), null);
  assert.equal(storage.getItem("arte:guest:hidden"), null);
  assert.equal(storage.getItem("arte:analytics:anonymous-session"), null);
  assert.match(storage.getItem("arte:analytics:legacy-v1")!, /legacy/);
  assert.equal(storage.getItem("arte:guest:likes"), '["guest-like"]');
  assert.equal(storage.getItem("arte:guest:saves"), '["guest-save"]');
  assert.equal(storage.getItem("arte:guest:collections"), '["guest-collection"]');
  assert.equal(storage.getItem("arte:analytics:personalization-enabled"), "false");
  storage.setItem("arte:analytics:events", '["new-explicit-guest-activity"]');
  quarantineLegacyActivity(storage);
  assert.equal(storage.getItem("arte:analytics:events"), '["new-explicit-guest-activity"]');
});


test("hidden works remain excluded beyond the 500-event activity window and reject another owner", () => {
  const oldHide = { ...event("old-hide", "artwork_hide"), timestamp: "2025-01-01T00:00:00.000Z" };
  const newer = Array.from({ length: 500 }, (_, index) => event(`newer-${index}`));
  assert.ok(!mergeAccountEvents(owner, [oldHide], newer).some(({ id }) => id === "old-hide"));
  const row = { id: oldHide.id, user_id: owner, event_type: "artwork_hide", artwork_id: oldHide.artworkId, created_at: oldHide.timestamp };
  assert.deepEqual(accountHiddenArtworkIds(owner, [row, { ...row, user_id: other, artwork_id: "another-user-work" }], []), ["artwork-1"]);
  const recent = { ...event("recent-hide", "artwork_hide"), artworkId: "new-hidden-work" };
  assert.deepEqual(accountHiddenArtworkIds(owner, [row, row], [recent]), ["new-hidden-work", "artwork-1"]);
  assert.deepEqual(accountHiddenArtworkIds(owner, [], []), []);
});
