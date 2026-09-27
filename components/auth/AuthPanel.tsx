"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const client = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(client));

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setAccountEmail(session?.user.email ?? null);
        setCheckingSession(false);
      }
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      setAccountEmail(data.session?.user.email ?? null);
      if (error) setStatus("Your session could not be checked. Please sign in again.");
      setCheckingSession(false);
    }).catch(() => {
      if (!cancelled) { setCheckingSession(false); setStatus("Your session could not be checked. Please try again."); }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [client]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !email) return;

    setBusy(true);
    setStatus(null);

    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      setStatus(error ? "Sign-in could not be started. Please try again." : "Check your email for the sign-in link.");
    } catch {
      setStatus("Sign-in could not be started. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (!client || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await client.auth.signOut();
      if (error) setStatus("Sign-out could not be completed. Please try again.");
      else { setAccountEmail(null); setStatus("You are signed out."); }
    } catch {
      setStatus("Sign-out could not be completed. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (!client) {
    return (
      <p className="max-w-xl text-sm leading-7 text-[var(--muted-text)]">
        This preview is open to guests. Likes, saves, collections, and taste preferences stay in this browser.
        Account sign-in will be available when cloud sync is connected.
      </p>
    );
  }

  if (checkingSession) return <p role="status" className="mt-8 text-sm text-[var(--muted-text)]">Checking your account…</p>;

  if (accountEmail) {
    return (
      <div className="mt-8 space-y-5">
        <p className="text-sm text-[var(--secondary-ink)]">Signed in as <strong>{accountEmail}</strong></p>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted-text)]">Account likes and saves are stored securely. Your recommendation history and Art DNA currently stay on this device.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/discover" className="focus-ring bg-[var(--primary-ink)] px-5 py-4 text-xs uppercase tracking-[0.14em] text-[var(--soft-white)]">Enter the gallery</Link>
          <button type="button" disabled={busy} onClick={() => void signOut()} className="focus-ring min-h-12 border border-[var(--hairline)] px-5 text-xs uppercase tracking-[0.14em] disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>
        </div>
        {status ? <p role="status" className="text-sm text-[var(--muted-text)]">{status}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-md space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted-text)]">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 min-h-12 w-full border border-[var(--hairline)] bg-[var(--soft-white)] px-4 outline-none focus:border-[var(--primary-ink)]"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="focus-ring min-h-12 bg-[var(--primary-ink)] px-5 text-xs uppercase tracking-[0.14em] text-[var(--soft-white)] disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send magic link"}
      </button>
      {status ? <p role="status" className="text-sm text-[var(--muted-text)]">{status}</p> : null}
    </form>
  );
}
