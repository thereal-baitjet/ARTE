import { expect, test } from "@playwright/test";

const visualViewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const viewport of visualViewports) {
  test(`discover feed renders without console errors at ${viewport.name}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/discover", { waitUntil: "networkidle" });
    await expect(page.locator("[data-artwork-id]").first()).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`discover-${viewport.name}`, { body: screenshot, contentType: "image/png" });
    expect(errors).toEqual([]);
  });
}

test("cursor pagination appends unique artworks", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  await expect(page.locator("[data-artwork-id]")).toHaveCount(4);
  await page.locator("[data-feed-sentinel]").scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator("[data-artwork-id]").count()).toBeGreaterThan(4);
  const ids = await page.locator("[data-artwork-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-artwork-id")));
  expect(new Set(ids).size).toBe(ids.length);
});

test("guest likes and saves persist across reload even when the feed adapts", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const first = page.locator("[data-artwork-id]").first();
  const artworkId = await first.getAttribute("data-artwork-id");
  expect(artworkId).toBeTruthy();
  await first.locator('[data-action="like"]').click();
  await first.locator('[data-action="save"]').click();
  await page.reload({ waitUntil: "networkidle" });
  const restored = page.locator(`[data-artwork-id="${artworkId}"]`);
  if (!(await restored.count())) {
    await page.locator("[data-feed-sentinel]").scrollIntoViewIfNeeded();
    await expect.poll(async () => page.locator(`[data-artwork-id="${artworkId}"]`).count()).toBeGreaterThan(0);
  }
  await expect(page.locator(`[data-artwork-id="${artworkId}"]`).locator('[data-action="like"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-artwork-id="${artworkId}"]`).locator('[data-action="save"]')).toHaveAttribute("aria-pressed", "true");
});

test("artwork and artist routes work and feed position is restored", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const second = page.locator("[data-artwork-id]").nth(1);
  const artworkHref = await second.getByRole("link", { name: "View artwork" }).getAttribute("href");
  await second.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await second.getByRole("link", { name: "View artwork" }).click();
  await expect(page).toHaveURL(new RegExp(`${artworkHref}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack({ waitUntil: "networkidle" });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const currentSecond = page.locator("[data-artwork-id]").nth(1);
  await currentSecond.getByRole("link", { name: "View artist" }).click();
  await expect(page).toHaveURL(/\/artist\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("missing artwork imagery has an intentional fallback", async ({ page }) => {
  await page.goto("/artwork/image-awaiting-clearance-demo", { waitUntil: "networkidle" });
  await expect(page.getByTestId("artwork-visual-missing")).toBeVisible();
  await expect(page.getByText("Rights review in progress")).toBeVisible();
});

test("invalid feed cursors fail safely", async ({ request }) => {
  const response = await request.get("/api/feed?cursor=not-a-real-cursor&limit=4");
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid feed cursor." });
});

test("keyboard navigation advances the feed", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test("hiding the pagination cursor still loads the rest of the gallery", async ({ page }) => {
  const failedResponses: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/recommendations") && !response.ok()) failedResponses.push(response.status());
  });
  await page.goto("/discover", { waitUntil: "networkidle" });
  await expect(page.locator("[data-artwork-id]")).toHaveCount(4);
  const last = page.locator("[data-artwork-id]").last();
  const hiddenId = await last.getAttribute("data-artwork-id");
  // Invoke the button before scrolling near the sentinel can load the next page.
  await last.getByRole("button", { name: "Hide / Not for me" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(`[data-artwork-id="${hiddenId}"]`)).toHaveCount(0);
  await page.locator("[data-feed-sentinel]").scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator("[data-artwork-id]").count()).toBeGreaterThan(4);
  expect(failedResponses).toEqual([]);
});
