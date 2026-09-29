import { expect, test, type Page } from "@playwright/test";

const otpUrl = "http://127.0.0.1:54321/auth/v1/otp**";
const successMessage = "Check your email for the sign-in link. You can close this page and return from your email.";

async function openForm(page: Page) {
  await page.goto("/auth");
  await expect(page.getByRole("button", { name: "Send magic link", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("reader@example.test");
}

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date("2026-09-29T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-29T12:00:01Z"));
}

test("email form requests a genuine OTP payload and shows success with a bounded resend cooldown", async ({ page }) => {
  const requests: { method: string; email: unknown; createUser: unknown; redirect: string | null }[] = [];
  await page.route(otpUrl, async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    requests.push({ method: request.method(), email: body.email, createUser: body.create_user, redirect: new URL(request.url()).searchParams.get("redirect_to") });
    await route.fulfill({ json: {} });
  });
  await openForm(page);
  await freezeClock(page);
  await page.getByRole("button", { name: "Send magic link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(successMessage);
  expect(requests).toEqual([{ method: "POST", email: "reader@example.test", createUser: true, redirect: "http://127.0.0.1:3101/auth" }]);
  await expect(page.getByRole("button", { name: "Send again in 60s", exact: true })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeEnabled();
  await page.clock.runFor(60_001);
  await expect(page.getByRole("button", { name: "Send magic link", exact: true })).toBeEnabled();
  expect(requests).toHaveLength(1);
});

test("email rate limits are explained without claiming delivery and prevent immediate resends", async ({ page }) => {
  await page.route(otpUrl, (route) => route.fulfill({
    status: 429,
    headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" },
    json: { code: "over_email_send_rate_limit", msg: "Email rate limit exceeded" },
  }));
  await openForm(page);
  await page.getByRole("button", { name: "Send magic link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Email requests are temporarily limited. Please wait before requesting another sign-in link.");
  await expect(page.getByRole("button", { name: /^Send again in \d+s$/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sending…", exact: true })).toHaveCount(0);
  await expect(page.getByText(successMessage, { exact: true })).toHaveCount(0);
});

test("restricted email delivery explains the service configuration problem instead of blaming the address", async ({ page }) => {
  await page.route(otpUrl, (route) => route.fulfill({
    status: 400,
    headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "x-supabase-api-version" },
    json: { code: "email_address_not_authorized", msg: "Email address not authorized" },
  }));
  await openForm(page);
  await page.getByRole("button", { name: "Send magic link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Email delivery is not enabled for this address. ARTE’s email service needs to be configured before this address can sign in.");
  await expect(page.getByRole("button", { name: "Send magic link", exact: true })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("reader@example.test");
  await expect(page.getByText(successMessage, { exact: true })).toHaveCount(0);
});

test("a stalled email request stops Sending at fifteen seconds and recovers without a false success", async ({ page }) => {
  let requests = 0;
  let releaseFirst: () => void = () => {};
  const firstResponse = new Promise<void>((resolve) => { releaseFirst = resolve; });
  await page.route(otpUrl, async (route) => {
    requests++;
    if (requests === 1) await firstResponse;
    // The first browser fetch has already been aborted when its delayed response is released.
    await route.fulfill({ json: {} }).catch(() => {});
  });
  try {
    await openForm(page);
    await freezeClock(page);
    await page.getByRole("button", { name: "Send magic link", exact: true }).click();
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByRole("button", { name: "Sending…", exact: true })).toBeDisabled();
    await page.clock.runFor(14_999);
    await expect(page.getByRole("button", { name: "Sending…", exact: true })).toBeVisible();
    await page.clock.runFor(2);
    await expect(page.getByRole("status")).toHaveText("The sign-in service took too long to respond. We could not confirm delivery. Check your inbox and spam folder before requesting another link.");
    await expect(page.getByRole("button", { name: "Sending…", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Send again in \d+s$/ })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeEnabled();
    releaseFirst();
    await page.clock.runFor(60_001);
    await expect(page.getByText(successMessage, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Send magic link", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(successMessage);
    expect(requests).toBe(2);
  } finally { releaseFirst(); }
});
