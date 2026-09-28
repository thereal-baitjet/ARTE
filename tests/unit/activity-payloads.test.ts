import assert from "node:assert/strict";
import test from "node:test";
import { ActivityRequestError, readBoundedJson, validatedActivity } from "../../lib/activity/request.ts";
import { chooseOnboardingWorks } from "../../lib/taste/onboarding.ts";
import { artworkSummary } from "../../lib/artworks/summary.ts";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog.ts";
import { SYNTHETIC_ARTWORKS } from "../../lib/artworks/syntheticArtworks.ts";

const event = { id: "event", eventType: "artwork_like", artworkId: PUBLIC_ARTWORKS[0].id, anonymousSessionId: "session", source: "test", timestamp: "2026-09-27T00:00:00.000Z" };

test("activity calculations cap valid histories and reject malformed events", () => {
  assert.equal(validatedActivity({ events: Array(500).fill(event) }).events.length, 500);
  assert.throws(() => validatedActivity({ events: Array(501).fill(event) }), ActivityRequestError);
  assert.throws(() => validatedActivity({ events: [{ ...event, eventType: "arbitrary" }] }), ActivityRequestError);
  assert.throws(() => validatedActivity({ events: [event], hiddenArtworkIds: [1] }), ActivityRequestError);
});

test("request parsing caps real bytes even without Content-Length and rejects malformed JSON", async () => {
  await assert.rejects(readBoundedJson(new Request("https://example.test", { method: "POST", body: JSON.stringify({ events: "x".repeat(2000) }) }), 1024), (error: unknown) => error instanceof ActivityRequestError && error.status === 413);
  await assert.rejects(readBoundedJson(new Request("https://example.test", { method: "POST", body: "[1,2]" })), ActivityRequestError);
  assert.deepEqual(await readBoundedJson(new Request("https://example.test", { method: "POST", body: JSON.stringify({ events: [event] }) })), { events: [event] });
});

test("onboarding passes only twenty representative real works and card summaries exclude full metadata", () => {
  const choices = chooseOnboardingWorks([...SYNTHETIC_ARTWORKS, ...PUBLIC_ARTWORKS], 1000);
  assert.equal(choices.length, 20);
  assert.ok(choices.every((artwork) => !artwork.isDemo && artwork.visual.kind === "image"));
  assert.ok(new Set(choices.map((artwork) => artwork.artist.id)).size >= 10);
  assert.equal(new Set(choices.map((artwork) => artwork.id)).size, 20);
  const summary = artworkSummary(choices[0]);
  assert.deepEqual(Object.keys(summary).sort(), ["artist", "id", "medium", "slug", "title", "visual", "year"]);
  assert.deepEqual(Object.keys(summary.artist).sort(), ["id", "name", "slug"]);
  assert.deepEqual(chooseOnboardingWorks(PUBLIC_ARTWORKS).map((work) => work.id), choices.map((work) => work.id));
});
