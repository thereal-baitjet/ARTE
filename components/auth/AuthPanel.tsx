"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { getAuthSnapshot, retryAuth, useAuth } from "@/lib/auth/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel({ compact = false }: { compact?: boolean }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const statusId = useId();
  const errorId = useId();

  useEffect(() => {
    mounted.current = true;
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.has("error") || fragment.has("error") || url.searchParams.has("error_code") || fragment.has("error_code")) {
      queueMicrotask(() => {
        if (mounted.current) setStatus("This sign-in link has expired or could not be used. Request a fresh link below.");
      });
      for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
      url.hash = "";
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (!remaining) { clearInterval(timer); setCooldownUntil(0); }
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !email.trim() || pending.current || Date.now() < cooldownUntil) return;
    pending.current = true;
    setBusy(true);
    setStatus(null);
    const identityRevision = getAuthSnapshot().revision;
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      if (!mounted.current || getAuthSnapshot().revision !== identityRevision) return;
      if (error) {
        setStatus(error.status === 429 ? "Please wait a moment before requesting another sign-in link." : "Sign-in could not be started. Please try again.");
      } else {
        setStatus("Check your email for the sign-in link. You can close this page and return from your email.");
        setCooldownUntil(Date.now() + 60_000);
        setSecondsRemaining(60);
      }
    } catch {
      if (mounted.current && getAuthSnapshot().revision === identityRevision) setStatus("Sign-in could not be started. Check your connection and try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client || pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (mounted.current) setStatus(error ? "Sign-out could not be completed. Please try again." : "You are signed out.");
    } catch {
      if (mounted.current) setStatus("Sign-out could not be completed. Check your connection and try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (!auth.configured) {
    return <p className="max-w-xl text-sm leading-7 text-[var(--muted-text)]">Explore freely as a guest. Likes, saves, and collections stay in this browser. Account sign-in is not available yet.</p>;
  }
  if (auth.status === "loading") return <p role="status" className="text-sm leading-7 text-[var(--muted-text)]">Checking your account…</p>;

  if (auth.status === "authenticated" && auth.user) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-text)]">Private account</p>
          <p className="mt-2 break-words text-sm leading-7 text-[var(--secondary-ink)]">Signed in as <strong className="font-medium">{auth.user.email ?? "an ARTE member"}</strong></p>
        </div>
        {!compact && <p className="max-w-xl text-sm leading-7 text-[var(--muted-text)]">Your saved works, collections, and recent activity are linked to your account. Return on another device to continue exploring your gallery.</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {!compact && <Link href="/discover" className="focus-ring inline-flex min-h-12 items-center border-b border-[var(--primary-ink)] text-xs uppercase tracking-[0.12em]">Enter the gallery</Link>}
          <button type="button" disabled={busy} onClick={() => void signOut()} className="focus-ring min-h-12 text-xs text-[var(--muted-text)] underline underline-offset-4 disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>
        </div>
        <p className="text-xs leading-6 text-[var(--muted-text)]">Signing out closes your session in this browser. Other devices stay signed in.</p>
        {status && <p role="status" className="text-sm leading-7 text-[var(--secondary-ink)]">{status}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {auth.status === "error" && <div id={errorId} role="status" className="mb-5 text-sm leading-7 text-[var(--secondary-ink)]"><p>{auth.error ?? "Your account could not be checked. Please try again."}</p><div className="flex flex-wrap gap-x-5"><button type="button" disabled={busy} onClick={() => void retryAuth()} className="focus-ring min-h-11 underline underline-offset-4">Retry account check</button><button type="button" disabled={busy} onClick={() => void signOut()} className="focus-ring min-h-11 underline underline-offset-4">Use a different account</button></div></div>}
      <form onSubmit={submit} className="space-y-4" aria-describedby={auth.status === "error" ? errorId : undefined}>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted-text)]">Email</span>
          <input type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} disabled={busy}
            onChange={(event) => setEmail(event.target.value)} aria-describedby={status ? statusId : undefined}
            className="focus-ring mt-2 min-h-12 w-full border border-[var(--hairline)] bg-[var(--soft-white)] px-4 text-base disabled:opacity-50" />
        </label>
        <button type="submit" disabled={busy || secondsRemaining > 0} className="focus-ring min-h-12 border border-[var(--primary-ink)] px-5 text-xs uppercase tracking-[0.12em] disabled:opacity-50">
          {busy ? "Sending…" : secondsRemaining > 0 ? `Send again in ${secondsRemaining}s` : "Send magic link"}
        </button>
        <p className="text-xs leading-6 text-[var(--muted-text)]">A private sign-in link, with no password to remember.</p>
        {status && <p id={statusId} role="status" className="text-sm leading-7 text-[var(--secondary-ink)]">{status}</p>}
      </form>
    </div>
  );
}
