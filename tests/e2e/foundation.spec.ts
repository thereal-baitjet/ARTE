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
    const primaryAction = page.getByRole("link", { name: /start discovering/i });
    await expect(primaryAction).toBeVisible();
    const contrast = await primaryAction.evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const text = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return { text, background, ratio: (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05) };
    });
    expect(contrast.text).toBeGreaterThan(contrast.background);
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);

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
