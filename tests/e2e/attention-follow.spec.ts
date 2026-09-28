import { expect, test } from "@playwright/test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";

test("attention starts honestly empty then reflects a save", async ({ page }) => {
  await page.goto("/trending", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Your attention starts with a work." })).toBeVisible();
  await expect(page.getByText("it does not represent activity across ARTE", { exact: false })).toBeVisible();
  await page.goto(`/artwork/${PUBLIC_ARTWORKS[0].slug}`, { waitUntil: "networkidle" });
  await page.locator('[data-action="save"]').click();
  await page.goto("/trending", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Recently saved" }).click();
  await expect(page.locator("[data-attention-artwork]")).toHaveCount(1);
  await expect(page.locator("[data-attention-artwork]")).toContainText(PUBLIC_ARTWORKS[0].title);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-attention-artwork]")).toHaveCount(1);
});

test("artist follow persists and emits artist-only preference signals", async ({ page }) => {
  await page.goto("/artist/atelier-nocturne-demo", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Follow Atelier Nocturne — Demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unfollow Atelier Nocturne — Demo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Unfollow Atelier Nocturne — Demo", exact: true })).toHaveAttribute("aria-pressed", "true");
  const signal = await page.evaluate(() => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]").find((event: { eventType: string }) => event.eventType === "artist_follow"));
  expect(signal.artistId).toBe("10000000-0000-0000-0000-000000000001");
  expect(signal.artworkId).toBeNull();
  await page.getByRole("button", { name: "Unfollow Atelier Nocturne — Demo", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Follow Atelier Nocturne — Demo", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("small mobile screens record visible artwork and dwell even when the article is taller than the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto("/discover", { waitUntil: "networkidle" });
  const first = page.locator("[data-artwork-id]").first();
  const artworkId = await first.getAttribute("data-artwork-id");
  const bounds = await first.boundingBox();
  expect(bounds!.height).toBeGreaterThan(500 / 0.6);
  await first.locator("[data-artwork-observation]").evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]").some((event: { eventType: string; artworkId: string }) => event.artworkId === id && event.eventType === "artwork_impression"), artworkId)).toBe(true);
  // Dwell is time-based: hold the actual visible work beyond its 250 ms floor.
  await page.waitForTimeout(350);
  await page.locator("[data-artwork-id]").nth(1).evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]").some((event: { eventType: string; artworkId: string; payload?: { durationMs: number } }) => event.artworkId === id && event.eventType === "artwork_dwell" && (event.payload?.durationMs ?? 0) >= 250), artworkId)).toBe(true);
});
