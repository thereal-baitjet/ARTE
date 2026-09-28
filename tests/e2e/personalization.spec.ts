import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("explicit preference signals adapt the next feed refresh", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const source = page.locator("[data-artwork-id]").first();
  const sourceSlug = await source.getAttribute("data-artwork-slug");
  expect(sourceSlug).toBeTruthy();
  await expect(source).toBeVisible();
  await source.locator('[data-action="like"]').click();
  await source.locator('[data-action="save"]').click();
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(async () => page.locator("[data-artwork-id]").first().getAttribute("data-artwork-slug")).not.toBe(sourceSlug);
  await expect(page.locator("[data-artwork-id]").first()).not.toHaveAttribute("data-recommendation-signals", "discoveryScore");
});

test("hidden artwork does not immediately return", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const first = page.locator("[data-artwork-id]").first();
  const artworkId = await first.getAttribute("data-artwork-id");
  expect(artworkId).toBeTruthy();
  const source = page.locator(`[data-artwork-id="${artworkId}"]`);
  await source.getByRole("button", { name: "Hide / Not for me" }).click();
  await expect(source).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(`[data-artwork-id="${artworkId}"]`)).toHaveCount(0);
});

test("why-this copy is tied to exposed scoring signals", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const source = page.locator("[data-artwork-id]").first();
  await source.locator('[data-action="like"]').click();
  await source.locator('[data-action="save"]').click();
  await page.reload({ waitUntil: "networkidle" });
  const first = page.locator("[data-artwork-id]").first();
  await first.getByText("Why this?").click();
  const explanation = first.getByTestId("why-this-explanation");
  await expect(explanation).toBeVisible();
  const signals = (await first.getAttribute("data-recommendation-signals"))?.split(",").filter(Boolean) ?? [];
  expect(signals.length).toBeGreaterThan(0);
  await expect(explanation.locator("li")).toHaveCount(signals.length);
});

test("More Like This modes disclose their actual connection", async ({ page }) => {
  await page.goto("/artwork/quiet-red-study-demo", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Similar Palette" }).click();
  await expect(page.getByTestId("similarity-result").first()).toContainText(/Shared palette:|Palette metadata is unavailable/);
  await page.getByRole("button", { name: "Unexpected Connection" }).click();
  await expect(page.getByTestId("similarity-result").first()).toContainText(/unexpected|intentional contrast/i);
});

test("recommendation endpoint rejects invalid cursors", async ({ request }) => {
  const response = await request.post("/api/recommendations", { data: { events: [], hiddenArtworkIds: [], cursor: "missing-cursor", limit: 4 } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid recommendation cursor." });
});

test("recommendations retain personalization and pagination after more than one hundred hidden works", async ({ request }) => {
  type CatalogItem = { id: string; artist: { id: string } };
  type FeedResponse = { items: CatalogItem[]; nextCursor: string | null };
  type RecommendationResponse = FeedResponse & { profileEventCount: number };
  const catalog: CatalogItem[] = [];
  let catalogCursor: string | null = null;
  do {
    const response = await request.get("/api/feed", { params: { limit: 8, ...(catalogCursor ? { cursor: catalogCursor } : {}) } });
    expect(response.status()).toBe(200);
    const page: FeedResponse = await response.json();
    catalog.push(...page.items);
    catalogCursor = page.nextCursor;
  } while (catalog.length < 102 && catalogCursor);
  expect(catalog.length).toBeGreaterThanOrEqual(102);

  const hiddenArtworkIds = catalog.slice(0, 101).map(({ id }) => id);
  const source = catalog[101];
  const events = [{
    id: "over-one-hundred-hidden", eventType: "artwork_like", anonymousSessionId: "large-gallery-test",
    artworkId: source.id, artistId: source.artist.id, source: "test", timestamp: new Date().toISOString(),
  }];
  const response = await request.post("/api/recommendations", { data: { events, hiddenArtworkIds, limit: 8 } });
  expect(response.status()).toBe(200);
  const first: RecommendationResponse = await response.json();
  expect(first.profileEventCount).toBe(1);
  expect(first.items).toHaveLength(8);
  expect(first.nextCursor).toBeTruthy();

  const nextResponse = await request.post("/api/recommendations", { data: { events, hiddenArtworkIds, cursor: first.nextCursor, limit: 8 } });
  expect(nextResponse.status()).toBe(200);
  const next: RecommendationResponse = await nextResponse.json();
  expect(next.profileEventCount).toBe(1);
  expect(next.items).toHaveLength(8);
  const returnedIds = [...first.items, ...next.items].map(({ id }: { id: string }) => id);
  expect(new Set(returnedIds).size).toBe(16);
  expect(returnedIds.some((id) => hiddenArtworkIds.includes(id))).toBe(false);
});

test("recommendation endpoint rejects hostile event types and oversized input", async ({ request }) => {
  const hostile = {
    id: "event-1", eventType: "artist_follow", anonymousSessionId: "test-session",
    source: "test", timestamp: "2026-09-27T20:00:00.000Z", artistId: { toString: null },
  };
  const invalid = await request.post("/api/recommendations", { data: { events: [hostile] } });
  expect(invalid.status()).toBe(400);
  const invalidLimit = await request.post("/api/recommendations", { data: { limit: 1.5 } });
  expect(invalidLimit.status()).toBe(400);
  const oversized = await request.post("/api/recommendations", { data: { ignored: "x".repeat(512 * 1024) } });
  expect(oversized.status()).toBe(413);
});
