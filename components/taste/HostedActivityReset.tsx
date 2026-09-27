"use client";

import { useEffect, useRef, useState } from "react";
import { resetHostedTasteHistory, resetLocalTasteHistory } from "@/lib/analytics/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function HostedActivityReset() {
  const [signedIn, setSignedIn] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const identity = useRef({ userId: null as string | null, epoch: 0 });

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let cancelled = false;
    function updateIdentity(userId: string | null) {
      if (cancelled) return;
      if (identity.current.userId !== userId) {
        identity.current = { userId, epoch: identity.current.epoch + 1 };
        setConfirm(false);
      }
      setSignedIn(Boolean(userId));
    }
    const initialEpoch = identity.current.epoch;
    void client.auth.getUser().then(({ data }) => {
      if (identity.current.epoch === initialEpoch) updateIdentity(data.user?.id ?? null);
    }).catch(() => {});
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      updateIdentity(session?.user?.id ?? null);
    });
    return () => { cancelled = true; identity.current = { userId: null, epoch: identity.current.epoch + 1 }; data.subscription.unsubscribe(); };
  }, []);

  async function resetAccount() {
    const confirmedIdentity = identity.current;
    if (pending || !confirmedIdentity.userId) return;
    setPending(true);
    setStatus("");
    try {
      await resetHostedTasteHistory(confirmedIdentity.userId);
      const client = getSupabaseBrowserClient();
      const current = client ? await client.auth.getUser() : null;
      if (current?.error || current?.data.user?.id !== confirmedIdentity.userId || identity.current.epoch !== confirmedIdentity.epoch) {
        setStatus("The previously confirmed account’s activity was cleared. Your account changed, so this device’s local history was kept.");
        setConfirm(false);
        return;
      }
      try {
        resetLocalTasteHistory();
        setStatus("Signed-in account activity and this device’s recommendation history cleared. Likes, follows, saved works, and collections were kept.");
      } catch {
        setStatus("Account activity was cleared, but this browser could not clear its local history. Use the local reset after enabling site storage.");
      }
      setConfirm(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account activity could not be cleared. Your local history was kept.");
    } finally { setPending(false); }
  }

  if (!signedIn) return null;
  return (
    <div className="mt-7 border-t border-[var(--hairline)] pt-6">
      <h3 className="text-sm font-medium">Signed-in account activity</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-text)]">Clear the activity and recommendation history associated with your signed-in account, along with this device’s history. This keeps your likes, follows, saved works, and collections. Guest activity recorded before sign-in is not included, and other devices keep their local history.</p>
      {!confirm ? <button type="button" onClick={() => setConfirm(true)} className="focus-ring mt-4 min-h-11 border border-[var(--hairline)] px-5 text-xs">Clear account activity</button> : <div role="group" aria-labelledby="account-reset-heading" className="mt-4 border border-[var(--oxblood)] p-5"><h4 id="account-reset-heading" className="text-sm font-medium">Permanently clear your account activity?</h4><p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">This deletion cannot be undone. New interactions will begin a new history; your passive-tracking choice stays unchanged.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => void resetAccount()} className="focus-ring min-h-11 bg-[var(--oxblood)] px-5 text-xs text-white disabled:opacity-50">{pending ? "Clearing account activity…" : "Confirm account activity reset"}</button><button type="button" disabled={pending} onClick={() => setConfirm(false)} className="focus-ring min-h-11 px-5 text-xs disabled:opacity-50">Cancel account reset</button></div></div>}
      <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-[var(--oxblood)]">{status}</p>
    </div>
  );
}
