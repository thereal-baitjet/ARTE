import type { Metadata } from "next";
import { AttentionDashboard } from "@/components/trending/AttentionDashboard";

export const metadata: Metadata = { title: "Your attention", description: "Your recent art interests, drawn from activity in this browser." };

export default function TrendingPage() {
  return (
    <section className="px-6 py-12 md:px-10 lg:px-14 lg:py-20">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-text)]">A personal view · Last 30 days</p>
      <h1 className="display-serif mt-5 text-5xl font-medium md:text-7xl">What holds your attention.</h1>
      <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--secondary-ink)]">Discover patterns in the works you return to. This ranking reflects activity available on this device; it does not represent activity across ARTE.</p>
      <AttentionDashboard />
    </section>
  );
}
