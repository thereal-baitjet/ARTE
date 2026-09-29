import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
assert.ok(url && key && serviceKey, "Local Supabase credentials are required");
function localOrigin(value, label) {
  const parsed = new URL(value);
  assert.ok(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash,
  `${label} must be a disposable loopback HTTP service`);
  return parsed.origin;
}
const authOrigin = localOrigin(url, "Supabase");
const mailboxOrigin = localOrigin(process.env.SUPABASE_MAILBOX_URL || process.env.MAILPIT_URL || process.env.INBUCKET_URL || "http://127.0.0.1:54324", "Captured email");
assert.ok(process.env.NEXT_PUBLIC_SUPABASE_URL === url, "Build and browser must use the same local Supabase project");
assert.ok(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === key, "Build and browser must use the same public key");

// Match the local auth.site_url, so the real callback does not need a test-only auth bypass.
const base = "http://127.0.0.1:3000";
const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const mailboxName = `arte-magic-link-${randomUUID()}`;
const email = `${mailboxName}@example.test`;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const verifier = createClient(url, key, options);
const ui = expect.configure({ timeout: 15_000 });
const artifacts = "test-results/magic-link";
const checks = [];
const contexts = [];
const capturedIds = new Set();
let mailboxKind;
let userId;
let browser;
let page;
let pageErrorCount = 0;
let otpRequests = 0;
let failure;
const record = (message) => { checks.push(message); console.log(`PASS ${message}`); };
const checked = (result, operation) => {
  assert.ok(!result.error, `${operation} failed`);
  return result.data;
};
// Playwright navigation errors may include credential-bearing callback URLs.
const redact = (value) => String(value)
  .replace(/https?:\/\/[^\s"'<>]+/g, (match) => { try { const parsed = new URL(match); return `${parsed.origin}${parsed.pathname}[parameters redacted]`; } catch { return "[URL redacted]"; } })
  .replace(/\beyJ[A-Za-z0-9._-]+/g, "[token redacted]")
  .replace(/((?:access_token|refresh_token|token_hash|token|apikey|authorization)["'\s:=]+)[^\s,"'<>]+/gi, "$1[redacted]");

async function mailboxRequest(path, init = {}) {
  return fetch(`${mailboxOrigin}${path}`, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
}

async function discoverMailbox() {
  // Supabase CLI now uses Mailpit; older local stacks expose Inbucket's mailbox API.
  const mailpit = await mailboxRequest(`/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=10`);
  if (mailpit.ok && mailpit.headers.get("content-type")?.includes("application/json")) {
    const body = await mailpit.json();
    if (Array.isArray(body.messages)) return "mailpit";
  }
  const inbucket = await mailboxRequest(`/api/v1/mailbox/${encodeURIComponent(mailboxName)}`);
  if (inbucket.ok && inbucket.headers.get("content-type")?.includes("application/json") && Array.isArray(await inbucket.json())) return "inbucket";
  throw new Error("The local captured-email service is neither Mailpit nor Inbucket");
}

async function latestMail() {
  const path = mailboxKind === "mailpit"
    ? `/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=10`
    : `/api/v1/mailbox/${encodeURIComponent(mailboxName)}`;
  const response = await mailboxRequest(path);
  assert.ok(response.ok, "Read captured test mailbox");
  const listing = await response.json();
  const messages = mailboxKind === "mailpit" ? listing.messages : listing;
  assert.ok(Array.isArray(messages), "Captured mailbox has a valid message list");
  if (!messages.length) return null;
  for (const message of messages) capturedIds.add(mailboxKind === "mailpit" ? message.ID : message.id);
  const latest = mailboxKind === "mailpit" ? messages[0] : messages.toSorted((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const id = mailboxKind === "mailpit" ? latest.ID : latest.id;
  const detail = await mailboxRequest(mailboxKind === "mailpit"
    ? `/api/v1/message/${encodeURIComponent(id)}`
    : `/api/v1/mailbox/${encodeURIComponent(mailboxName)}/${encodeURIComponent(id)}`);
  assert.ok(detail.ok, "Read locally delivered sign-in email");
  const body = await detail.json();
  const addressedToTestUser = mailboxKind === "mailpit"
    ? body.To?.some((recipient) => recipient.Address?.toLowerCase() === email)
    : body.header?.To?.some((recipient) => recipient.toLowerCase().includes(email));
  assert.ok(addressedToTestUser, "Only the disposable recipient's captured message is consumed");
  return { html: body.HTML ?? body.body?.html ?? "", text: body.Text ?? body.body?.text ?? "" };
}

async function openBrowser() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  contexts.push(context);
  // Even a misbuilt app cannot send this test request to a hosted Auth project.
  await context.route("**/*", async (route) => {
    const target = new URL(route.request().url());
    if ([base, authOrigin].includes(target.origin)) await route.continue();
    else await route.abort("blockedbyclient");
  });
  const opened = await context.newPage();
  opened.setDefaultTimeout(15_000);
  opened.on("pageerror", () => { pageErrorCount += 1; });
  opened.on("request", (request) => {
    const target = new URL(request.url());
    if (target.origin === authOrigin && target.pathname === "/auth/v1/otp" && request.method() === "POST") otpRequests += 1;
  });
  return opened;
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"], {
  stdio: ["ignore", "ignore", "ignore"],
});

try {
  await mkdir(artifacts, { recursive: true });
  await ui.poll(async () => {
    if (server.exitCode !== null) throw new Error("The production Next server exited before the email test");
    try { return (await fetch(`${base}/api/health`, { redirect: "error", signal: AbortSignal.timeout(2000) })).ok; } catch { return false; }
  }, { message: "Production Next server becomes healthy", intervals: [100, 250, 500] }).toBe(true);
  mailboxKind = await discoverMailbox();
  userId = checked(await admin.auth.admin.createUser({ email, email_confirm: true }), "Create disposable confirmed account").user.id;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--disable-gpu"] : [],
  });
  page = await openBrowser();
  await page.goto(`${base}/auth`);
  await ui(page.getByRole("button", { name: "Send magic link", exact: true })).toBeVisible();
  assert.ok(await page.evaluate((name) => localStorage.getItem(name) === null, storageKey), "Browser starts without an injected or pre-existing session");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  const responsePromise = page.waitForResponse((response) => {
    const target = new URL(response.url());
    return target.origin === authOrigin && target.pathname === "/auth/v1/otp" && response.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Send magic link", exact: true }).click();
  const response = await responsePromise;
  assert.ok(response.ok(), `Real local Auth accepts the email request (HTTP ${response.status()})`);
  assert.ok(response.request().postDataJSON()?.email === email, "Auth receives the disposable recipient from the real form");
  await ui(page.getByRole("status").filter({ hasText: /Check your email for the sign-in link/ })).toBeVisible();
  await ui(page.getByRole("button", { name: /Send again in \d+s/ })).toBeDisabled();
  assert.equal(otpRequests, 1, "One form submission sends one Auth request");
  record("Real email form reaches local Supabase Auth and enters the resend cooldown");

  let delivered;
  await ui.poll(async () => { delivered = await latestMail(); return Boolean(delivered); }, {
    message: "Supabase delivers the sign-in email into the local SMTP capture", timeout: 30_000, intervals: [250, 500, 1000],
  }).toBe(true);
  const candidates = await page.evaluate(({ html, text }) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    return [...Array.from(document.querySelectorAll("a[href]"), (link) => link.getAttribute("href")), ...(text.match(/https?:\/\/[^\s<>"']+/g) ?? [])];
  }, delivered);
  const link = candidates.map((candidate) => { try { return new URL(candidate); } catch { return null; } })
    .find((candidate) => candidate?.pathname === "/auth/v1/verify");
  assert.ok(link && link.origin === authOrigin && !link.username && !link.password, "The delivered verification link targets only local Supabase Auth");
  assert.ok(link.searchParams.get("type") === "magiclink", "The delivered email contains an actual magic-link verification token");
  assert.ok(link.searchParams.get("token") || link.searchParams.get("token_hash"), "The delivered verification token is present");
  assert.ok(link.searchParams.get("redirect_to") === `${base}/auth`, "The real email preserves the configured ARTE callback");
  record("Supabase SMTP delivers the requested magic link to the disposable local inbox");

  await page.goto(link.href);
  await ui(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await ui(page.getByText(email, { exact: true })).toBeVisible();
  await ui.poll(() => { const location = new URL(page.url()); return location.origin === base && location.pathname === "/auth" && !location.hash && !location.search; }, {
    message: "The callback consumes and removes credential parameters",
  }).toBe(true);
  const accessToken = await page.evaluate((name) => JSON.parse(localStorage.getItem(name) ?? "null")?.access_token, storageKey);
  assert.ok(typeof accessToken === "string" && accessToken.length > 0, "The email callback establishes a genuine Auth session");
  const identity = checked(await verifier.auth.getUser(accessToken), "Verify the callback-issued session with Supabase Auth").user;
  assert.ok(identity.id === userId && identity.email === email, "The callback authenticates exactly the email recipient");
  await page.goto(`${base}/profile`);
  await page.reload();
  await ui(page.getByText(email, { exact: true })).toBeVisible();
  await ui(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/email-authenticated-profile-mobile.png`, fullPage: true });
  record("Delivered link signs in the correct account, clears URL credentials, and survives profile reload");

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await ui(page.getByRole("button", { name: "Send magic link", exact: true })).toBeVisible();
  page = await openBrowser();
  await page.goto(link.href);
  await ui(page.getByRole("status").filter({ hasText: /expired or could not be used/ })).toBeVisible();
  await ui(page.getByRole("button", { name: "Send magic link", exact: true })).toBeEnabled();
  await ui(page.getByRole("textbox", { name: "Email", exact: true })).toBeEnabled();
  await ui(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  assert.ok(await page.evaluate((name) => localStorage.getItem(name) === null, storageKey), "A consumed link cannot establish another session");
  await ui.poll(() => { const location = new URL(page.url()); return location.origin === base && location.pathname === "/auth" && !location.hash && !location.search; }, {
    message: "Rejected callback clears stale URL errors",
  }).toBe(true);
  await page.screenshot({ path: `${artifacts}/consumed-link-recovery-mobile.png`, fullPage: true });
  record("A consumed magic link remains signed out and offers a usable fresh-link form");
  assert.equal(otpRequests, 1, "Recovery does not resend mail without user input");
  assert.equal(pageErrorCount, 0, "Email sign-in and recovery have no uncaught browser errors");
} catch (error) {
  failure = redact(error instanceof Error ? error.message : error);
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  server.kill("SIGTERM");
  const cleanup = [];
  if (userId) cleanup.push({
    operation: "Delete disposable email-test account",
    run: async () => {
      const result = await admin.auth.admin.deleteUser(userId);
      if (result.error) throw new Error(`Auth cleanup failed (HTTP ${result.error.status ?? "unknown"}, code ${result.error.code ?? "unknown"}): ${result.error.message}`);
    },
  });
  if (mailboxKind === "mailpit" && capturedIds.size) {
    cleanup.push({
      operation: "Delete captured Mailpit test messages",
      run: async () => {
        const response = await mailboxRequest("/api/v1/messages", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ IDs: [...capturedIds] }) });
        assert.ok(response.ok, `Mailpit cleanup failed (HTTP ${response.status})`);
      },
    });
  } else if (mailboxKind === "inbucket") {
    cleanup.push({
      operation: "Delete disposable Inbucket test mailbox",
      run: async () => {
        const response = await mailboxRequest(`/api/v1/mailbox/${encodeURIComponent(mailboxName)}`, { method: "DELETE" });
        assert.ok(response.ok, `Inbucket cleanup failed (HTTP ${response.status})`);
      },
    });
  }
  const results = await Promise.allSettled(cleanup.map(({ run }) => run()));
  const cleanupResults = results.map((result, index) => ({
    operation: cleanup[index].operation,
    status: result.status,
    ...(result.status === "rejected" ? { error: redact(result.reason instanceof Error ? result.reason.message : result.reason) } : {}),
  }));
  const cleanupErrors = cleanupResults.filter((result) => result.status === "rejected").map(({ operation, error }) => `${operation}: ${error}`);
  if (cleanupErrors.length) failure = [failure, "Local email-test cleanup did not complete", ...cleanupErrors].filter(Boolean).join("\n");
  await writeFile(`${artifacts}/report.json`, JSON.stringify({ checks, mailbox: mailboxKind, uncaughtPageErrors: pageErrorCount, cleanup: cleanupResults, ...(failure ? { failure } : {}) }, null, 2));
}
if (failure) throw new Error(failure);
console.log(`Real local SMTP and magic-link browser integration passed ${checks.length} release gates.`);
