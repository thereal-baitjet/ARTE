"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const client = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !email) return;

    setBusy(true);
    setStatus(null);

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/discover",
      },
    });

    setStatus(error ? "Sign-in could not be started." : "Check your email for the sign-in link.");
    setBusy(false);
  }

  if (!client) {
    return (
      <p className="max-w-xl text-sm leading-7 text-[var(--muted-text)]">
        Hosted authentication is not configured in this environment yet. The integration is ready for
        NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
      </p>
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
