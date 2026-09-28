import { expect, test } from "@playwright/test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";

const legacyId = "30000000-0000-0000-0000-000000000001";
const events = PUBLIC_ARTWORKS.slice(0, 25).map((artwork, index) => ({ id: `bounded-test-${index}`, eventType: "artwork_save", artworkId: artwork.id, anonymousSessionId: "bounded-test", source: "test", timestamp: new Date().toISOString() }));

test("taste and attention calculate bounded guest histories without returning the catalog", async ({ request }) => {
  const taste = await request.post("/api/taste", { data: { events } });
  expect(taste.status()).toBe(200);
  expect(taste.headers()["cache-control"]).toContain("no-store");
  expect(taste.headers()["set-cookie"]).toBeUndefined();
  const summary = await taste.json();
  expect(summary.eventCount).toBe(25);
  expect(summary.dimensions).toHaveLength(6);
  expect(summary.items).toBeUndefined();
  expect(summary.dimensions.every((dimension: { signals: unknown[] }) => dimension.signals.length <= 3)).toBe(true);
  const attention = await request.post("/api/attention", { data: { events, hiddenArtworkIds: [], mode: "saved" } });
  expect(attention.status()).toBe(200);
  expect(attention.headers()["cache-control"]).toContain("no-store");
  expect(attention.headers()["set-cookie"]).toBeUndefined();
  const ranking = await attention.json();
  expect(ranking.total).toBe(25);
  expect(ranking.items).toHaveLength(20);
  for (const { artwork } of ranking.items) {
    expect(artwork.features).toBeUndefined();
    expect(artwork.description).toBeUndefined();
    expect(artwork.rights).toBeUndefined();
    expect(artwork.artist.biography).toBeUndefined();
    expect(artwork.visual.kind).toBe("image");
  }
  for (const endpoint of ["/api/taste", "/api/attention"]) {
    expect((await request.post(endpoint, { data: { events: Array(501).fill(events[0]) } })).status()).toBe(400);
    expect((await request.post(endpoint, { data: { events: [{ ...events[0], payload: { nested: {} } }] } })).status()).toBe(400);
    expect((await request.post(endpoint, { data: { events: [], extra: "x".repeat(524288) } })).status()).toBe(413);
  }
});

test("public choices are bounded real summaries; legacy work resolves only by explicit lookup ID", async ({ request }) => {
  const response = await request.get("/api/artworks/choices?limit=20");
  expect(response.status()).toBe(200);
  const first = await response.json();
  expect(first.items).toHaveLength(20);
  expect(first.items.every((artwork: { id: string; visual: { kind: string } }) => artwork.visual.kind === "image" && artwork.id !== legacyId)).toBe(true);
  expect(first.items[0].features).toBeUndefined();
  expect((await request.get("/api/artworks/choices?limit=21")).status()).toBe(400);
  expect((await request.get("/api/artworks/choices?cursor=missing")).status()).toBe(400);
  const second = await (await request.get(`/api/artworks/choices?cursor=${first.nextCursor}&limit=20`)).json();
  expect(second.items).toHaveLength(20);
  expect(second.items.some((artwork: { id: string }) => first.items.some((prior: { id: string }) => prior.id === artwork.id))).toBe(false);
  const empty = await (await request.post("/api/artworks/lookup", { data: { ids: [] } })).json();
  expect(empty.items).toEqual([]);
  const legacy = await request.post("/api/artworks/lookup", { data: { ids: [legacyId, first.items[0].id, "unavailable-id"] } });
  expect(legacy.status()).toBe(200);
  const saved = await legacy.json();
  expect(saved.items.map((artwork: { id: string }) => artwork.id)).toEqual([legacyId, first.items[0].id]);
  expect(saved.missingIds).toEqual(["unavailable-id"]);
  expect(saved.items[0].title).toContain("Demo");
  expect((await request.post("/api/artworks/lookup", { data: { ids: Array(41).fill(legacyId) } })).status()).toBe(400);
});

test("local reset clears a previously calculated taste card even when calculation is unavailable", async ({ page }) => {
  await page.goto("/taste");
  await page.evaluate((activity) => localStorage.setItem("arte:analytics:events", JSON.stringify(activity)), events.slice(0, 1));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("taste-card")).toContainText("1 weighted activity signals");
  await expect(page.getByRole("button", { name: "Share taste card" })).toBeEnabled();
  await page.route("**/api/taste", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await page.getByRole("button", { name: "Reset local recommendations" }).click();
  await page.getByRole("button", { name: "Confirm local reset" }).click();
  await expect(page.getByTestId("taste-card")).toContainText("0 weighted activity signals");
  await expect(page.getByRole("button", { name: "Share taste card" })).toBeDisabled();
});
