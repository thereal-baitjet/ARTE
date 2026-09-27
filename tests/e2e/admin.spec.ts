import { test, expect } from "@playwright/test";

test("administrator shell discloses no private data and APIs reject anonymous requests", async ({ page, request }) => {
  for (const method of ["GET", "PATCH"] as const) {
    const response = await request.fetch("/api/admin", { method, data: method === "PATCH" ? { action: "archive_artwork", id: "30000000-0000-0000-0000-000000000001" } : undefined });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "Administrator sign-in required." });
  }
  expect((await request.post("/api/admin/sync")).status()).toBe(401);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/locked|administrator account/);
  await expect(page.getByRole("heading", { name: "Audit trail", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Synchronize demo catalog" })).toHaveCount(0);
  for (const section of ["artworks", "artists", "listings", "sources", "recommendations"]) {
    await page.goto(`/admin/${section}`);
    await expect(page.getByRole("status")).toContainText(/locked|administrator account/);
    await expect(page.getByRole("heading", { name: "Audit trail", exact: true })).toHaveCount(0);
  }
});
