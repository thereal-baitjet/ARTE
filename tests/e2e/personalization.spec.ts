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
  const source = page.locator('[data-artwork-slug="quiet-red-study-demo"]');
  await expect(source).toBeVisible();
  await source.locator('[data-action="like"]').click();
  await source.locator('[data-action="save"]').click();
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(async () => page.locator("[data-artwork-id]").first().getAttribute("data-artwork-slug")).not.toBe("quiet-red-study-demo");
  await expect(page.locator("[data-artwork-id]").first()).not.toHaveAttribute("data-recommendation-signals", "discoveryScore");
});

test("hidden artwork does not immediately return", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const source = page.locator('[data-artwork-slug="quiet-red-study-demo"]');
  await source.getByRole("button", { name: "Hide / Not for me" }).click();
  await expect(source).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-artwork-slug="quiet-red-study-demo"]')).toHaveCount(0);
});

test("why-this copy is tied to exposed scoring signals", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const source = page.locator('[data-artwork-slug="quiet-red-study-demo"]');
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
  await expect(page.getByTestId("similarity-result").first()).toContainText("Shared palette:");
  await page.getByRole("button", { name: "Unexpected Connection" }).click();
  await expect(page.getByTestId("similarity-result").first()).toContainText(/unexpected|intentional contrast/i);
});

test("recommendation endpoint rejects invalid cursors", async ({ request }) => {
  const response = await request.post("/api/recommendations", { data: { events: [], hiddenArtworkIds: [], cursor: "missing-cursor", limit: 4 } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid recommendation cursor." });
});
