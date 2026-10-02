"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth/session";

export function useCorridorAccess(artworkId: string, enabled = true) {
  const auth = useAuth();
  const token = auth.status === "authenticated" ? auth.session?.access_token : undefined;
  const identity = token ? `${artworkId}:${auth.revision}:${token}` : null;
  const [eligibleFor, setEligibleFor] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !token || !identity) return;
    let disposed = false;
    let generation = 0;
    let controller: AbortController | undefined;
    const verify = async () => {
      if (document.visibilityState !== "visible") return;
      const current = ++generation;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 10_000);
      try {
        const response = await fetch(`/api/corridor/${artworkId}?access=1`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: requestController.signal,
        });
        const data: unknown = await response.json();
        if (disposed || current !== generation) return;
        const eligible = response.ok && typeof data === "object" && data !== null && "eligible" in data && data.eligible === true;
        setEligibleFor(eligible ? identity : null);
      } catch {
        if (!disposed && current === generation) setEligibleFor(null);
      } finally { window.clearTimeout(timeout); }
    };
    void verify();
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    const timer = window.setInterval(verify, 60_000);
    return () => {
      disposed = true; generation++; controller?.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", verify); document.removeEventListener("visibilitychange", verify);
    };
  }, [artworkId, token, identity, enabled]);

  return { eligible: enabled && identity !== null && eligibleFor === identity, identity, token,
    denyAccess: () => setEligibleFor(null) };
}
