import { expect, test } from "@playwright/test";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks";
import { MET_ARTWORKS } from "../../lib/artworks/metArtworks";

test("descriptive search survives refresh, opens the result, and records both search events", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await expect(page.getByTestId("search-result")).toHaveCount(DEMO_ARTWORKS.length);
  await page.getByRole("searchbox").fill("calm blue landscape");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("Blue Interval");
  await expect(page).toHaveURL(/q=calm\+blue\+landscape/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("searchbox")).toHaveValue("calm blue landscape");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await page.getByTestId("search-result").getByRole("link").click();
  await expect(page).toHaveURL(/\/artwork\/blue-interval-demo$/);
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]") as Array<{ eventType: string; artworkId: string | null }>);
  expect(events.some(({ eventType }) => eventType === "search_query")).toBe(true);
  expect(events.some(({ eventType, artworkId }) => eventType === "search_result_open" && artworkId === "30000000-0000-0000-0000-000000000005")).toBe(true);
});

test("search filters combine, preserve URL state, and recover from no results", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Colors", exact: true }).selectOption("blue");
  await expect(page.getByTestId("search-result")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Orientations", exact: true }).selectOption("square");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("Meridian");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: "Colors", exact: true })).toHaveValue("blue");
  await expect(page.getByRole("combobox", { name: "Orientations", exact: true })).toHaveValue("square");
  await page.getByRole("combobox", { name: "Moods", exact: true }).selectOption("energetic");
  await expect(page.getByRole("heading", { name: "No works found." })).toBeVisible();
  await page.getByRole("button", { name: "Explore all works" }).click();
  await expect(page.getByTestId("search-result")).toHaveCount(DEMO_ARTWORKS.length);
  await expect(page).toHaveURL(/\/search$/);
});

test("search handles spelling tolerance and keyboard submit at a mobile width", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/search", { waitUntil: "networkidle" });
  await page.getByRole("searchbox").fill("gardne after rain");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("Garden After Rain");
  await expect(page.getByTestId("search-result")).toContainText("Near match");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await testInfo.attach("search-mobile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(errors).toEqual([]);
});

test("public-domain museum works render local images and their real attribution", async ({ page }, testInfo) => {
  const artwork = MET_ARTWORKS[0];
  await page.goto(`/artwork/${artwork.slug}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: artwork.title })).toBeVisible();
  const image = page.getByRole("img", { name: artwork.visual.alt, exact: true }).first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("CC0 1.0 Universal", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source record" })).toHaveAttribute("href", artwork.rights.sourceUrl);
  await testInfo.attach("museum-artwork", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
