import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog.ts";
import { getSearchPage, parseSearchLimit, SearchRequestError } from "../../lib/search/pagination.ts";
import { DEFAULT_SEARCH_PAGE_SIZE, MAX_SEARCH_PAGE_SIZE } from "../../lib/search/state.ts";
import { EMPTY_SEARCH_FILTERS, MAX_SEARCH_LENGTH, getSearchFacets, parseSearchState, searchArtworks, searchStateToParams } from "../../lib/search/engine.ts";

test("blank searches show the real catalog once in its original order", () => {
  assert.deepEqual(searchArtworks(DEMO_ARTWORKS, "").map(({ artwork }) => artwork.id), DEMO_ARTWORKS.map(({ id }) => id));
});

test("public pagination excludes fixtures, caps payloads, and serializes only card fields", () => {
  const state = { query: "", filters: { ...EMPTY_SEARCH_FILTERS } };
  const page = getSearchPage(DEMO_ARTWORKS, state, null, 10000);
  assert.equal(page.results.length, MAX_SEARCH_PAGE_SIZE);
  assert.equal(page.total, PUBLIC_ARTWORKS.length);
  assert.equal(page.catalogTotal, PUBLIC_ARTWORKS.length);
  for (const { artwork } of page.results) {
    assert.equal(artwork.slug.endsWith("-demo"), false);
    assert.equal("description" in artwork, false);
    assert.equal("features" in artwork, false);
    assert.equal("rights" in artwork, false);
    assert.equal("biography" in artwork.artist, false);
  }
  assert.ok(JSON.stringify(page).length < 64000);
});

test("successive public pages contain the catalog once without duplicates", () => {
  const state = { query: "", filters: { ...EMPTY_SEARCH_FILTERS } };
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const page = getSearchPage(PUBLIC_ARTWORKS, state, cursor);
    assert.ok(page.results.length <= DEFAULT_SEARCH_PAGE_SIZE);
    ids.push(...page.results.map(({ artwork }) => artwork.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(ids, PUBLIC_ARTWORKS.map(({ id }) => id));
  assert.equal(new Set(ids).size, ids.length);
});

test("public cursors reject malformed, stale-query, and changed-limit requests", () => {
  const state = { query: "", filters: { ...EMPTY_SEARCH_FILTERS } };
  const { nextCursor } = getSearchPage(PUBLIC_ARTWORKS, state);
  assert.ok(nextCursor);
  assert.throws(() => getSearchPage(PUBLIC_ARTWORKS, state, "not-a-cursor"), SearchRequestError);
  assert.throws(() => getSearchPage(PUBLIC_ARTWORKS, { ...state, query: "flowers" }, nextCursor), SearchRequestError);
  assert.throws(() => getSearchPage(PUBLIC_ARTWORKS, state, nextCursor, 24), SearchRequestError);
  assert.equal(parseSearchLimit(null), DEFAULT_SEARCH_PAGE_SIZE);
  assert.equal(parseSearchLimit("999999"), MAX_SEARCH_PAGE_SIZE);
  for (const invalid of ["0", "-1", "1.5", "NaN", ""]) assert.throws(() => parseSearchLimit(invalid), SearchRequestError);
});

test("public descriptive search retains evidence and excludes synthetic identities", () => {
  const state = { query: "Vincent van Gogh", filters: { ...EMPTY_SEARCH_FILTERS } };
  const page = getSearchPage(PUBLIC_ARTWORKS, state);
  assert.ok(page.total > 0);
  assert.ok(page.results.every(({ matches }) => matches.some(({ label, value }) => label === "Artist" && value.includes("van Gogh"))));
  const syntheticQuery = { ...state, query: "Maris Vale" };
  const filtered = getSearchPage(DEMO_ARTWORKS, syntheticQuery);
  const expected = getSearchPage(PUBLIC_ARTWORKS, syntheticQuery);
  const syntheticIds = new Set(DEMO_ARTWORKS.filter(({ isDemo }) => isDemo).map(({ id }) => id));
  assert.deepEqual(filtered.results.map(({ artwork }) => artwork.id), expected.results.map(({ artwork }) => artwork.id));
  assert.equal(filtered.results.some(({ artwork }) => syntheticIds.has(artwork.id)), false);
});

test("title, artist, and descriptive queries return evidence-backed matches", () => {
  assert.equal(searchArtworks(DEMO_ARTWORKS, "Night Window")[0]?.artwork.slug, "night-window-demo");
  const artistResults = searchArtworks(DEMO_ARTWORKS, "MARIS VALE");
  const artistWorks = DEMO_ARTWORKS.filter(({ artist }) => artist.slug === "maris-vale-demo");
  assert.deepEqual(artistResults.slice(0, artistWorks.length).map(({ artwork }) => artwork.id), artistWorks.map(({ id }) => id));
  assert.ok(artistResults.slice(0, artistWorks.length).every(({ matches }) => matches.some(({ label, value }) => label === "Artist" && value.includes("Maris Vale"))));
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
