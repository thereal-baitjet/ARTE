import { expect, test } from "@playwright/test";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";
import { summarizeTaste, tasteShareText } from "../../lib/taste/profile";
import type { AnalyticsEvent } from "../../lib/analytics/types";

const firstId = PUBLIC_ARTWORKS[0].id;

function likeEvent(eventType: AnalyticsEvent["eventType"] = "artwork_like"): AnalyticsEvent {
  return { id: `taste-test-${eventType}`, eventType, artworkId: firstId, anonymousSessionId: "taste-test", source: "test", timestamp: "2026-09-27T00:00:00.000Z" };
}

test("taste estimates come from weighted activity and undoing a like removes its affinity", () => {
  expect(summarizeTaste([], PUBLIC_ARTWORKS).hasPositiveSignals).toBe(false);
  const liked = summarizeTaste([likeEvent()], PUBLIC_ARTWORKS);
  expect(liked.eventCount).toBe(1);
  expect(liked.dimensions.find((dimension) => dimension.label === "Movements")?.signals[0]).toEqual({ label: PUBLIC_ARTWORKS[0].movement, strength: 100 });
  expect(tasteShareText(liked)).toContain("1 activity signals across 1 artworks");
  expect(tasteShareText(liked)).not.toContain(firstId);
  expect(summarizeTaste([likeEvent(), likeEvent("artwork_unlike")], PUBLIC_ARTWORKS).hasPositiveSignals).toBe(false);
});

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
});

test("optional onboarding records only committed choices and builds an honest shareable card", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("button", { name: "Build my Art DNA" })).toBeDisabled();
  const choices = page.locator("[data-onboarding-artwork]");
  await expect(choices).toHaveCount(20);
  const first = choices.first();
  await first.click();
  await first.click();
  expect(await page.evaluate(() => localStorage.getItem("arte:analytics:events"))).toBeNull();
  for (let index = 0; index < 5; index++) await choices.nth(index).click();
  await page.getByRole("button", { name: "Build my Art DNA" }).click();
  await expect(page).toHaveURL(/\/taste$/);
  await expect(page.getByTestId("taste-card")).toContainText("5 weighted activity signals");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("arte:guest:likes") ?? "[]").length)).toBe(5);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
  });
  await page.getByRole("button", { name: "Share taste card", exact: true }).click();
  await expect(page.getByLabel("Your shareable summary — no raw activity history or account details")).toHaveValue(/My ARTE Art DNA/);
  await expect(page.getByRole("status")).toContainText("Taste card text copied");
  await page.goto("/onboarding");
  for (let index = 0; index < 5; index++) await page.locator("[data-onboarding-artwork]").nth(index).click();
  await page.getByRole("button", { name: "Build my Art DNA" }).click();
  await expect(page).toHaveURL(/\/taste$/);
  await expect(page.getByTestId("taste-card")).toContainText("5 weighted activity signals");
});

test("passive tracking pause survives navigation while explicit likes still work", async ({ page }) => {
  await page.goto("/taste");
  await page.getByRole("button", { name: "Pause passive tracking" }).click();
  await expect(page.getByRole("button", { name: "Resume passive tracking" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/discover", { waitUntil: "networkidle" });
  await page.locator("[data-artwork-id]").first().locator('[data-action="like"]').click();
  const types = await page.evaluate(() => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]").map((event: { eventType: string }) => event.eventType));
  expect(types).toContain("artwork_like");
  expect(types).not.toContain("artwork_impression");
  expect(types).not.toContain("artwork_visible");
  expect(types).not.toContain("artwork_dwell");
  await page.goto("/taste");
  await expect(page.getByRole("button", { name: "Resume passive tracking" })).toBeVisible();
  await expect(page.getByTestId("taste-card")).toContainText("1 weighted activity signals");
});

test("restoring hidden work removes the hide penalty; local reset keeps saved collections and pause choice", async ({ page }) => {
  await page.evaluate(({ id, like, hide }) => {
    localStorage.setItem("arte:analytics:events", JSON.stringify([like, hide]));
    localStorage.setItem("arte:guest:hidden", JSON.stringify([id]));
    localStorage.setItem("arte:guest:likes", JSON.stringify([id]));
    localStorage.setItem("arte:guest:follows", JSON.stringify(["artist-to-reset"]));
    localStorage.setItem("arte:guest:saves", JSON.stringify([id]));
    localStorage.setItem("arte:guest:collections", JSON.stringify([{ id: "keep-me", name: "Saved notebook", artworkIds: [id] }]));
    localStorage.setItem("arte:analytics:personalization-enabled", "false");
  }, { id: firstId, like: likeEvent(), hide: likeEvent("artwork_hide") });
  await page.goto("/taste");
  await expect(page.getByRole("heading", { name: "No positive pattern yet." })).toBeVisible();
  await page.getByRole("button", { name: "Restore hidden works (1)" }).click();
  await expect(page.getByRole("region", { name: "Movements", exact: true })).toContainText(PUBLIC_ARTWORKS[0].movement);
  await page.getByRole("button", { name: "Reset local recommendations" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("arte:analytics:events") ?? "[]").length)).toBe(1);
  await page.getByRole("button", { name: "Reset local recommendations" }).click();
  await page.getByLabel("Also clear guest likes and follows on this device").check();
  await page.getByRole("button", { name: "Confirm local reset" }).click();
  await expect(page.getByTestId("taste-card")).toContainText("0 weighted activity signals");
  const stored = await page.evaluate(() => ({ events: localStorage.getItem("arte:analytics:events"), likes: localStorage.getItem("arte:guest:likes"), follows: localStorage.getItem("arte:guest:follows"), saves: localStorage.getItem("arte:guest:saves"), collections: localStorage.getItem("arte:guest:collections"), paused: localStorage.getItem("arte:analytics:personalization-enabled") }));
  expect(stored.events).toBeNull();
  expect(stored.likes).toBeNull();
  expect(stored.follows).toBeNull();
  expect(stored.saves).toContain(firstId);
  expect(stored.collections).toContain("keep-me");
  expect(stored.paused).toBe("false");
});

test("blocked browser storage reports a useful failure instead of breaking privacy controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/taste");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await page.getByRole("button", { name: "Pause passive tracking" }).click();
  await expect(page.getByRole("status")).toContainText("could not save your preference");
  await expect(page.getByRole("button", { name: "Pause passive tracking" })).toBeVisible();
  expect(errors).toEqual([]);
});
