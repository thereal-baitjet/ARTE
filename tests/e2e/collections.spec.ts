import { expect, test } from "@playwright/test";

test("saving from Discover appears in the notebook without creating a collection", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "networkidle" });
  const first = page.locator("[data-artwork-id]").first();
  const id = await first.getAttribute("data-artwork-id");
  await first.locator('[data-action="save"]').click();
  await page.goto("/collections", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Saved artworks", exact: true })).toBeVisible();
  await expect(page.locator(`[data-collection-artwork="${id}"]`)).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(`[data-collection-artwork="${id}"]`)).toBeVisible();
  await page.getByRole("button", { name: /Remove .* from saved artworks/ }).click();
  await expect(page.locator("[data-collection-artwork]")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Start with a work that moves you." })).toBeVisible();
});

test("private collection create, add, rename, remove and delete survive reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/collections", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Collection name", exact: true }).fill("Quiet mornings");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("heading", { name: "Quiet mornings", exact: true })).toBeVisible();
  await expect(page.getByText("private collection · 0 artworks", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Add artwork" }).selectOption("30000000-0000-0000-0000-000000000001");
  await page.getByRole("button", { name: "Add to collection" }).click();
  await expect(page.locator("[data-collection-artwork]")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Rename collection" }).fill("Evening studies");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Evening studies 1" }).click();
  await expect(page.locator("[data-collection-artwork]")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Evening studies", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open collection", exact: true }).click();
  await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Evening studies", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: /Remove .* from collection/ }).click();
  await expect(page.locator("[data-collection-artwork]")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Evening studies 0" }).click();
  await expect(page.locator("[data-collection-artwork]")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Evening studies/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Collection unavailable." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("deleting a collection keeps independent saves and duplicate names are rejected", async ({ page }) => {
  await page.goto("/collections", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("arte:guest:saves", JSON.stringify(["30000000-0000-0000-0000-000000000001"])));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Collection name", exact: true }).fill("Favorites");
  await page.getByRole("button", { name: "Create collection" }).click();
  await page.getByRole("textbox", { name: "Collection name", exact: true }).fill(" favorites ");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("You already have a collection with that name.");
  await page.getByRole("combobox", { name: "Add artwork" }).selectOption("30000000-0000-0000-0000-000000000001");
  await page.getByRole("button", { name: "Add to collection" }).click();
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.locator("[data-collection-artwork]")).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("arte:guest:saves") ?? "[]"))).toEqual(["30000000-0000-0000-0000-000000000001"]);
});

test("browser storage failure is reported without claiming a collection was created", async ({ page }) => {
  await page.goto("/collections", { waitUntil: "networkidle" });
  await expect(page.getByRole("textbox", { name: "Collection name", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "arte:guest:collections") throw new Error("Browser storage is unavailable.");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("textbox", { name: "Collection name", exact: true }).fill("Unsaved collection");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Browser storage is unavailable.");
  await expect(page.getByRole("heading", { name: "Unsaved collection", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create collection" })).toBeEnabled();
});

test("failed like and save writes revert their state and allow a successful retry", async ({ page }) => {
  await page.goto("/artwork/quiet-red-study-demo", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    const blocked = new Set(["arte:guest:likes", "arte:guest:saves"]);
    Storage.prototype.setItem = function (key, value) {
      if (blocked.delete(key)) throw new Error("Browser storage is temporarily unavailable.");
      return original.call(this, key, value);
    };
  });
  for (const action of ["like", "save"]) {
    const button = page.locator(`[data-action="${action}"]`);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toBeEnabled();
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`${action} could not be updated`, "i") })).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toBeEnabled();
  }
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-action="like"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-action="save"]')).toHaveAttribute("aria-pressed", "true");
});
