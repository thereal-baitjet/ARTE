import { expect, test } from "@playwright/test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";
import { museumProviderForSourceUrl } from "../../lib/artworks/providers";

test("the source hub identifies all four museums and links Cleveland's official rights and API guidance", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const sources = page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Sources & rights" });
  await expect(sources).toHaveAttribute("href", "/sources");
  await sources.click();
  await expect(page.getByRole("heading", { name: "The Metropolitan Museum of Art", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cleveland Museum of Art", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "National Gallery of Art", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The Museum of Modern Art", exact: true })).toBeVisible();
  await page.locator('a[href="/sources/cleveland"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "Cleveland Museum of Art", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cleveland’s Open Access policy" })).toHaveAttribute("href", "https://www.clevelandart.org/open-access");
  await expect(page.getByRole("link", { name: "Open Access API documentation" })).toHaveAttribute("href", "https://openaccess-api.clevelandart.org/");
  await expect(page.getByText("share_license_status", { exact: true })).toBeVisible();
});

test("a Cleveland artwork displays its own museum badge, image and original source link", async ({ page }) => {
  const artwork = PUBLIC_ARTWORKS.find((work) => museumProviderForSourceUrl(work.rights.sourceUrl)?.id === "cleveland");
  expect(artwork, "The public release must contain imported Cleveland works").toBeDefined();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/artwork/${artwork!.slug}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: artwork!.title, exact: true })).toBeVisible();
  await expect(page.getByText("Cleveland Museum of Art · Open Access", { exact: true })).toBeVisible();
  await expect(page.getByText("The Met · Open Access", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View source record" })).toHaveAttribute("href", artwork!.rights.sourceUrl);
  await expect(page.getByRole("link", { name: "About Cleveland Museum of Art source & rights" })).toHaveAttribute("href", "/sources/cleveland");
  const image = page.getByRole("img", { name: artwork!.visual.alt, exact: true }).first();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

for (const provider of ["cleveland", "nga"] as const) {
  test(`${provider} official remote images decode on the production artwork page`, async ({ page }) => {
    const artwork = PUBLIC_ARTWORKS.find(work => museumProviderForSourceUrl(work.rights.sourceUrl)?.id === provider && work.visual.kind === "image" && work.visual.src.startsWith("https://"));
    expect(artwork, "A verified remote museum image must be present").toBeDefined();
    await page.goto(`/artwork/${artwork!.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: artwork!.title, exact: true })).toBeVisible();
    const image = page.getByRole("img", { name: artwork!.visual.alt, exact: true }).first();
    if (provider === "nga") {
      await expect(image).toHaveAttribute("src", artwork!.visual.kind === "image" ? artwork!.visual.src : "");
      await expect(image).not.toHaveAttribute("srcset");
    } else {
      await expect(image).toHaveAttribute("src", /^\/_next\/image\?/);
    }
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "View source record", exact: true })).toHaveAttribute("href", artwork!.rights.sourceUrl);
  });
}

test("MoMA museum metadata and the independently sourced image have separate attribution links", async ({ page }) => {
  const artwork = PUBLIC_ARTWORKS.find(work => museumProviderForSourceUrl(work.rights.sourceUrl)?.id === "moma");
  expect(artwork).toBeDefined();
  expect(artwork!.rights.imageSourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
  await page.goto(`/artwork/${artwork!.slug}`, { waitUntil: "networkidle" });
  await expect(page.getByText("MoMA · Public-domain image", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source record", exact: true })).toHaveAttribute("href", artwork!.rights.sourceUrl);
  await expect(page.getByRole("link", { name: "View image source", exact: true })).toHaveAttribute("href", artwork!.rights.imageSourceUrl!);
  await expect(page.getByText("Public domain", { exact: true })).toBeVisible();
  const image = page.getByRole("img", { name: artwork!.visual.alt, exact: true }).first();
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
