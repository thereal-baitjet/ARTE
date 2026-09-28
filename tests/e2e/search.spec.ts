import { expect, test } from "@playwright/test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";
import { DEFAULT_SEARCH_PAGE_SIZE, MAX_SEARCH_PAGE_SIZE } from "../../lib/search/state";

const firstMuseumWork = PUBLIC_ARTWORKS[0];

test("museum search survives refresh, opens the result, and records both search events", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await expect(page.getByTestId("search-result")).toHaveCount(DEFAULT_SEARCH_PAGE_SIZE);
  await page.getByRole("searchbox").fill(firstMuseumWork.title);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const result = page.getByTestId("search-result").filter({ has: page.getByRole("heading", { name: firstMuseumWork.title, exact: true }) });
  await expect(result).toBeVisible();
  await expect(page).toHaveURL(/q=/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("searchbox")).toHaveValue(firstMuseumWork.title);
  await result.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/artwork/${firstMuseumWork.slug}$`));
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]") as Array<{ eventType: string; artworkId: string | null }>);
  expect(events.some(({ eventType }) => eventType === "search_query")).toBe(true);
  expect(events.some(({ eventType, artworkId }) => eventType === "search_result_open" && artworkId === firstMuseumWork.id)).toBe(true);
});

test("public filters combine, preserve URL state, and recover from no results", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Artists", exact: true }).selectOption(firstMuseumWork.artist.slug);
  await expect(page.getByTestId("search-result").first()).toContainText(firstMuseumWork.artist.name);
  await page.getByRole("combobox", { name: "Styles / categories", exact: true }).selectOption(firstMuseumWork.movement);
  await page.getByRole("combobox", { name: "Orientations", exact: true }).selectOption(firstMuseumWork.visual.aspect);
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: "Artists", exact: true })).toHaveValue(firstMuseumWork.artist.slug);
  await expect(page.getByRole("combobox", { name: "Orientations", exact: true })).toHaveValue(firstMuseumWork.visual.aspect);
  await page.getByRole("searchbox").fill("zzzznotacatalogword");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByRole("heading", { name: "No works found." })).toBeVisible();
  await page.getByRole("button", { name: "Explore all works" }).click();
  await expect(page.getByTestId("search-result")).toHaveCount(DEFAULT_SEARCH_PAGE_SIZE);
  await expect(page).toHaveURL(/\/search$/);
});

test("search handles spelling tolerance and keyboard submit at a mobile width", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/search", { waitUntil: "networkidle" });
  await page.getByRole("searchbox").fill("irisse");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByTestId("search-result").filter({ has: page.getByRole("heading", { name: "Irises", exact: true }) }).first()).toBeVisible();
  await expect(page.getByText(/Near match:/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await testInfo.attach("search-mobile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(errors).toEqual([]);
});

test("public-domain museum works render local images and their real attribution", async ({ page }, testInfo) => {
  const artwork = firstMuseumWork;
  await page.goto(`/artwork/${artwork.slug}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: artwork.title })).toBeVisible();
  const image = page.getByRole("img", { name: artwork.visual.alt, exact: true }).first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("CC0 1.0 Universal", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source record" })).toHaveAttribute("href", artwork.rights.sourceUrl);
  await testInfo.attach("museum-artwork", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("load more appends a bounded page of unique museum results", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await expect(page.getByTestId("search-result")).toHaveCount(DEFAULT_SEARCH_PAGE_SIZE);
  await page.getByRole("button", { name: "Load more works" }).click();
  await expect(page.getByTestId("search-result")).toHaveCount(DEFAULT_SEARCH_PAGE_SIZE * 2);
  const hrefs = await page.getByTestId("search-result").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(hrefs).size).toBe(DEFAULT_SEARCH_PAGE_SIZE * 2);
  expect(hrefs.some((href) => href?.endsWith("-demo"))).toBe(false);
});

test("a failed search can be retried without losing the entered query", async ({ page }) => {
  let failNext = true;
  await page.route("**/api/search?**", async (route) => {
    if (failNext) { failNext = false; await route.fulfill({ status: 503, json: { error: "Unavailable" } }); }
    else await route.continue();
  });
  await page.goto("/search", { waitUntil: "networkidle" });
  await page.getByRole("searchbox").fill("Van Gogh");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Search could not be loaded");
  await expect(page.getByRole("searchbox")).toHaveValue("Van Gogh");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("search-result").first()).toContainText("Vincent van Gogh");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("failed pagination keeps existing results and recovers without duplicates", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  let failNext = true;
  await page.route("**/api/search?**", async (route) => {
    if (failNext) { failNext = false; await route.fulfill({ status: 503, json: { error: "Unavailable" } }); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Load more works" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Your current results are still here");
  await expect(page.getByTestId("search-result")).toHaveCount(DEFAULT_SEARCH_PAGE_SIZE);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("search-result")).toHaveCount(DEFAULT_SEARCH_PAGE_SIZE * 2);
});

test("search API caps lean pages and rejects invalid or stale cursors", async ({ request }) => {
  const response = await request.get("/api/search?limit=999999");
  expect(response.ok()).toBe(true);
  const page = await response.json();
  expect(page.results).toHaveLength(MAX_SEARCH_PAGE_SIZE);
  expect(page.total).toBe(PUBLIC_ARTWORKS.length);
  expect(page.results.every(({ artwork }: { artwork: Record<string, unknown> }) => !("features" in artwork) && !("rights" in artwork) && !("description" in artwork))).toBe(true);
  expect((await request.get("/api/search?cursor=invalid")).status()).toBe(400);
  expect((await request.get(`/api/search?q=flowers&limit=24&cursor=${page.nextCursor}`)).status()).toBe(400);
  const synthetic = await (await request.get("/api/search?q=Maris+Vale")).json();
  const publicIds = new Set(PUBLIC_ARTWORKS.map(({ id }) => id));
  expect(synthetic.results.every(({ artwork }: { artwork: { id: string; slug: string } }) => publicIds.has(artwork.id) && !artwork.slug.endsWith("-demo"))).toBe(true);
});
