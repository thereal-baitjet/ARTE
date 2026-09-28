"use client";

import Link from "next/link";
import { HostedActivityReset } from "./HostedActivityReset";
import { useEffect, useState } from "react";
import { personalizationAnalyticsEnabled, readHiddenArtworkIds, readStoredEvents, resetLocalTasteHistory, restoreHiddenArtworkHistory, setPersonalizationAnalyticsEnabled } from "@/lib/analytics/client";
import type { TasteSummary } from "@/lib/taste/profile";
import { tasteShareText } from "@/lib/taste/share";

const EMPTY_SUMMARY: TasteSummary = { dimensions: [], eventCount: 0, artworkCount: 0, hasPositiveSignals: false, headline: "Your eye is still exploring." };

function TasteCard({ summary }: { summary: TasteSummary }) {
  return (
    <section aria-label="Your Art DNA card" data-testid="taste-card" className="relative overflow-hidden bg-[var(--oxblood)] p-7 text-[var(--soft-white)] md:p-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border border-white/15" />
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/75">ARTE / An evolving portrait</p>
      <h2 className="display-serif relative mt-10 max-w-xl text-4xl leading-tight md:text-5xl">{summary.headline}</h2>
      <p className="mt-7 max-w-md text-sm leading-7 text-white/80">{summary.hasPositiveSignals ? "Your recent activity suggests these connections. Follow your curiosity and the picture will change." : "Like a work, save a discovery, or try the optional visual selection to begin."}</p>
      <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/25 pt-5 text-[10px] uppercase tracking-[0.13em]">
        <span>{summary.eventCount} weighted activity signals</span>
        <span>{summary.artworkCount} artworks explored</span>
        <span>This device</span>
      </div>
    </section>
  );
}

