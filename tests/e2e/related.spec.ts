import { expect, test } from "@playwright/test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";

const publicArtworkPaths = new Set(PUBLIC_ARTWORKS.map((artwork) => `/artwork/${artwork.slug}`));

test("all related modes stay bounded and show only museum artworks on legacy demo routes", async ({ page }) => {
  await page.goto("/artwork/quiet-red-study-demo", { waitUntil: "networkidle" });
  const section = page.locator("#related");
  const modes = ["Visually Similar", "Similar Mood", "Similar Movement", "Similar Palette", "Unexpected Connection"];
  for (const mode of modes) {
    const button = section.getByRole("button", { name: mode, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const results = section.getByTestId("similarity-result");
    await expect(results).toHaveCount(4);
    const links = await results.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    expect(links.every((href) => href !== null && publicArtworkPaths.has(href))).toBe(true);
    const explanations = await results.locator("p.border-l").allTextContents();
    expect(explanations).toHaveLength(4);
    expect(explanations.every((text) => text.trim().length > 0)).toBe(true);
  }
});
