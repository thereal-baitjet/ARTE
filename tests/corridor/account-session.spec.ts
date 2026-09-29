import { expect, test } from "@playwright/test";

const user = { id: "91000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", email: "quiet-member@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-09-29T12:00:00Z" };
const session = { user, access_token: "account.test.session-token", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 };

test("a signed-in gallery verifies Auth once instead of once per artwork button", async ({ page }) => {
  let authRequests = 0;
  await page.addInitScript((value) => localStorage.setItem("sb-127-auth-token", JSON.stringify(value)), session);
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user") { authRequests++; await route.fulfill({ json: user }); return; }
    if (url.pathname === "/rest/v1/profiles") { await route.fulfill({ json: { personalization_analytics_enabled: true } }); return; }
    await route.fulfill({ json: [] });
  });
  await page.goto("/discover");
  await expect(page.locator('button[data-action="save"]').first()).toBeEnabled();
  expect(authRequests).toBe(1);
  await page.getByRole("link", { name: "Your account", exact: true }).click();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  expect(authRequests).toBe(1);
  await expect(page.getByText(/Account features require a connected ARTE backend/)).toHaveCount(0);
});

test("an unverified session shows recovery without falling back to guest account data", async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(value));
    localStorage.setItem("arte:guest:saves", JSON.stringify(["guest-only-work"]));
  }, session);
  await page.route("http://127.0.0.1:54321/**", async (route) => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
  await page.goto("/profile");
  await expect(page.getByText(/Your account could not be/).first()).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Retry account/i })).toBeVisible();
  await page.getByRole("link", { name: /Your Art DNA/ }).click();
  await expect(page.getByRole("button", { name: "Retry account activity", exact: true })).toBeVisible();
  await expect(page.getByTestId("taste-card")).toHaveCount(0);
});
