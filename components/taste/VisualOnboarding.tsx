"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArtworkVisual } from "@/components/artwork/ArtworkVisual";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import { DEMO_ARTWORKS } from "@/lib/artworks/demoArtworks";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const candidates = DEMO_ARTWORKS.filter((artwork) => artwork.visual.kind !== "missing").slice(0, 20);
const LIKES_KEY = "arte:guest:likes";

export function VisualOnboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  async function applySelections() {
    if (selected.length < 5 || pending) return;
    setPending(true);
    setStatus("");
    try {
      const client = getSupabaseBrowserClient();
      const user = client ? (await client.auth.getUser()).data.user : null;
      let existing = new Set<string>();
      if (client && user) {
        const result = await client.from("likes").select("artwork_id").eq("user_id", user.id).in("artwork_id", selected);
        if (result.error) throw result.error;
        existing = new Set((result.data ?? []).map((row: { artwork_id: string }) => row.artwork_id));
        const newIds = selected.filter((id) => !existing.has(id));
        if (newIds.length) {
          const result = await client.from("likes").upsert(newIds.map((id) => ({ user_id: user.id, artwork_id: id })));
          if (result.error) throw result.error;
        }
      } else {
        const parsed: unknown = JSON.parse(localStorage.getItem(LIKES_KEY) ?? "[]");
        existing = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
        localStorage.setItem(LIKES_KEY, JSON.stringify([...new Set([...existing, ...selected])]));
      }
      for (const artwork of candidates) {
        if (selected.includes(artwork.id) && !existing.has(artwork.id)) recordAnalyticsEvent({ eventType: "artwork_like", artwork, source: "visual_onboarding" });
      }
      router.push("/taste");
    } catch {
      setStatus("Your selections could not be saved. Please try again; you can always skip this step.");
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-20">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Optional visual onboarding</p>
        <h1 className="display-serif mt-5 text-5xl font-medium md:text-8xl">What moves you?</h1>
        <p className="mt-6 max-w-2xl leading-7 text-[var(--secondary-ink)]">Choose at least five works that catch your eye. Continuing adds a like to each selected work and gives your recommendations a starting point. There are no right answers.</p>
        <p className="mt-3 text-xs leading-6 text-[var(--muted-text)]">Explore public-domain museum artworks alongside clearly labeled synthetic demo works. Guest likes are saved on this device. When cloud services are enabled, activity may also be stored by ARTE. If you sign in to a configured account, likes can be saved to that account; the taste estimate still uses this device’s recent activity.</p>
        <Link href="/discover" className="focus-ring mt-5 inline-flex min-h-11 items-center border-b border-[var(--primary-ink)] text-xs uppercase tracking-[0.14em]">Skip for now</Link>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-7">
        {candidates.map((artwork) => {
          const isSelected = selected.includes(artwork.id);
          return (
            <button key={artwork.id} type="button" aria-label={`Choose ${artwork.title}`} aria-pressed={isSelected} disabled={pending} onClick={() => setSelected((current) => current.includes(artwork.id) ? current.filter((id) => id !== artwork.id) : [...current, artwork.id])} className={`focus-ring border p-3 text-left transition-colors disabled:opacity-60 md:p-4 ${isSelected ? "border-[var(--oxblood)] bg-[var(--oxblood)]/5 ring-1 ring-[var(--oxblood)]" : "border-[var(--hairline)]"}`}>
              <div className="flex h-44 items-center overflow-hidden md:h-60"><ArtworkVisual artwork={artwork} compact /></div>
              <span className="mt-4 flex items-start justify-between gap-2"><span className="display-serif text-lg md:text-xl">{artwork.title.replace(" — Demo", "")}</span><span aria-hidden="true" className="text-sm">{isSelected ? "✓" : "+"}</span></span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.1em] text-[var(--muted-text)]">{artwork.movement.replace("Demo ", "")}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-5">
        <button type="button" onClick={() => void applySelections()} disabled={selected.length < 5 || pending} className="focus-ring min-h-12 bg-[var(--primary-ink)] px-7 py-3 text-xs uppercase tracking-[0.13em] text-[var(--soft-white)] disabled:opacity-40">{pending ? "Saving your choices…" : "Build my Art DNA"}</button>
        <p aria-live="polite" className="text-sm text-[var(--muted-text)]">{selected.length} {selected.length === 1 ? "work" : "works"} selected · choose at least 5</p>
      </div>
      <p role="status" className="mt-4 text-sm text-[var(--oxblood)]">{status}</p>
    </section>
  );
}
