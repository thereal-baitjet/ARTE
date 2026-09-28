import { expect, test, type Page } from "@playwright/test";

function recommendationRequests(page: Page) {
  const requests: Array<{ cursor: string | null; limit: number }> = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/recommendations") {
      requests.push(request.postDataJSON());
    }
  });
  return requests;
}

test("the gallery waits for forward scrolling and appends one small room near the end", async ({ page }) => {
  const requests = recommendationRequests(page);
  await page.goto("/discover", { waitUntil: "networkidle" });
  const works = page.locator("[data-artwork-id]");
  await expect(works).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Load more works", exact: true })).toBeEnabled();
  // Wait beyond the automatic cooldown: time alone must never request a page.
  await page.waitForTimeout(1_500);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ cursor: null, limit: 4 });

  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  expect(requests).toHaveLength(1);
  await expect(works).toHaveCount(4);

  const previousEnd = await page.locator("[data-feed-sentinel]").evaluate((sentinel) => {
    sentinel.scrollIntoView({ behavior: "instant", block: "end" });
    return window.scrollY;
  });
  await expect(works).toHaveCount(6);
  expect(requests).toHaveLength(2);
  expect(requests[1].cursor).toBeTruthy();
  expect(requests[1].limit).toBe(2);
  await page.waitForTimeout(1_500);
  await expect(works).toHaveCount(6);
  expect(requests).toHaveLength(2);
  // Adding works preserves the reader's position rather than following the
  // end button past the newly loaded room through browser scroll anchoring.
  expect(Math.abs(await page.evaluate(() => window.scrollY) - previousEnd)).toBeLessThan(2);

  // Reaching the new end after moving through the appended room permits one
  // further page, so the restraint does not strand normal gallery navigation.
  await page.locator("[data-feed-sentinel]").scrollIntoViewIfNeeded();
  await expect(works).toHaveCount(8);
  expect(requests).toHaveLength(3);
  const ids = await works.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-artwork-id")));
  expect(new Set(ids).size).toBe(8);
});

test("a continuously visible sentinel cannot cascade and keyboard manual loading remains available", async ({ page }) => {
  const requests = recommendationRequests(page);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      // Reproduce the dangerous layout condition independently of viewport or
      // image height: the observed end remains visible when records append.
      const style = document.createElement("style");
      style.textContent = "[data-feed-sentinel] { position: fixed !important; inset: auto 0 0 !important; z-index: 100; background: #faf8f3; }";
      document.head.append(style);
    }, { once: true });
  });
  await page.goto("/discover", { waitUntil: "networkidle" });
  const works = page.locator("[data-artwork-id]");
  await page.waitForTimeout(1_500);
  await expect(works).toHaveCount(4);
  expect(requests).toHaveLength(1);

  await page.mouse.wheel(0, 700);
  await expect(works).toHaveCount(6);
  await page.waitForTimeout(1_500);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1_500);
  await expect(works).toHaveCount(6);
  expect(requests).toHaveLength(2);

  const manual = page.getByRole("button", { name: "Load more works", exact: true });
  await manual.focus();
  await page.keyboard.press("Enter");
  await expect(works).toHaveCount(8);
  expect(requests).toHaveLength(3);
  expect(requests.slice(1).map(({ limit }) => limit)).toEqual([2, 2]);
});

test("a failed automatic page preserves the room and waits for an explicit retry", async ({ page }) => {
  const requests = recommendationRequests(page);
  let failNextPage = true;
  await page.route("**/api/recommendations", async (route) => {
    const body = route.request().postDataJSON() as { cursor: string | null };
    if (body.cursor && failNextPage) {
      failNextPage = false;
      await route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
    } else await route.continue();
  });
  await page.goto("/discover", { waitUntil: "networkidle" });
  await page.locator("[data-feed-sentinel]").scrollIntoViewIfNeeded();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("The next gallery room could not be loaded.");
  await expect(page.locator("[data-artwork-id]")).toHaveCount(4);
  await page.waitForTimeout(1_500);
  expect(requests).toHaveLength(2);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("[data-artwork-id]")).toHaveCount(6);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(requests).toHaveLength(3);
  expect(requests[2].cursor).toBe(requests[1].cursor);
});
