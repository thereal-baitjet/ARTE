import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog.ts";
import { getPublicRecommendationPage } from "../../lib/recommendations/pageCache.ts";

test("cached public pagination returns the entire real catalog once", () => {
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = getPublicRecommendationPage([], [], cursor, 8);
    assert.equal(page.validCursor, true);
    for (const item of page.items) {
      assert.equal(item.isDemo, false);
      assert.equal(seen.has(item.id), false);
      seen.add(item.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(seen.size, PUBLIC_ARTWORKS.length);
});

test("cached rankings isolate different hidden-work selections", () => {
  const first = getPublicRecommendationPage([], [], null, 8);
  const hidden = first.items[0].id;
  const other = getPublicRecommendationPage([], [hidden], null, 8);
  assert.equal(other.items.some((item) => item.id === hidden), false);
  assert.deepEqual(getPublicRecommendationPage([], [], null, 8), first);
  assert.equal(getPublicRecommendationPage([], [], "invalid-cursor").validCursor, false);
});
