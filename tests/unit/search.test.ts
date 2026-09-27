import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import { EMPTY_SEARCH_FILTERS, MAX_SEARCH_LENGTH, getSearchFacets, parseSearchState, searchArtworks, searchStateToParams } from "../../lib/search/engine.ts";

test("blank searches show the real catalog once in its original order", () => {
  assert.deepEqual(searchArtworks(DEMO_ARTWORKS, "").map(({ artwork }) => artwork.id), DEMO_ARTWORKS.map(({ id }) => id));
});

test("title, artist, and descriptive queries return evidence-backed matches", () => {
  assert.equal(searchArtworks(DEMO_ARTWORKS, "Night Window")[0]?.artwork.slug, "night-window-demo");
  assert.equal(searchArtworks(DEMO_ARTWORKS, "MARIS VALE").length, 3);
  const results = searchArtworks(DEMO_ARTWORKS, "show me a calm blue landscape");
  assert.deepEqual(results.map(({ artwork }) => artwork.slug), ["blue-interval-demo"]);
  assert.ok(results[0].matches.some(({ label, value }) => label === "Mood" && value === "calm"));
  assert.ok(results[0].matches.some(({ label, value }) => label === "Subject" && value === "landscape"));
});

test("bounded typo tolerance handles a typo or transposition without accepting unrelated queries", () => {
  const result = searchArtworks(DEMO_ARTWORKS, "gardne after rain")[0];
  assert.equal(result?.artwork.slug, "garden-after-rain-demo");
  assert.deepEqual(result.corrections, [{ from: "gardne", to: "garden" }]);
  assert.equal(searchArtworks(DEMO_ARTWORKS, "grdnnn").length, 0);
  assert.equal(searchArtworks(DEMO_ARTWORKS, "zz").length, 0);
  assert.equal(searchArtworks(DEMO_ARTWORKS, "blue submarine").length, 0);
});

test("all selected filters intersect with the query and each other", () => {
  const results = searchArtworks(DEMO_ARTWORKS, "form", { ...EMPTY_SEARCH_FILTERS, movement: "Demo Minimalism", palette: "blue", orientation: "square" });
  assert.deepEqual(results.map(({ artwork }) => artwork.slug), ["meridian-demo"]);
  assert.equal(searchArtworks(DEMO_ARTWORKS, "", { ...EMPTY_SEARCH_FILTERS, artist: "maris-vale-demo", mood: "energetic" }).length, 0);
});

test("facets derive solely from searchable records", () => {
  const facets = getSearchFacets(DEMO_ARTWORKS);
  assert.ok(facets.artists.length >= 20);
  assert.ok(facets.palettes.includes("oxblood"));
  assert.deepEqual(facets.orientations, ["landscape", "portrait", "square"]);
});

test("URL state round trips and discards unsupported filters with bounded input", () => {
  const state = { query: "calm blue", filters: { ...EMPTY_SEARCH_FILTERS, palette: "blue" } };
  assert.deepEqual(parseSearchState(searchStateToParams(state), DEMO_ARTWORKS), state);
  const invalid = parseSearchState(new URLSearchParams({ q: "x".repeat(500), palette: "unknown", orientation: "huge" }), DEMO_ARTWORKS);
  assert.equal(invalid.query.length, MAX_SEARCH_LENGTH);
  assert.equal(invalid.filters.palette, "");
  assert.equal(invalid.filters.orientation, "");
});
