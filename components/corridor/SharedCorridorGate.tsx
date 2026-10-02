"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { useCorridorAccess } from "@/lib/corridor/useCorridorAccess";

const Panel = dynamic(() => import("./SharedCorridorPanel"), {
  loading: () => <p className="py-6 text-sm text-[var(--secondary-ink)]" role="status">Opening the corridor…</p>,
});

export function SharedCorridorGate({ artworkId }: { artworkId: string }) {
  const { eligible, identity, token, denyAccess } = useCorridorAccess(artworkId);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const panelId = useId();
  const entry = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (eligible && window.location.hash === "#shared-corridor") {
      entry.current?.focus({ preventScroll: true });
      entry.current?.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [eligible, identity]);
  if (!identity || !token || !eligible) return null;
  const open = openFor === identity;
  return (
    <section id="shared-corridor" aria-label="Shared Corridor" className="mt-8 scroll-mt-8 border-t border-[var(--hairline)] pt-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-text)]">Shared Corridor · Private guestbook</p>
      <button ref={entry} type="button" className="focus-ring min-h-11 py-2 text-left text-sm text-[var(--secondary-ink)] underline decoration-current/30 underline-offset-8"
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpenFor(open ? null : identity)}>
        Leave a note in the Shared Corridor
      </button>
      <div id={panelId} hidden={!open}>
        {open && <Panel key={identity} artworkId={artworkId} token={token}
          onAccessLost={() => { denyAccess(); setOpenFor(null); }} />}
      </div>
    </section>
  );
}
