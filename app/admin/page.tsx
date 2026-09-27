import type { Metadata } from "next";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default function AdminPage() {
  // This public shell contains no privileged data. Every read/write is authorized on the server.
  return <main className="mx-auto max-w-6xl px-6 py-12"><a className="focus-ring text-xs tracking-widest" href="/discover">ARTE / DISCOVER</a><h1 className="display-serif mt-10 text-5xl">Administration</h1><p className="mt-4 text-sm text-[var(--muted-text)]">Catalog care, source health, and accountable changes.</p><AdminDashboard /></main>;
}
