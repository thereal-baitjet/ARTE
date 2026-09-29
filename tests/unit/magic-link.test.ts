import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchWithMagicLinkTimeout, MAGIC_LINK_TIMEOUT_MS, magicLinkErrorMessage } from "../../lib/auth/magic-link.ts";

test("magic-link timeout aborts a stalled request and returns a recoverable error", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  context.mock.method(globalThis, "fetch", (_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); });
  }));
  const result = assert.rejects(fetchWithMagicLinkTimeout("https://example.supabase.co/auth/v1/otp", { method: "POST" }), /Sign-in request timed out/);
  context.mock.timers.tick(MAGIC_LINK_TIMEOUT_MS);
  await result;
  assert.equal(aborted, true);
});

test("magic-link deadline also covers a response body that never finishes", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => new Response(new ReadableStream({
    start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError"))); },
  })));
  const result = assert.rejects(fetchWithMagicLinkTimeout("https://example.supabase.co/auth/v1/otp"), /Sign-in request timed out/);
  await Promise.resolve();
  context.mock.timers.tick(MAGIC_LINK_TIMEOUT_MS);
  await result;
});

test("account queries retain their original response and cancellation signal", async (context) => {
  const controller = new AbortController();
  const response = new Response("[]");
  context.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.signal, controller.signal);
    return response;
  });
  assert.equal(await fetchWithMagicLinkTimeout("https://example.supabase.co/rest/v1/saves", { signal: controller.signal }), response);
});

test("email errors distinguish provider restrictions, throttling and unconfirmed delivery without exposing backend text", () => {
  assert.match(magicLinkErrorMessage({ code: "email_address_not_authorized" }), /Email delivery is not enabled/);
  assert.match(magicLinkErrorMessage({ status: 429 }), /temporarily limited/);
  assert.match(magicLinkErrorMessage({ message: "Sign-in request timed out." }), /could not confirm delivery/);
  const message = magicLinkErrorMessage({ message: "Private SMTP credential details", status: 500 });
  assert.doesNotMatch(message, /credential/);
  assert.doesNotMatch(message, /sent successfully/i);
});
