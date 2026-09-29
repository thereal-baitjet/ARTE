import assert from "node:assert/strict";
import { randomUUID, createHash, X509Certificate } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
assert.ok(url && key && serviceKey, "Local Supabase credentials are required");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname), "Browser integration only targets disposable local Supabase");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, url, "Build and browser must use the same local Supabase project");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, key, "Build and browser must use the same public key");

const base = "http://127.0.0.1:3103";
const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const createdUsers = [];
const contexts = [];
const pageErrors = [];
const artifacts = "test-results/account-browser";
const checks = [];
const ui = expect.configure({ timeout: 15_000 });
const checked = (result, operation) => {
  assert.equal(result.error, null, `${operation}: ${result.error?.message ?? ""}`);
  return result.data;
};
const waitFor = (callback, message) => ui.poll(callback, { message, timeout: 15_000, intervals: [100, 250, 500] });
const record = (message) => { checks.push(message); console.log(`PASS ${message}`); };
const count = async (table, userId, column, value) => {
  let query = admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (column) query = query.eq(column, value);
  const result = await query;
  checked(result, `Read ${table}`);
  return result.count;
};

let browser;
let currentPage;
let serverError = "";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3103"], {
  stdio: ["ignore", "ignore", "pipe"],
});
server.stderr.on("data", (chunk) => { serverError = (serverError + chunk.toString()).slice(-4000); });

async function createAccount(label) {
  const email = `account-browser-${label}-${randomUUID()}@example.com`;
  const password = `ARTE-${randomUUID()}!`;
  const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "Create local test account").user;
  createdUsers.push(user.id);
  const client = createClient(url, key, options);
  const session = checked(await client.auth.signInWithPassword({ email, password }), "Sign in through real Supabase Auth").session;
  assert.equal(session.user.id, user.id);
  return { id: user.id, email, password, session, client };
}

async function openDevice(account, viewport = { width: 390, height: 844 }) {
  // Seed only the genuine Auth-issued session; all authorization remains real Auth and RLS.
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    ...(account ? { storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: storageKey, value: JSON.stringify(account.session) }] }] } } : {}),
  });
  contexts.push(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  currentPage = page;
  return { context, page };
}

