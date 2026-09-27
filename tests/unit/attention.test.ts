import assert from "node:assert/strict";
import test from "node:test";
import type { AnalyticsEvent, AnalyticsEventType } from "../../lib/analytics/types.ts";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import { buildAttentionRanking, mostSavedAttention } from "../../lib/trending/attention.ts";

const NOW = Date.parse("2026-09-27T20:00:00.000Z");
function event(id: string, eventType: AnalyticsEventType, daysAgo = 0): AnalyticsEvent {
  return { id, eventType, artworkId: DEMO_ARTWORKS[0].id, anonymousSessionId: "one-session", source: "test", timestamp: new Date(NOW - daysAgo * 86400000).toISOString() };
}

test("attention has no invented popularity in an empty history", () => {
  assert.deepEqual(buildAttentionRanking([], DEMO_ARTWORKS, NOW), []);
});

test("attention rejects future, malformed and expired activity", () => {
  const input = [event("future", "artwork_save", -1), event("old", "artwork_save", 31), { ...event("invalid", "artwork_save"), timestamp: "invalid" }];
  assert.deepEqual(buildAttentionRanking(input, DEMO_ARTWORKS, NOW), []);
});

test("attention deduplicates repeat opens and visible/impression pairs in the same session day", () => {
  const single = buildAttentionRanking([event("open-1", "artwork_detail_open"), event("view", "artwork_impression")], DEMO_ARTWORKS, NOW);
  const duplicate = buildAttentionRanking([event("open-1", "artwork_detail_open"), event("open-2", "artwork_detail_open"), event("view", "artwork_impression"), event("visible", "artwork_visible")], DEMO_ARTWORKS, NOW);
  assert.deepEqual(duplicate, single);
});

test("attention decays to half its weight after seven days", () => {
  const fresh = buildAttentionRanking([event("fresh", "artwork_share")], DEMO_ARTWORKS, NOW)[0];
  const older = buildAttentionRanking([event("older", "artwork_share", 7)], DEMO_ARTWORKS, NOW)[0];
  assert.equal(older.score, fresh.score / 2);
});

test("most saved counts active saves once per session and respects unsave", () => {
  const saved = [event("save-1", "artwork_save", 2), event("save-2", "artwork_save", 1)];
  const ranking = buildAttentionRanking(saved, DEMO_ARTWORKS, NOW);
  assert.equal(ranking[0].saveCount, 1);
  assert.equal(mostSavedAttention(ranking).length, 1);
  assert.deepEqual(mostSavedAttention(buildAttentionRanking([...saved, event("unsave", "artwork_unsave")], DEMO_ARTWORKS, NOW)), []);
});

test("dwell weight is capped and accidental brief views add no dwell score", () => {
  const maximal = { ...event("dwell", "artwork_dwell"), payload: { durationMs: 30000 } };
  const excessive = { ...maximal, payload: { durationMs: 999999999 } };
  assert.equal(buildAttentionRanking([maximal], DEMO_ARTWORKS, NOW)[0].score, buildAttentionRanking([excessive], DEMO_ARTWORKS, NOW)[0].score);
  assert.deepEqual(buildAttentionRanking([{ ...maximal, payload: { durationMs: 500 } }], DEMO_ARTWORKS, NOW), []);
});
