"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/lib/auth/session";

const Panel = dynamic(() => import("./SharedCorridorPanel"), {
  loading: () => <p className="py-6 text-sm text-[var(--secondary-ink)]" role="status">Opening the corridor…</p>,
});

export function SharedCorridorGate({ artworkId }: { artworkId: string }) {
  const auth = useAuth();
  const token = auth.status === "authenticated" ? auth.session?.access_token : undefined;
  const [eligibleFor, setEligibleFor] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const panelId = useId();
  const identity = token ? `${artworkId}:${auth.revision}:${token}` : null;

  useEffect(() => {
    if (!token || !identity) return;
    let disposed = false;
    let generation = 0;
    let controller: AbortController | undefined;
    const verify = async () => {
      if (document.visibilityState !== "visible") return;
      const current = ++generation;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/corridor/${artworkId}?access=1`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (disposed || current !== generation) return;
        if (response.ok && data.eligible === true) setEligibleFor(identity);
        else { setEligibleFor(null); setOpenFor(null); }
      } catch {
        if (!disposed && current === generation) { setEligibleFor(null); setOpenFor(null); }
      }
    };
    void verify();
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    const timer = window.setInterval(verify, 60_000);
    return () => {
      disposed = true; generation++; controller?.abort(); clearInterval(timer);
      window.removeEventListener("focus", verify); document.removeEventListener("visibilitychange", verify);
    };
  }, [artworkId, token, identity]);

  if (!identity || !token || eligibleFor !== identity) return null;
  const open = openFor === identity;
  return (
    <section aria-label="Shared Corridor" className="mx-auto mt-14 max-w-2xl border-t border-[var(--hairline)] pt-5">
      <button type="button" className="focus-ring min-h-11 py-2 text-left text-sm text-[var(--secondary-ink)] underline decoration-current/30 underline-offset-8"
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpenFor(open ? null : identity)}>
        Leave a note in the Shared Corridor
      </button>
      <div id={panelId} hidden={!open}>
        {open && <Panel key={identity} artworkId={artworkId} token={token}
          onAccessLost={() => { setEligibleFor(null); setOpenFor(null); }} />}
      </div>
    </section>
  );
}