async function audit(page, name) {
  await ui(page.getByRole("main")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  assert.deepEqual(results.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) })), [], `${name} accessibility`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} fits a mobile viewport`);
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

try {
  await mkdir(artifacts, { recursive: true });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error(`Next server exited: ${serverError}`);
    try { return (await fetch(`${base}/api/health`)).ok; } catch { return false; }
  }, "Production Next server becomes healthy").toBe(true);

  const launchArgs = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--disable-gpu"] : [];
  const proxyServer = process.env.PLAYWRIGHT_PROXY_SERVER;
  if (proxyServer && process.env.PLAYWRIGHT_PROXY_CERT_FILE) {
    const certificate = new X509Certificate(await readFile(process.env.PLAYWRIGHT_PROXY_CERT_FILE));
    const fingerprint = createHash("sha256").update(certificate.publicKey.export({ type: "spki", format: "der" })).digest("base64");
    launchArgs.push(`--ignore-certificate-errors-spki-list=${fingerprint}`);
  }
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: launchArgs,
    proxy: proxyServer ? { server: proxyServer, bypass: "127.0.0.1,localhost" } : undefined,
  });
  const [owner, other] = await Promise.all([createAccount("owner"), createAccount("other")]);
  const works = checked(await admin.from("artworks").select("id,slug,title,artist_id").eq("is_published", true).eq("is_synthetic", false).eq("image_rights_state", "public_domain").order("id").limit(2), "Read real artworks");
  assert.equal(works.length, 2);
  const [work, secondWork] = works;
  const artist = checked(await admin.from("artists").select("id,slug,name").eq("id", work.artist_id).single(), "Read artist");

  const guest = await openDevice(null);
  await guest.page.goto(`${base}/profile`);
  await ui(guest.page.getByRole("button", { name: "Send magic link", exact: true })).toBeVisible();
  await ui(guest.page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await guest.context.close();

  const primary = await openDevice(owner);
  const { page } = primary;
  await page.goto(`${base}/profile`);
  await ui(page.getByText(owner.email, { exact: true })).toBeVisible();
  await ui(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await ui(page.getByRole("button", { name: "Send magic link", exact: true })).toHaveCount(0);
  await ui(page.getByText(/Account features require a connected ARTE backend|Art DNA currently stay on this device/)).toHaveCount(0);
  await audit(page, "signed-in-profile-mobile");
  record("Verified account profile replaces guest sign-in and passes mobile accessibility");

  const hydrationRequests = [];
  const observeRequests = (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin === new URL(url).origin && request.method() === "GET") hydrationRequests.push(requestUrl.pathname);
  };
  page.on("request", observeRequests);
  await page.goto(`${base}/discover`);
  await ui(page.locator("[data-artwork-id]").first().locator('[data-action="save"]')).toBeEnabled();
  await ui(page.locator("[data-artwork-id]").last().locator('[data-action="like"]')).toBeEnabled();
  page.off("request", observeRequests);
  assert.ok(hydrationRequests.filter((path) => path === "/auth/v1/user").length <= 4, "Feed verifies identity without per-card Auth requests");
  for (const table of ["likes", "saves"]) {
    assert.ok(hydrationRequests.filter((path) => path === `/rest/v1/${table}`).length <= 2, `Feed batches ${table} hydration`);
  }
  record("Signed-in feed avoids per-card identity and saved-state request fan-out");

  await page.goto(`${base}/artwork/${work.slug}`);
  for (const action of ["save", "like"]) {
    const button = page.locator(`[data-action="${action}"]`);
    await ui(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await ui(button).toHaveAttribute("aria-pressed", "true");
    await ui(button).toBeEnabled();
    await waitFor(() => count(`${action}s`, owner.id, "artwork_id", work.id), `${action} reaches the account database`).toBe(1);
  }
  await page.reload();
  await ui(page.locator('[data-action="like"]')).toHaveAttribute("aria-pressed", "true");
  await ui(page.locator('[data-action="save"]')).toHaveAttribute("aria-pressed", "true");
  await page.goto(`${base}/artist/${artist.slug}`);
  const follow = page.getByRole("button", { name: `Follow ${artist.name}`, exact: true });
  await follow.click();
  await ui(page.getByRole("button", { name: `Unfollow ${artist.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => count("follows", owner.id, "artist_id", artist.id), "Follow reaches the account database").toBe(1);
  record("Artwork saves, likes, and artist follows persist through real Auth and RLS");

  await page.goto(`${base}/artwork/${secondWork.slug}`);
  let rejectNextSave = true;
  const failOnce = async (route) => {
    if (route.request().method() === "POST" && rejectNextSave) {
      rejectNextSave = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Temporary test network failure" }) });
    } else await route.continue();
  };
  await page.route(`${url}/rest/v1/saves*`, failOnce);
  const retrySave = page.locator('[data-action="save"]');
  await retrySave.click();
  await ui(page.getByRole("status").filter({ hasText: /Save could not be updated/i })).toBeVisible();
  await ui(retrySave).toHaveAttribute("aria-pressed", "false");
  assert.equal(await count("saves", owner.id, "artwork_id", secondWork.id), 0);
  await retrySave.click();
  await waitFor(() => count("saves", owner.id, "artwork_id", secondWork.id), "Save retry reaches the database").toBe(1);
  await ui(retrySave).toBeEnabled();
  await retrySave.click();
  await waitFor(() => count("saves", owner.id, "artwork_id", secondWork.id), "Unsave reaches the database").toBe(0);
  await page.unroute(`${url}/rest/v1/saves*`, failOnce);
  record("Failed account save rolls back quietly and a retry succeeds");

  await page.goto(`${base}/collections`);
  await ui(page.getByText("Changes are saved to your account.", { exact: true })).toBeVisible();
  await ui(page.locator(`[data-collection-artwork="${work.id}"]`)).toBeVisible();
  await page.getByRole("textbox", { name: "Collection name", exact: true }).fill("Quiet mornings");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await ui(page.getByRole("heading", { name: "Quiet mornings", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Add artwork", exact: true }).selectOption(work.id);
  await page.getByRole("button", { name: "Add to collection", exact: true }).click();
  await ui(page.locator(`[data-collection-artwork="${work.id}"]`)).toBeVisible();
  await page.getByRole("textbox", { name: "Rename collection", exact: true }).fill("Evening studies");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await ui(page.getByRole("heading", { name: "Evening studies", exact: true })).toBeVisible();
  const collection = checked(await admin.from("collections").select("id,name,visibility").eq("owner_id", owner.id).single(), "Read browser-created collection");
  assert.equal(collection.name, "Evening studies");
  assert.equal(collection.visibility, "private");
  const privateRead = checked(await other.client.from("collections").select("id").eq("id", collection.id), "Read collection as another authenticated user");
  assert.deepEqual(privateRead, [], "RLS hides the owner's collection from the other authenticated user");
  await page.goto(`${base}/collections/${collection.id}`);
  await page.reload();
  await ui(page.getByRole("heading", { name: "Evening studies", exact: true })).toBeVisible();
  await ui(page.locator(`[data-collection-artwork="${work.id}"]`)).toBeVisible();
  await audit(page, "signed-in-collection-mobile");
  record("Private collection create, add, rename, direct URL, and reload retain the account data");

  await waitFor(async () => checked(await admin.from("events").select("event_type").eq("user_id", owner.id).in("event_type", ["artwork_like", "artwork_save"]), "Read persisted taste signals").length, "Intentional browser activity syncs to the account").toBeGreaterThanOrEqual(2);
  await page.goto(`${base}/settings`);
  await ui(page.getByRole("heading", { name: "Privacy & settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause passive tracking", exact: true }).click();
  await ui(page.getByRole("button", { name: "Resume passive tracking", exact: true })).toHaveAttribute("aria-pressed", "true");
  await waitFor(async () => checked(await admin.from("profiles").select("personalization_analytics_enabled").eq("id", owner.id).single(), "Read account tracking preference").personalization_analytics_enabled, "Tracking pause persists on the account").toBe(false);
  await page.reload();
  await ui(page.getByRole("button", { name: "Resume passive tracking", exact: true })).toBeVisible();
  await audit(page, "signed-in-settings-mobile");
  record("Tracking preference persists in the account and survives reload");

  const passiveTypes = ["artwork_impression", "artwork_visible", "artwork_dwell"];
  const passiveCount = async () => checked(await admin.from("events").select("id").eq("user_id", owner.id).in("event_type", passiveTypes), "Read passive activity").length;
  const passiveBeforeFreshDevice = await passiveCount();
  const freshIdentity = { ...owner, client: createClient(url, key, options) };
  freshIdentity.session = checked(await freshIdentity.client.auth.signInWithPassword({ email: owner.email, password: owner.password }), "Sign in on a separate device").session;
  const fresh = await openDevice(freshIdentity);
  await fresh.page.goto(`${base}/profile/taste`);
  await ui(fresh.page.getByTestId("taste-card")).toContainText(/[1-9]\d* weighted activity signals/);
  await ui(fresh.page.getByRole("heading", { name: "No positive pattern yet.", exact: true })).toHaveCount(0);
  await fresh.page.goto(`${base}/collections/${collection.id}`);
  await ui(fresh.page.getByRole("heading", { name: "Evening studies", exact: true })).toBeVisible();
  await ui(fresh.page.locator(`[data-collection-artwork="${work.id}"]`)).toBeVisible();
  await fresh.page.goto(`${base}/settings`);
  await ui(fresh.page.getByRole("button", { name: "Resume passive tracking", exact: true })).toBeVisible();
  await fresh.page.goto(`${base}/artwork/${work.slug}`);
  await ui(fresh.page.locator('[data-action="save"]')).toHaveAttribute("aria-pressed", "true");
  await ui(fresh.page.locator('[data-action="like"]')).toHaveAttribute("aria-pressed", "true");
  await fresh.page.locator('[data-action="like"]').click();
  await waitFor(() => count("likes", owner.id, "artwork_id", work.id), "Explicit unlike still works while passive tracking is paused").toBe(0);
  await fresh.page.locator('[data-action="like"]').click();
  await waitFor(() => count("likes", owner.id, "artwork_id", work.id), "Explicit like still works while passive tracking is paused").toBe(1);
  await fresh.page.goto(`${base}/discover`);
  await ui(fresh.page.locator("[data-artwork-id]").first().locator('[data-action="save"]')).toBeEnabled();
  await fresh.page.goto(`${base}/artist/${artist.slug}`);
  await ui(fresh.page.getByRole("button", { name: `Unfollow ${artist.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  assert.equal(await passiveCount(), passiveBeforeFreshDevice, "A paused account does not record fresh-device passive views");
  await fresh.context.close();
  record("A fresh device restores account Art DNA, collections, saves, likes, follows, and tracking choice");

  currentPage = page;
  await page.goto(`${base}/settings`);
  await page.getByRole("button", { name: "Clear account activity", exact: true }).click();
  await page.getByRole("button", { name: "Cancel account reset", exact: true }).click();
  assert.ok(await count("events", owner.id) > 0, "Cancelling a reset preserves account history");
  await page.getByRole("button", { name: "Clear account activity", exact: true }).click();
  await page.getByRole("button", { name: "Confirm account activity reset", exact: true }).click();
  await waitFor(() => count("events", owner.id), "Account activity reset clears hosted history").toBe(0);
  for (const table of ["likes", "saves"]) assert.equal(await count(table, owner.id, "artwork_id", work.id), 1, `Activity reset preserves ${table}`);
  assert.equal(await count("follows", owner.id, "artist_id", artist.id), 1, "Activity reset preserves artist follows");
  await ui(page.getByRole("button", { name: "Resume passive tracking", exact: true })).toBeVisible();
  await page.goto(`${base}/profile/taste`);
  await ui(page.getByTestId("taste-card")).toContainText(/[1-9]\d* weighted activity signals/);
  record("Account activity reset supports cancellation and preserves intentional choices and tracking preference");

  await page.goto(`${base}/collections/${collection.id}`);
  await page.getByRole("button", { name: `Remove ${work.title} from collection`, exact: true }).click();
  await ui(page.locator("[data-collection-artwork]")).toHaveCount(0);
  await page.reload();
  await ui(page.getByText("private collection · 0 artworks", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await waitFor(async () => checked(await admin.from("collections").select("id").eq("id", collection.id), "Read deleted collection").length, "Collection deletion reaches the database").toBe(0);
  assert.equal(await count("saves", owner.id, "artwork_id", work.id), 1, "Deleting a collection preserves independent saves");
  record("Collection item removal and deletion persist without deleting saved artworks");

  const secondTab = await primary.context.newPage();
  secondTab.on("pageerror", (error) => pageErrors.push(error.message));
  await secondTab.goto(`${base}/artwork/${work.slug}`);
  await ui(secondTab.locator('[data-action="save"]')).toHaveAttribute("aria-pressed", "true");
  await page.goto(`${base}/profile`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await ui(page.getByRole("button", { name: "Send magic link", exact: true })).toBeVisible();
  await ui(page.getByText(owner.email, { exact: true })).toHaveCount(0);
  await ui(secondTab.locator('[data-action="save"]')).toHaveAttribute("aria-pressed", "false");
  await ui(secondTab.locator('[data-action="save"]')).toBeEnabled();
  await secondTab.close();
  assert.ok(checked(await freshIdentity.client.auth.refreshSession(), "Refresh the other device after local sign-out").session, "Signing out locally preserves independently signed-in devices");
  await page.goto(`${base}/collections`);
  await ui(page.getByRole("heading", { name: "Start with a work that moves you.", exact: true })).toBeVisible();
  await page.goto(`${base}/profile/taste`);
  await ui(page.getByTestId("taste-card")).toContainText("0 weighted activity signals");
  await page.evaluate(({ name, session }) => localStorage.setItem(name, JSON.stringify(session)), { name: storageKey, session: other.session });
  await page.goto(`${base}/profile`);
  await ui(page.getByText(other.email, { exact: true })).toBeVisible();
  await ui(page.getByText(owner.email, { exact: true })).toHaveCount(0);
  await page.goto(`${base}/collections`);
  await ui(page.getByRole("heading", { name: "Start with a work that moves you.", exact: true })).toBeVisible();
  await ui(page.getByText("Changes are saved to your account.", { exact: true })).toBeVisible();
  await page.goto(`${base}/profile/taste`);
  await ui(page.getByTestId("taste-card")).toContainText("0 weighted activity signals");
  await page.goto(`${base}/settings`);
  await ui(page.getByRole("button", { name: "Pause passive tracking", exact: true })).toBeVisible();
  await page.goto(`${base}/artwork/${work.slug}`);
  for (const action of ["like", "save"]) await ui(page.locator(`[data-action="${action}"]`)).toHaveAttribute("aria-pressed", "false");
  await page.goto(`${base}/artist/${artist.slug}`);
  await ui(page.getByRole("button", { name: `Follow ${artist.name}`, exact: true })).toHaveAttribute("aria-pressed", "false");
  for (const table of ["likes", "saves", "follows"]) assert.equal(await count(table, other.id), 0, `Account switch never copies ${table} from the previous owner`);
  assert.equal(await count("saves", owner.id, "artwork_id", work.id), 1, "Signing out preserves hosted saves");
  record("Sign-out and account switching isolate collections, taste, tracking, saves, likes, and follows");

  assert.deepEqual(pageErrors, [], "All signed-in browser journeys run without uncaught page errors");
  await writeFile(`${artifacts}/report.json`, JSON.stringify({ checks, uncaughtPageErrors: pageErrors }, null, 2));
  console.log(`Signed-in browser gauntlet passed ${checks.length} release gates against real local Supabase and production Next.`);
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${artifacts}/report.json`, JSON.stringify({ checks, failure: error instanceof Error ? error.message : String(error), uncaughtPageErrors: pageErrors }, null, 2)).catch(() => {});
  throw error;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close();
  server.kill("SIGTERM");
  const cleanup = await Promise.allSettled(createdUsers.map(async (id) => checked(await admin.auth.admin.deleteUser(id), "Delete temporary test account")));
  const failed = cleanup.filter((result) => result.status === "rejected");
  if (failed.length) throw new AggregateError(failed.map((result) => result.reason), "Could not clean up local test accounts");
}