export function TasteDashboard() {
  const [summary, setSummary] = useState<TasteSummary>(EMPTY_SUMMARY);
  const [calculationError, setCalculationError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [clearLikes, setClearLikes] = useState(false);
  const [status, setStatus] = useState("");
  const [shareText, setShareText] = useState<string | null>(null);

  useEffect(() => {
    let controller: AbortController | null = null;
    let version = 0;
    async function refresh() {
      const current = ++version;
      controller?.abort();
      controller = new AbortController();
      setHiddenCount(readHiddenArtworkIds().length);
      setEnabled(personalizationAnalyticsEnabled());
      setShareText(null);
      setCalculationError("");
      setSummary(EMPTY_SUMMARY);
      const events = readStoredEvents();
      if (!events.length) { setReady(true); return; }
      setReady(false);
      try {
        const response = await fetch("/api/taste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }), signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Your Art DNA could not be calculated. Your saved activity has not changed.");
        const result = await response.json() as TasteSummary;
        if (current === version) { setSummary(result); setReady(true); }
      } catch (error) {
        if (current === version && !(error instanceof Error && error.name === "AbortError")) { setCalculationError(error instanceof Error ? error.message : "Your Art DNA is temporarily unavailable."); setReady(true); }
      }
    }
    const notify = () => { void refresh(); };
    notify();
    const subscriptions = ["arte:analytics-event", "arte:analytics-reset", "arte:analytics-preference", "storage"];
    subscriptions.forEach((event) => window.addEventListener(event, notify));
    return () => { version++; controller?.abort(); subscriptions.forEach((event) => window.removeEventListener(event, notify)); };
  }, [attempt]);

  async function shareTaste() {
    const text = tasteShareText(summary);
    setShareText(text);
    setStatus("");
    if (navigator.share) {
      try { await navigator.share({ title: "My ARTE Art DNA", text }); setStatus("Your taste card was shared."); }
      catch { setStatus("Sharing closed. Your taste card text is available below."); }
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); setStatus("Taste card text copied. Only the summary was included."); }
      catch { setStatus("Copy is unavailable. Select and copy the text below."); }
    } else setStatus("Select and copy the taste card text below.");
  }

  function toggleTracking() {
    try { setPersonalizationAnalyticsEnabled(!enabled); setStatus(enabled ? "Passive activity tracking paused on this device. Explicit actions still shape recommendations." : "Passive activity tracking resumed on this device."); }
    catch { setStatus("This browser could not save your preference. Check whether site storage is allowed."); }
  }

  function restoreHidden() {
    try { restoreHiddenArtworkHistory(); setShareText(null); setStatus("Hidden works restored. They can appear on your next feed refresh."); }
    catch { setStatus("Your hidden history could not be changed. Please try again."); }
  }

  function resetHistory() {
    try {
      resetLocalTasteHistory(clearLikes);
      setConfirmReset(false);
      setShareText(null);
      setStatus(clearLikes ? "Local recommendation history, hidden works, and guest likes and follows cleared. Saved works and collections were kept." : "Local recommendation history and hidden works cleared. Likes, follows, saved works, and collections were kept.");
    } catch { setStatus("Your local history could not be fully cleared. Please try again."); }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">A reflection of your curiosity</p><h1 className="display-serif mt-4 text-6xl md:text-8xl">Your Art DNA</h1></div>
        <Link href="/onboarding" className="focus-ring inline-flex min-h-11 items-center border-b border-[var(--primary-ink)] text-xs uppercase tracking-[0.13em]">Choose your starting works</Link>
      </div>
      <p className="mt-6 max-w-3xl leading-7 text-[var(--secondary-ink)]">An evolving estimate from your recent activity on this device. This is a view of your current interests within our current artwork catalog, not a fixed identity or a measure of expertise.</p>
      {calculationError ? <div role="alert" className="mt-6 text-sm"><p>{calculationError}</p><button className="focus-ring mt-2 min-h-11 underline" onClick={() => setAttempt((value) => value + 1)}>Retry Art DNA</button></div> : null}
      {!ready ? <p role="status" className="mt-12">Reading your local activity…</p> : <>
        <div className="mt-10"><TasteCard summary={summary} /></div>
        <div className="mt-6 flex flex-wrap gap-4">
          <button type="button" onClick={() => void shareTaste()} disabled={!summary.hasPositiveSignals} className="focus-ring min-h-11 border border-[var(--primary-ink)] px-5 text-xs uppercase tracking-[0.1em] disabled:opacity-40">Share taste card</button>
          <Link href="/discover" className="focus-ring inline-flex min-h-11 items-center px-2 text-xs uppercase tracking-[0.1em]">Keep exploring →</Link>
        </div>
        {shareText ? <div className="mt-5"><label htmlFor="taste-share-text" className="text-sm">Your shareable summary — no raw activity history or account details</label><textarea id="taste-share-text" value={shareText} readOnly rows={10} onFocus={(event) => event.currentTarget.select()} className="focus-ring mt-3 w-full border border-[var(--hairline)] bg-[var(--soft-white)] p-4 text-sm leading-6" /></div> : null}
        {summary.hasPositiveSignals ? <>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {summary.dimensions.map((dimension) => <section key={dimension.label} aria-label={dimension.label} className="border-t border-[var(--hairline)] pt-5">
              <h2 className="display-serif text-2xl">{dimension.label}</h2>
              {dimension.signals.length ? <ul className="mt-5 space-y-5">{dimension.signals.map((signal) => <li key={signal.label}><div className="flex items-start justify-between gap-3 text-sm"><span className="capitalize">{signal.label}</span><span aria-label={`${signal.strength} relative signal strength`} className="text-[var(--muted-text)]">{signal.strength}</span></div><div aria-hidden="true" className="mt-2 h-1 bg-[var(--hairline)]"><div className="h-1 bg-[var(--oxblood)]" style={{ width: `${signal.strength}%` }} /></div></li>)}</ul> : <p className="mt-5 text-sm text-[var(--muted-text)]">No positive signal yet.</p>}
            </section>)}
          </div>
          <p className="mt-9 max-w-3xl text-xs leading-6 text-[var(--muted-text)]">Bars compare positive signal strength within each category; 100 marks the strongest current signal, not certainty or a percentage of your identity. Likes, saves, and other intentional actions carry different weights; dwell time contributes while passive tracking is on. Hiding or undoing an action can reduce an affinity. Only the latest 500 valid local events are used.</p>
        </> : <div className="mt-10 border border-[var(--hairline)] p-7"><h2 className="display-serif text-3xl">No positive pattern yet.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--secondary-ink)]">A small number of likes is enough to sketch an initial picture. Every selection is optional, and you can reset it whenever you want.</p></div>}
        <section aria-labelledby="privacy-heading" className="mt-16 border-t border-[var(--hairline)] pt-8">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-text)]">You are in control</p>
          <h2 id="privacy-heading" className="display-serif mt-3 text-4xl">Activity & privacy</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--secondary-ink)]">Your Art DNA and recommendations currently use activity stored in this browser. They do not sync a complete taste history across devices. A limited copy of up to 500 recent events is sent to ARTE for personalized results and taste/attention calculations. Guest history is not written to the account database; calculation inputs are used transiently. Signed-in account activity can also be stored with your account. Local controls change this device only; they do not erase hosted records or account likes. Signed-in users have a separate account-activity reset below.</p>
          <div className="mt-7 border border-[var(--hairline)] p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-xl"><h3 className="text-sm font-medium">Passive activity tracking</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-text)]">{enabled ? "On: viewing and dwell-time signals can shape your feed." : "Paused: new passive signals are not recorded."} Likes, saves, searches, and other explicit actions still work and may be recorded. Pausing does not delete earlier activity.</p></div><button type="button" aria-pressed={!enabled} onClick={toggleTracking} className="focus-ring min-h-11 border border-[var(--primary-ink)] px-5 text-xs">{enabled ? "Pause passive tracking" : "Resume passive tracking"}</button></div>
            <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-[var(--hairline)] pt-6"><button type="button" onClick={restoreHidden} disabled={!hiddenCount} className="focus-ring min-h-11 border border-[var(--hairline)] px-5 text-xs disabled:opacity-40">Restore hidden works ({hiddenCount})</button><button type="button" onClick={() => { setConfirmReset(true); setClearLikes(false); }} className="focus-ring min-h-11 px-2 text-xs text-[var(--oxblood)] underline underline-offset-4">Reset local recommendations</button></div>
            {confirmReset ? <div role="group" aria-labelledby="reset-heading" className="mt-5 border border-[var(--oxblood)] p-5"><h3 id="reset-heading" className="text-sm font-medium">Start your local taste history again?</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--secondary-ink)]">This clears recommendation history and restores hidden works on this device. Saved works, collections, and your passive-tracking choice stay as they are. Existing likes stay visible unless you choose to remove local guest likes and follows below. Their earlier recommendation signals are removed either way.</p><label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={clearLikes} onChange={(event) => setClearLikes(event.target.checked)} className="focus-ring h-4 w-4 accent-[var(--oxblood)]" />Also clear guest likes and follows on this device</label><p className="mt-2 text-xs leading-6 text-[var(--muted-text)]">Account likes, follows, and hosted events are not deleted. This local reset cannot be undone.</p><div className="mt-4 flex gap-3"><button type="button" onClick={resetHistory} className="focus-ring min-h-11 bg-[var(--oxblood)] px-5 text-xs text-white">Confirm local reset</button><button type="button" onClick={() => setConfirmReset(false)} className="focus-ring min-h-11 px-5 text-xs">Cancel</button></div></div> : null}
            <HostedActivityReset />
          </div>
        </section>
      </>}
      <p role="status" aria-live="polite" className="mt-6 text-sm leading-6 text-[var(--oxblood)]">{status}</p>
    </section>
  );
}
