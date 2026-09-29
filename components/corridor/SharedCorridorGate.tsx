"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const Panel = dynamic(() => import("./SharedCorridorPanel"), {
  loading: () => <p className="py-6 text-sm text-[var(--secondary-ink)]" role="status">Opening the corridor…</p>,
});
type Access = { token: string; userId: string };

export function SharedCorridorGate({ artworkId }: { artworkId: string }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const identity = useRef<string | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let disposed = false;
    let generation = 0;
    let controller: AbortController | undefined;
    const verify = async (token?: string, userId?: string) => {
      const current = ++generation;
      controller?.abort();
      controller = new AbortController();
      if (!token || !userId) { setAccess(null); setOpen(false); return; }
      try {
        const response = await fetch(`/api/corridor/${artworkId}?access=1`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (disposed || current !== generation) return;
        if (response.ok && data.eligible === true) setAccess({ token, userId });
        else { setAccess(null); setOpen(false); }
      } catch {
        if (!disposed && current === generation) { setAccess(null); setOpen(false); }
      }
    };
    // Auth events clear private state synchronously, before another account can render it.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const nextIdentity = session ? `${session.user.id}:${session.access_token}` : null;
      if (identity.current !== nextIdentity) { setAccess(null); setOpen(false); identity.current = nextIdentity; }
      void verify(session?.access_token, session?.user.id);
    });
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const before = generation;
      void client.auth.getSession().then(({ data }) => {
        if (!disposed && before === generation) void verify(data.session?.access_token, data.session?.user.id);
      }).catch(() => { if (!disposed) { setAccess(null); setOpen(false); } });
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      disposed = true; generation++; controller?.abort(); subscription.unsubscribe();
      clearInterval(timer); window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [artworkId]);

  if (!access) return null;
  return (
    <section aria-label="Shared Corridor" className="mx-auto mt-14 max-w-2xl border-t border-[var(--hairline)] pt-5">
      <button type="button" className="focus-ring min-h-11 py-2 text-left text-sm text-[var(--secondary-ink)] underline decoration-current/30 underline-offset-8"
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        Leave a note in the Shared Corridor
      </button>
      <div id={panelId} hidden={!open}>
        {open && <Panel key={`${artworkId}:${access.userId}:${access.token}`} artworkId={artworkId} token={access.token}
          onAccessLost={() => { setAccess(null); setOpen(false); }} />}
      </div>
    </section>
  );
}
