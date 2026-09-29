export const MAGIC_LINK_TIMEOUT_MS = 15_000;
const TIMEOUT_MESSAGE = "Sign-in request timed out.";

type SignInError = { code?: string; status?: number; name?: string; message?: string };
function details(error: unknown): SignInError { return typeof error === "object" && error !== null ? error as SignInError : {}; }

export function magicLinkIsUncertain(value: unknown) {
  const error = details(value);
  return error.message === TIMEOUT_MESSAGE || error.status === 0 || error.name === "AuthRetryableFetchError" || error.name === "TypeError";
}

export function magicLinkErrorMessage(value: unknown): string {
  const error = details(value);
  if (error.message === TIMEOUT_MESSAGE) return "The sign-in service took too long to respond. We could not confirm delivery. Check your inbox and spam folder before requesting another link.";
  if (error.code === "email_address_not_authorized") return "Email delivery is not enabled for this address. ARTE’s email service needs to be configured before this address can sign in.";
  if (error.code === "otp_disabled" || error.code === "email_provider_disabled") return "Email sign-in is temporarily unavailable. ARTE’s email service needs attention.";
  if (error.code === "signup_disabled") return "New account registration is currently unavailable. Use an existing account email.";
  if (error.code === "email_address_invalid" || error.code === "validation_failed") return "Please check your email address and try again.";
  if (error.code === "captcha_failed") return "The sign-in verification could not be completed. Please reload this page and try again.";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") return "Email requests are temporarily limited. Please wait before requesting another sign-in link.";
  if (magicLinkIsUncertain(error)) return "We could not confirm that your sign-in email was sent. Check your connection and inbox before trying again.";
  return "The sign-in service could not send your email. Please try again shortly.";
}

/** Bound both headers and body; an interrupted send may still have queued an email. */
export const fetchWithMagicLinkTimeout: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).pathname !== "/auth/v1/otp") return fetch(input, init);
  const controller = new AbortController();
  const original = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const cancel = () => controller.abort(original?.reason);
  if (original?.aborted) cancel();
  else original?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, MAGIC_LINK_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = await response.arrayBuffer();
    return new Response(response.status === 204 || response.status === 205 || response.status === 304 ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    if (timedOut) throw new Error(TIMEOUT_MESSAGE);
    throw error;
  } finally {
    clearTimeout(timer);
    original?.removeEventListener("abort", cancel);
  }
};
