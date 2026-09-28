import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [name, width, height] of [["mobile", 375, 812], ["tablet", 768, 1024], ["desktop", 1440, 900], ["large-desktop", 1920, 1080]] as const) {
  test(`release routes are accessible and fit ${name}`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    for (const route of ["/", "/search", "/collections", "/profile/taste", "/market", "/trending"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(accessibility.violations, `Accessibility: ${route}`).toEqual([]);
      await testInfo.attach(`${name}-${route.replaceAll("/", "_") || "home"}`, { body: await page.screenshot(), contentType: "image/png" });
    }
    expect(errors).toEqual([]);
  });
}

test("release health and security headers expose no secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.status).toBe("ok");
  expect(data.catalog).toBe("public-domain");
  expect(Number.isInteger(data.artworkCount)).toBe(true);
  expect(data.artworkCount).toBeGreaterThanOrEqual(1000);
  expect(Object.keys(data).sort()).toEqual(["accountBackendConfigured", "app", "artworkCount", "catalog", "status"]);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});
