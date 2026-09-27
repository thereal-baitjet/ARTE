import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDashboard, type AdminSection } from "../AdminDashboard";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };
const sections = ["artworks", "artists", "listings", "sources", "recommendations"] as const;

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.some(value => value === section)) notFound();
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link className="focus-ring text-xs tracking-widest" href="/admin">ARTE / ADMINISTRATION</Link><h1 className="display-serif mt-10 text-5xl capitalize">{section}</h1><p className="mt-4 text-sm text-[var(--muted-text)]">Administrator access is verified before records are loaded.</p><AdminDashboard section={section as AdminSection} /></main>;
}
