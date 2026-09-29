"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getAuthSnapshot, useAuth } from "@/lib/auth/session";
import {
  readHiddenArtworkIds, resetHostedTasteHistory, resetLocalTasteHistory,
  restoreHiddenArtworkHistory, retryAccountActivity, setPersonalizationAnalyticsEnabled, useActivitySnapshot,
} from "@/lib/analytics/client";

const control = "focus-ring min-h-11 border border-[var(--hairline)] px-5 py-3 text-xs disabled:opacity-45";

export function PrivacySettings() {
  const auth = useAuth();
  return <PrivacyControls key={auth.user?.id ?? auth.status} />;
}

function PrivacyControls() {
  const auth = useAuth();
  const activity = useActivitySnapshot();
  const [confirmReset, setConfirmReset] = useState(false);
  const [clearLikes, setClearLikes] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const privacyId = useId();
  const resetId = useId();
  const account = auth.status === "authenticated" && auth.user;
  const scope = account ? account.id : auth.status === "guest" ? "guest" : null;
  const ready = activity.status === "ready" && scope !== null && activity.scope === scope;
  const hiddenCount = ready ? readHiddenArtworkIds().length : 0;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function change(operation: () => Promise<void> | void, success: string) {
    if (!ready || pendingRef.current) return;
    pendingRef.current = true;
    const revision = getAuthSnapshot().revision;
    setPending(true);
    setStatus("");
    try {
      await operation();
      if (mounted.current && revision === getAuthSnapshot().revision) {
        setStatus(success);
        setConfirmReset(false);
      }
    } catch (error) {
      if (mounted.current && revision === getAuthSnapshot().revision) setStatus(error instanceof Error ? error.message : "Your change could not be completed. Please check your connection and try again.");
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function reset() {
    void change(() => account ? resetHostedTasteHistory(account.id) : resetLocalTasteHistory(clearLikes),
      account ? "Your account’s recommendation history was cleared. Likes, followed artists, saved works, and collections were kept."
        : clearLikes ? "Local recommendation history, hidden works, and guest likes and follows cleared. Saved works and collections were kept."
          : "Local recommendation history and hidden works cleared. Likes, follows, saved works, and collections were kept.");
  }

  return (
    <section aria-labelledby={privacyId}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-text)]">You are in control</p>
      <h2 id={privacyId} className="display-serif mt-3 text-4xl">Activity & privacy</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--secondary-ink)]">{account
        ? "Your account’s recent activity shapes your recommendations and Art DNA across devices. These controls apply to your account. Guest history stays separate."
        : auth.status === "guest" ? "Guest recommendations and Art DNA use activity stored in this browser. These controls apply to this device. Sign in to keep account activity across devices." : "Your activity settings will be available when your account has been checked."}</p>
      {!ready && activity.status !== "error" && <p role="status" className="mt-6 text-sm leading-7 text-[var(--muted-text)]">Preparing your privacy settings…</p>}
      {activity.status === "error" && <div role="status" className="mt-6 text-sm leading-7"><p>{activity.error ?? "Your activity settings could not be loaded."}</p><button type="button" onClick={() => void retryAccountActivity()} className="focus-ring min-h-11 underline underline-offset-4">Retry privacy settings</button></div>}
      <div className="mt-8 border-y border-[var(--hairline)] py-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-lg">
            <h3 className="text-sm font-medium">Passive activity tracking</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted-text)]">{ready ? activity.enabled ? "On: viewing and dwell-time signals can shape your gallery." : "Paused: new passive signals are not recorded." : "Your current preference will appear when your settings are ready."} Likes, saves, searches, and other intentional actions still work and can shape recommendations. Pausing keeps earlier activity.</p>
          </div>
          <button type="button" aria-pressed={ready ? !activity.enabled : false} disabled={!ready || pending} onClick={() => void change(() => setPersonalizationAnalyticsEnabled(!activity.enabled), activity.enabled ? "Passive activity tracking paused." : "Passive activity tracking resumed.")} className={control}>{ready && !activity.enabled ? "Resume passive tracking" : "Pause passive tracking"}</button>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-[var(--hairline)] pt-6">
          <button type="button" disabled={!ready || pending || !hiddenCount} onClick={() => void change(restoreHiddenArtworkHistory, "Hidden works restored. They can appear on your next feed refresh.")} className={control}>Restore hidden works ({hiddenCount})</button>
          <button type="button" disabled={!ready || pending} onClick={() => { setConfirmReset(true); setClearLikes(false); }} className="focus-ring min-h-11 px-2 text-xs text-[var(--muted-text)] underline underline-offset-4 disabled:opacity-45">{account ? "Clear account activity" : "Reset local recommendations"}</button>
        </div>
        {confirmReset && ready && <div role="group" aria-labelledby={resetId} className="mt-6 border-l border-[var(--oxblood)] pl-5">
          <h3 id={resetId} className="display-serif text-2xl">{account ? "Start your account’s taste history again?" : "Start your local taste history again?"}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--secondary-ink)]">{account ? "This clears your account activity and recommendation history. Your likes, followed artists, saved works, collections, and tracking preference stay as they are." : "This clears recommendation history and restores hidden works on this device. Saved works, collections, and your tracking preference stay as they are."} This deletion cannot be undone.</p>
          {!account && <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={clearLikes} disabled={pending} onChange={(event) => setClearLikes(event.target.checked)} className="focus-ring h-4 w-4 accent-[var(--oxblood)]" />Also clear guest likes and follows on this device</label>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={pending} onClick={reset} className={`${control} border-[var(--oxblood)] text-[var(--oxblood)]`}>{pending ? "Clearing history…" : account ? "Confirm account activity reset" : "Confirm local reset"}</button>
            <button type="button" disabled={pending} onClick={() => setConfirmReset(false)} className="focus-ring min-h-11 px-5 text-xs disabled:opacity-45">{account ? "Cancel account reset" : "Cancel"}</button>
          </div>
        </div>}
      </div>
      <p className="mt-5 max-w-2xl text-xs leading-6 text-[var(--muted-text)]">ARTE uses up to 500 recent activity signals to calculate your recommendations and Art DNA. A reset clears activity history. {account ? "Retained likes, saved works, and followed artists can still guide your taste, along with new interactions." : "New interactions begin a new local taste history."}</p>
      {status ? <p role="status" aria-live="polite" className="mt-4 text-sm leading-7 text-[var(--secondary-ink)]">{status}</p> : null}
    </section>
  );
}
