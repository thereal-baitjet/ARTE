import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PUBLIC_ARTWORKS } from "../../lib/artworks/publicCatalog";

const work = PUBLIC_ARTWORKS[0];
const gate = "Leave a note in the Shared Corridor";
const userId = "81000000-0000-0000-0000-000000000001";
const session = {
  access_token: "corridor.test.session-token", refresh_token: "test-refresh",
  token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: userId, aud: "authenticated", role: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
};
type Note = { id: string; noteText: string; isOwn: boolean; createdAt: string; updatedAt: string };
function note(id: string, text: string, own = false): Note {
  return { id, noteText: text, isOwn: own, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
async function setup(page: Page, signedIn = true, eligible = true) {
  if (signedIn) await page.addInitScript((value) => localStorage.setItem("sb-127-auth-token", JSON.stringify(value)), session);
  await page.route("http://127.0.0.1:54321/**", (route) => route.fulfill({ json: { ...session.user } }));
  const state = { own: null as Note | null, fail: false, hold: null as (() => void) | null, reads: 0, waiting: false, eligible };
  await page.route("**/api/corridor/**", async (route) => {
    const request = route.request();
    if (request.url().includes("access=1")) { await route.fulfill({ json: { eligible: state.eligible } }); return; }
    if (request.method() === "GET") {
      state.reads++;
      const more = request.url().includes("cursor=");
      await route.fulfill({ json: { ownNote: state.own, notes: more ? [note("last", "A final reflection")] : Array.from({ length: 6 }, (_, i) => note(String(i), `Quiet reflection ${i + 1}`)),
        nextCursor: more ? null : { id: userId, createdAt: "2026-09-29T00:00:00+00:00" } } }); return;
    }
    if (state.hold) await new Promise<void>((resolve) => { state.hold = resolve; state.waiting = true; });
    if (state.fail) { await route.fulfill({ status: 503, json: { error: "Please try again shortly." } }); return; }
    state.own = request.method() === "DELETE" ? null : note("mine", request.postDataJSON().noteText, true);
    await route.fulfill({ json: state.own });
  });
  await page.goto(`/artwork/${work.slug}`);
  return state;
}

test("guests and non-cohort members see no corridor; API is private", async ({ page, request }) => {
  await setup(page, false);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: gate })).toHaveCount(0);
  const response = await request.get(`/api/corridor/${work.id}`);
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(await (await request.get(`/artwork/${work.slug}`)).text()).not.toContain("Quiet reflection");
});
test("regular authenticated member has no feature", async ({ page }) => {
  await setup(page, true, false);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: gate })).toHaveCount(0);
});
test("member can create optimistically, edit, paginate and delete on mobile", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await setup(page);
  const toggle = page.getByRole("button", { name: gate });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(state.reads).toBe(0);
  await toggle.focus(); await page.keyboard.press("Enter");
  const input = page.getByRole("textbox", { name: "A thought to leave here" });
  await input.fill("The light feels like a pause.");
  state.hold = () => {};
  await page.getByRole("button", { name: "Leave note", exact: true }).click();
  await expect(page.getByText("The light feels like a pause.", { exact: true })).toBeVisible();
  await expect(page.getByText("Your note is now in the Shared Corridor.")).toHaveCount(0);
  await expect.poll(() => state.waiting).toBe(true);
  state.hold?.(); state.hold = null;
  await expect(page.getByText("Your note is now in the Shared Corridor.")).toBeVisible();
  await page.getByRole("button", { name: "Edit your note" }).click();
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.getByRole("textbox").fill("A quieter light.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText("Your note has been updated.")).toBeVisible();
  await page.getByRole("button", { name: "View more" }).click();
  await expect(page.getByText("A final reflection")).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('section[aria-label="Shared Corridor"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await info.attach("corridor-mobile", { body: await page.locator('section[aria-label="Shared Corridor"]').screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Delete your note" }).click();
  await page.getByRole("button", { name: "Remove note", exact: true }).click();
  await expect(page.getByText("Your note has been removed.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue("");
  expect(errors).toEqual([]);
});
test("failed optimistic save rolls back without losing the draft; revocation hides notes", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: gate }).click();
  await page.getByRole("textbox").fill("I would like to keep this thought.");
  state.fail = true;
  await page.getByRole("button", { name: "Leave note", exact: true }).click();
  await expect(page.getByText("Please try again shortly.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue("I would like to keep this thought.");
  state.fail = false;
  await page.getByRole("button", { name: "Leave note", exact: true }).click();
  await expect(page.getByText("Your note is now in the Shared Corridor.")).toBeVisible();
  state.eligible = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: gate })).toHaveCount(0);
  await expect(page.getByText("Quiet reflection 1")).toHaveCount(0);
});

test("signing out in another tab clears private notes", async ({ page, context }) => {
  await setup(page);
  await page.getByRole("button", { name: gate }).click();
  await expect(page.getByText("Quiet reflection 1")).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.route("http://127.0.0.1:54321/**", (route) => route.fulfill({ json: {} }));
  await otherTab.goto("/auth");
  await otherTab.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(otherTab.getByText("You are signed out.")).toBeVisible();
  await expect(page.getByRole("button", { name: gate })).toHaveCount(0);
  await expect(page.getByText("Quiet reflection 1")).toHaveCount(0);
});
