import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import type { AnalyticsEvent, AnalyticsEventType } from "../../lib/analytics/types.ts";
import { buildTasteProfile, getRecommendationPage, rankArtworks } from "../../lib/recommendations/engine.ts";
import { findSimilarArtworks } from "../../lib/recommendations/similarity.ts";

function event(eventType: AnalyticsEventType, artworkId: string, index: number): AnalyticsEvent {
  const artwork = DEMO_ARTWORKS.find((candidate) => candidate.id === artworkId);
  return {
    id: `event-${index}`,
    eventType,
    anonymousSessionId: "test-session",
    artworkId,
    artistId: artwork?.artist.id,
    source: "test",
    timestamp: `2026-09-27T20:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

const source = DEMO_ARTWORKS[0];
const strongPreference = [event("artwork_like", source.id, 1), event("artwork_save", source.id, 2)];

test("recommendation rankings are deterministic", () => {
  const profile = buildTasteProfile(strongPreference, DEMO_ARTWORKS);
  const first = rankArtworks(DEMO_ARTWORKS, profile).map(({ id }) => id);
  const second = rankArtworks(DEMO_ARTWORKS, profile).map(({ id }) => id);
  assert.deepEqual(first, second);
});

test("strong behavior changes the default ranking toward connected work", () => {
  const baseline = rankArtworks(DEMO_ARTWORKS, buildTasteProfile([], DEMO_ARTWORKS));
  const personalized = rankArtworks(DEMO_ARTWORKS, buildTasteProfile(strongPreference, DEMO_ARTWORKS));
  assert.notDeepEqual(personalized.slice(0, 4).map(({ id }) => id), baseline.slice(0, 4).map(({ id }) => id));
  assert.notEqual(personalized[0].id, source.id, "the already-consumed source should receive a seen penalty");
  const top = personalized[0];
  const connected = top.artist.id === source.artist.id || top.movement === source.movement || top.features.palette.some((value) => source.features.palette.includes(value));
  assert.equal(connected, true);
});

test("diversity constraints prevent adjacent artist repetition", () => {
  const ranked = rankArtworks(DEMO_ARTWORKS, buildTasteProfile(strongPreference, DEMO_ARTWORKS));
  for (let index = 1; index < ranked.length; index += 1) {
    assert.notEqual(ranked[index].artist.id, ranked[index - 1].artist.id);
  }
  assert.ok(new Set(ranked.slice(0, 6).map(({ artist }) => artist.id)).size >= 3);
});

test("hidden artwork is excluded and does not return in later pages", () => {
  const hiddenId = DEMO_ARTWORKS[1].id;
  const profile = buildTasteProfile([event("artwork_hide", hiddenId, 3)], DEMO_ARTWORKS);
  const ranked = rankArtworks(DEMO_ARTWORKS, profile);
  assert.equal(ranked.some(({ id }) => id === hiddenId), false);
  const firstPage = getRecommendationPage(ranked, null, 4);
  const secondPage = getRecommendationPage(ranked, firstPage.nextCursor, 4);
  assert.equal([...firstPage.items, ...secondPage.items].some(({ id }) => id === hiddenId), false);
});

test("recommendation explanations expose the scoring signals they describe", () => {
  const ranked = rankArtworks(DEMO_ARTWORKS, buildTasteProfile(strongPreference, DEMO_ARTWORKS));
  const explanation = ranked[0].recommendation.explanation;
  assert.ok(explanation.signals.length > 0);
  for (const signal of explanation.signals) {
    assert.ok(signal.value >= 0);
    if (signal.feature) assert.match(explanation.text.toLowerCase(), new RegExp(signal.feature.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("similarity modes produce evidence-based connections", () => {
  const palette = findSimilarArtworks(source, DEMO_ARTWORKS, "palette");
  assert.ok(palette.length > 0);
  assert.equal(palette[0].connection.signals[0].label, "Palette");
  assert.match(palette[0].connection.text, /Shared palette:/);

  const unexpected = findSimilarArtworks(source, DEMO_ARTWORKS, "unexpected");
  assert.ok(unexpected.length > 0);
  assert.equal(unexpected[0].connection.signals[0].key, "contrast");
});
