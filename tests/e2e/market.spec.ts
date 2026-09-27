import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-27T12:00:00Z"));
});

test("market labels synthetic inventory and combines currency, price, and availability filters", async ({ page }) => {
  await page.goto("/market");
  await expect(page.locator("[data-listing-id]")).toHaveCount(6);
  await expect(page.getByText("Demo listing · not for sale", { exact: true })).toHaveCount(6);
  await page.getByRole("combobox", { name: "Currency", exact: true }).selectOption("USD");
  await page.getByRole("combobox", { name: "Price", exact: true }).selectOption("under1000");
  await expect(page.locator("[data-listing-id]")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Quiet Red Study — Demo" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("combobox", { name: "Price", exact: true }).selectOption("request");
  await expect(page.getByRole("heading", { name: "Form III — Demo" })).toBeVisible();
  await expect(page.locator("[data-listing-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("combobox", { name: "Availability", exact: true }).selectOption("expired");
  await expect(page.locator("[data-listing-id]")).toHaveCount(1);
  await expect(page.getByText("Inquiry unavailable: listing expired.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Write / edit inquiry draft" })).toHaveCount(0);
});

test("verified-only view has an honest empty state and older records cannot take inquiries", async ({ page }) => {
  await page.goto("/market");
  await expect(page.locator('[data-listing-id="demo-garden"]')).toContainText("Inquiry unavailable until this listing is rechecked.");
  await expect(page.locator('[data-listing-id="demo-blue-interval"]')).toContainText("Inquiry unavailable: listing reserved.");
  await page.getByLabel("Checked within 30 days").check();
  await expect(page.locator("[data-listing-id]")).toHaveCount(4);
  await page.getByRole("combobox", { name: "Listing type", exact: true }).selectOption("verified");
  await expect(page.getByRole("heading", { name: "Verified inventory is not connected yet." })).toBeVisible();
  await expect(page.locator("[data-listing-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore demo listings" }).click();
  await expect(page.locator("[data-listing-id]")).toHaveCount(6);
});

test("inquiry draft saves locally, reopens after reload, and can be deleted", async ({ page }) => {
  const networkWrites: string[] = [];
  page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) networkWrites.push(request.url()); });
  await page.goto("/market");
  const card = page.locator('[data-listing-id="demo-quiet-red"]');
  await card.getByRole("button", { name: "Write / edit inquiry draft" }).click();
  await expect(card.getByLabel("Your message")).toBeFocused();
  await card.getByLabel("Your message").fill("Please share the condition report and dimensions.");
  await card.getByRole("button", { name: "Save draft locally" }).click();
  await expect(card.getByRole("status")).toHaveText("Draft saved on this browser. Nothing was sent to a gallery.");
  await page.reload();
  await card.getByRole("button", { name: "Write / edit inquiry draft" }).click();
  await expect(card.getByLabel("Your message")).toHaveValue("Please share the condition report and dimensions.");
  await card.getByRole("button", { name: "Delete draft" }).click();
  await expect(card.getByLabel("Your message")).toHaveValue("");
  await expect(card.getByRole("status")).toHaveText("Draft deleted from this browser.");
  expect(networkWrites).toEqual([]);
});

test("blocked browser storage reports an unsaved inquiry without false success", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("Storage disabled", "SecurityError"); }; });
  await page.goto("/market");
  const card = page.locator('[data-listing-id="demo-quiet-red"]');
  await card.getByRole("button", { name: "Write / edit inquiry draft" }).click();
  await card.getByLabel("Your message").fill("Can you share more details?");
  await card.getByRole("button", { name: "Save draft locally" }).click();
  await expect(card.getByRole("alert")).toContainText("Your draft could not be saved");
  await expect(card.getByRole("status")).toHaveCount(0);
  await expect(card.getByLabel("Your message")).toHaveValue("Can you share more details?");
});

test("market is readable on mobile with gallery context and rights attribution", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/market");
  const card = page.locator('[data-listing-id="demo-quiet-red"]');
  await card.locator("summary").click();
  await expect(card.getByText("Fictional online gallery", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "View listing source & image rights" })).toHaveAttribute("href", "/sources/demo");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await testInfo.attach("market-mobile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(errors).toEqual([]);
});
