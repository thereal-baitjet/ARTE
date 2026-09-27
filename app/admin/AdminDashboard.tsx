"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AdminOverview } from "@/lib/admin/types";
import type { AdminMutation } from "@/lib/admin/validation";

const buttonStyle = "focus-ring min-h-11 border border-[var(--hairline)] px-4 text-xs disabled:opacity-50";

export type AdminSection = "overview" | "artworks" | "artists" | "listings" | "sources" | "recommendations";

export function AdminDashboard({ section = "overview" }: { section?: AdminSection }) {
  const show = (...sections: AdminSection[]) => section === "overview" || sections.includes(section);
  const sessionVersion = useRef(0);
  const sessionUser = useRef<string | null | undefined>(undefined);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [status, setStatus] = useState("Checking administrator access…");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const version = sessionVersion.current;
    const expectedUser = sessionUser.current;
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("Administration is locked until account services are connected.");
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error("Sign in with an administrator account to continue.");
    if (version !== sessionVersion.current || (expectedUser !== undefined && expectedUser !== data.session.user.id)) {
      throw new Error("Your account changed. Refresh administrator access before continuing.");
    }
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
    const body = await response.json();
    if (version !== sessionVersion.current) throw new Error("Your account changed. Refresh administrator access before continuing.");
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The request failed. Try again.");
    return body;
  }, []);

  const load = useCallback(async () => {
    const version = sessionVersion.current;
    try {
      const result = await request("/api/admin");
      if (version !== sessionVersion.current) return;
      setOverview(result);
      setStatus("");
    } catch (error) {
      if (version !== sessionVersion.current) return;
      setOverview(null);
      setStatus(error instanceof Error ? error.message : "Records could not be loaded. Try again.");
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user.id ?? null;
      const changed = sessionUser.current !== undefined && nextUser !== sessionUser.current;
      sessionUser.current = nextUser;
      if (changed || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        sessionVersion.current++;
        setOverview(null);
        setBusy(false);
        setStatus("Your account changed. Refresh access to verify administrator permissions.");
      }
    });
    const version = sessionVersion.current;
    request("/api/admin").then(result => {
      if (active && version === sessionVersion.current) { setOverview(result); setStatus(""); }
    }).catch(error => {
      if (active && version === sessionVersion.current) setStatus(error instanceof Error ? error.message : "Records could not be loaded. Try again.");
    });
    return () => { active = false; subscription?.data.subscription.unsubscribe(); };
  }, [request]);

  async function mutate(mutation: AdminMutation) {
    const version = sessionVersion.current;
    setBusy(true);
    try {
      await request("/api/admin", { method: "PATCH", body: JSON.stringify(mutation) });
      if (version !== sessionVersion.current) return;
      await load();
      if (version !== sessionVersion.current) return;
      setStatus("Change saved and recorded in the audit log.");
    } catch (error) { if (version === sessionVersion.current) setStatus(error instanceof Error ? error.message : "The change could not be saved."); }
    finally { if (version === sessionVersion.current) setBusy(false); }
  }

  async function sync() {
    const version = sessionVersion.current;
    setBusy(true);
    try {
      const report = await request("/api/admin/sync", { method: "POST" });
      if (version !== sessionVersion.current) return;
      await load();
      if (version !== sessionVersion.current) return;
      setStatus(`Synchronization ${report.status}: ${report.recordsUpserted} imported; ${report.recordsRejected} rejected. Existing archives stay archived.`);
    } catch (error) { if (version === sessionVersion.current) setStatus(error instanceof Error ? error.message : "Synchronization failed."); }
    finally { if (version === sessionVersion.current) setBusy(false); }
  }

  return <div className="mt-10 space-y-10">
    {status && <p role="status" className="border border-[var(--hairline)] p-5 text-sm leading-7">{status}</p>}
    <div className="flex flex-wrap gap-4"><button className={buttonStyle} onClick={() => void load()} disabled={busy}>Refresh access and records</button><Link href="/auth" className={`${buttonStyle} inline-flex items-center`}>Sign in</Link></div>
    {overview && <>
      <nav aria-label="Administration sections" className="flex flex-wrap gap-4 text-sm"><Link className="focus-ring" href="/admin">Overview</Link>{(["artworks", "artists", "listings", "sources", "recommendations"] as const).map(name => <Link key={name} className="focus-ring capitalize" href={`/admin/${name}`}>{name}</Link>)}</nav>
      {show("sources") && <section aria-labelledby="source-heading"><h2 id="source-heading" className="display-serif text-3xl">Source health</h2><p className="my-3 text-sm">Only the internal synthetic demo adapter is enabled. No external source is connected.</p><button className={buttonStyle} disabled={busy} onClick={() => void sync()}>{busy ? "Working…" : "Synchronize demo catalog"}</button>
        <ul className="mt-4 divide-y divide-[var(--hairline)]">{overview.syncRuns.map(run => <li key={run.id} className="py-4 text-sm"><strong>{run.source_name}: {run.status}</strong><p>{run.records_upserted} imported / {run.records_rejected} rejected · {new Date(run.started_at).toLocaleString()}</p>{run.status !== "success" && <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(run.error_summary, null, 2)}</pre>}</li>)}</ul>{!overview.syncRuns.length && <p className="mt-4 text-sm">No synchronization has run.</p>}
      </section>}
      {show("artworks", "sources") && <section aria-labelledby="rights-heading"><h2 id="rights-heading" className="display-serif text-3xl">Rights review queue</h2><p className="my-3 text-sm">Unclear and restricted records cannot be published. Review supporting licenses before changing rights through a controlled database workflow.</p><ul className="space-y-3">{overview.rightsQueue.map(work => <li key={work.id} className="text-sm">{work.title} · {work.image_rights_state} · {work.source_name}</li>)}</ul>{!overview.rightsQueue.length && <p className="text-sm">No records waiting for rights review.</p>}</section>}
      {show("artists") && <section aria-labelledby="artists-heading"><h2 id="artists-heading" className="display-serif text-3xl">Artist records</h2><p className="my-3 text-sm">Read-only artist directory. Biography editing and submission approval are not available here yet.</p><ul className="space-y-3">{overview.artists.map(artist => <li key={artist.id} className="text-sm">{artist.name} · {artist.nationality ?? "Nationality not recorded"}</li>)}</ul></section>}
      {show("artworks") && <section aria-labelledby="artworks-heading"><h2 id="artworks-heading" className="display-serif text-3xl">Catalog</h2><p className="my-3 text-xs text-[var(--muted-text)]">Latest 100 records. Archiving removes database publication; the bundled demonstration catalog is managed in source control.</p><ul className="divide-y divide-[var(--hairline)]">{overview.artworks.map(work => <li key={work.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm">{work.title}</p><p className="text-xs">{work.image_rights_state} · {work.is_published ? "Published" : "Archived"}</p></div>{work.is_published && <button className={buttonStyle} disabled={busy} onClick={() => void mutate({ action: "archive_artwork", id: work.id })}>Archive {work.title}</button>}</li>)}</ul></section>}
      {show("listings") && <section aria-labelledby="listings-heading"><h2 id="listings-heading" className="display-serif text-3xl">Listing management</h2><ul className="divide-y divide-[var(--hairline)]">{overview.listings.map(listing => <li key={listing.id} className="py-4 text-sm"><p>{overview.artworks.find(work => work.id === listing.artwork_id)?.title ?? listing.artwork_id} · {listing.is_demo ? "DEMO LISTING" : "External listing"} · {listing.status}</p><p className="my-2">Verified: {listing.last_verified_at ?? "Never"} · Expires: {listing.expires_at ?? "Not set"}</p><div className="flex gap-2"><button className={buttonStyle} disabled={busy || listing.status === "sold"} onClick={() => void mutate({ action: "set_listing_status", id: listing.id, status: "sold" })}>Mark sold</button><button className={buttonStyle} disabled={busy || listing.status === "inactive"} onClick={() => void mutate({ action: "set_listing_status", id: listing.id, status: "inactive" })}>Deactivate</button></div></li>)}</ul>{!overview.listings.length && <p className="mt-3 text-sm">No database listings. Public demonstration cards are bundled fixtures.</p>}</section>}
      {show("recommendations") && <section aria-labelledby="diagnostics-heading"><h2 id="diagnostics-heading" className="display-serif text-3xl">Recommendation diagnostics</h2><p className="my-3 text-sm">{overview.diagnostics.recommendationProvider}. Latest {overview.diagnostics.sampleSize} stored events; this sample is not a complete product-health report.</p><dl className="grid grid-cols-2 gap-3 text-sm">{Object.entries(overview.diagnostics.events).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl></section>}
      <section aria-labelledby="audit-heading"><h2 id="audit-heading" className="display-serif text-3xl">Audit trail</h2><ul className="mt-4 space-y-3 text-sm">{overview.auditLogs.map(log => <li key={log.id}>{log.action} · {log.resource_type} · {new Date(log.created_at).toLocaleString()}</li>)}</ul>{!overview.auditLogs.length && <p className="mt-3 text-sm">No administrative changes recorded.</p>}</section>
    </>}
  </div>;
}
