import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "large-desktop", width: 1920, height: 1080 },
] as const;

for (const viewport of viewports) {
  test(`landing shell renders cleanly at ${viewport.name}`, async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: /discover art that discovers you/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start discovering/i })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`landing-${viewport.name}`, { body: screenshot, contentType: "image/png" });

    expect(consoleErrors).toEqual([]);
  });
}

test("product shell routes are reachable", async ({ page }) => {
  for (const path of ["/discover", "/search", "/trending", "/collections", "/market", "/onboarding"]) {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.ok(), path).toBeTruthy();
    await expect(page.locator("body")).not.toBeEmpty();
  }
});
