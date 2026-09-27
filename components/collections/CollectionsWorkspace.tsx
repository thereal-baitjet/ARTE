"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artwork } from "@/lib/artworks/types";
import {
  createAccountCollection, deleteAccountCollection, readAccountCollections, readGuestCollections,
  removeAccountSave, renameAccountCollection, updateAccountCollectionItem, validateCollectionName,
  writeGuestCollections, writeGuestSaves, type CollectionSnapshot, type PrivateCollection,
} from "@/lib/collections/storage";

const buttonStyle = "focus-ring min-h-11 border border-[var(--hairline)] px-4 text-xs disabled:opacity-45";
const inputStyle = "focus-ring min-h-11 w-full border border-[var(--hairline)] bg-[var(--soft-white)] px-3 text-sm";

export function CollectionsWorkspace({ artworks, initialCollectionId = null }: { artworks: Artwork[]; initialCollectionId?: string | null }) {
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialCollectionId);
  const [name, setName] = useState("");
  const [rename, setRename] = useState("");
  const [artworkId, setArtworkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const activeOwner = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let version = 0;
    const client = getSupabaseBrowserClient();
    async function hydrate() {
      const current = ++version;
      activeOwner.current = undefined;
      setSnapshot(null);
      setError(null);
      try {
        let next: CollectionSnapshot;
        if (client) {
          const { data, error: authError } = await client.auth.getUser();
          if (authError && authError.name !== "AuthSessionMissingError") throw new Error("Your account could not be checked. Please try again.");
          next = data.user ? await readAccountCollections(client, data.user.id) : readGuestCollections();
        } else next = readGuestCollections();
        if (!cancelled && current === version) {
          activeOwner.current = next.userId;
          setSnapshot(next);
        }
      } catch (cause) {
        if (!cancelled && current === version) setError(cause instanceof Error ? cause.message : "Your collections could not be loaded.");
      }
    }
    void hydrate();
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") queueMicrotask(() => { if (!cancelled) void hydrate(); });
    });
    function refreshGuest(event: StorageEvent) {
      if (event.key === "arte:guest:saves" || event.key === "arte:guest:collections") void hydrate();
    }
    window.addEventListener("storage", refreshGuest);
    const refreshSaves = () => { void hydrate(); };
    window.addEventListener("arte:saves-changed", refreshSaves);
    return () => { cancelled = true; version++; activeOwner.current = undefined; subscription?.data.subscription.unsubscribe(); window.removeEventListener("storage", refreshGuest); window.removeEventListener("arte:saves-changed", refreshSaves); };
  }, [attempt]);

  const selected = snapshot?.collections.find(({ id }) => id === selectedId);
  const missingCollection = Boolean(snapshot && selectedId && !selected);
  const visibleIds = selected ? selected.artworkIds : snapshot?.savedIds ?? [];
  const visibleArtworks = visibleIds.flatMap((id) => artworks.find((artwork) => artwork.id === id) ?? []);
  const unavailableCount = visibleIds.length - visibleArtworks.length;
  const availableArtworks = artworks.filter((artwork) => !selected?.artworkIds.includes(artwork.id)).sort((a, b) => Number(snapshot?.savedIds.includes(b.id)) - Number(snapshot?.savedIds.includes(a.id)));

  function select(collection?: PrivateCollection) {
    setSelectedId(collection?.id ?? null);
    setRename(collection?.name ?? "");
    setArtworkId("");
    setConfirmDelete(false);
    setError(null);
    setMessage(null);
  }

  async function mutate(operation: () => Promise<void>) {
    if (!snapshot || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your change could not be saved. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }

  function updateCollections(collections: PrivateCollection[]) {
    if (!snapshot) return;
    if (activeOwner.current !== snapshot.userId) throw new Error("Your session changed. Please reload your notebook before making another change.");
    if (!snapshot.userId) writeGuestCollections(collections);
    setSnapshot({ ...snapshot, collections });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      if (!snapshot) return;
      const validName = validateCollectionName(name, snapshot.collections);
      const client = getSupabaseBrowserClient();
      const created = client && snapshot.userId
        ? await createAccountCollection(client, snapshot.userId, validName)
        : { id: crypto.randomUUID(), name: validName, visibility: "private" as const, artworkIds: [] };
      updateCollections([created, ...snapshot.collections]);
      setName("");
      select(created);
      setMessage(`“${created.name}” created. Only you can see it.`);
    });
  }

  async function renameCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      if (!snapshot || !selected) return;
      const validName = validateCollectionName(rename, snapshot.collections, selected.id);
      const client = getSupabaseBrowserClient();
      if (client && snapshot.userId) await renameAccountCollection(client, snapshot.userId, selected.id, validName);
      updateCollections(snapshot.collections.map((collection) => collection.id === selected.id ? { ...collection, name: validName } : collection));
      setRename(validName);
      setMessage("Collection renamed.");
    });
  }

  async function deleteCollection() {
    await mutate(async () => {
      if (!snapshot || !selected) return;
      const client = getSupabaseBrowserClient();
      if (client && snapshot.userId) await deleteAccountCollection(client, snapshot.userId, selected.id);
      updateCollections(snapshot.collections.filter(({ id }) => id !== selected.id));
      select();
      setMessage("Collection deleted. Your saved artworks are still here.");
    });
  }

  async function changeArtwork(artwork: Artwork, add: boolean) {
    await mutate(async () => {
      if (!snapshot) return;
      const client = getSupabaseBrowserClient();
      if (selected) {
        if (client && snapshot.userId) await updateAccountCollectionItem(client, selected.id, artwork.id, add, selected.artworkIds.length);
        updateCollections(snapshot.collections.map((collection) => collection.id === selected.id ? { ...collection, artworkIds: add ? [...new Set([...collection.artworkIds, artwork.id])] : collection.artworkIds.filter((id) => id !== artwork.id) } : collection));
      } else {
        if (client && snapshot.userId) await removeAccountSave(client, snapshot.userId, artwork.id);
        if (activeOwner.current !== snapshot.userId) throw new Error("Your session changed. Please reload your notebook before making another change.");
        const savedIds = snapshot.savedIds.filter((id) => id !== artwork.id);
        if (!snapshot.userId) writeGuestSaves(savedIds);
        setSnapshot({ ...snapshot, savedIds });
        window.dispatchEvent(new Event("arte:saves-changed"));
      }
      // Analytics failure must never turn a persisted change into a reported failure.
      try { recordAnalyticsEvent({ eventType: selected ? (add ? "collection_add" : "collection_remove") : "artwork_unsave", artwork, source: "collections" }); } catch { /* Personalization storage may be unavailable. */ }
      setArtworkId("");
      setMessage(selected ? `Artwork ${add ? "added to" : "removed from"} collection.` : "Artwork removed from saved. Existing collections are unchanged.");
    });
  }

  return (
    <div className="page-shell px-6 py-12 md:px-12 lg:py-20">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Collections</p>
      <h1 className="display-serif mt-4 text-4xl md:text-6xl">Your visual notebook.</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--muted-text)]">Keep the works that stay with you. Gather them into collections, private by default.</p>
      {snapshot ? <p className="mt-3 text-xs leading-6 text-[var(--muted-text)]">{snapshot.userId ? "Changes are saved to your account." : <>Saved on this browser only. <Link href="/auth" className="focus-ring underline underline-offset-4">Sign in</Link> to manage separate account collections. Browser collections are not transferred automatically.</>}</p> : null}
      <div aria-live="polite" className="mt-5">
        {error ? <p role="alert" className="text-sm text-[var(--oxblood)]">{error}</p> : null}
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </div>
      {!snapshot ? <div className="mt-8">{error ? <button className={buttonStyle} onClick={() => setAttempt((value) => value + 1)}>Try again</button> : <p role="status" className="text-sm text-[var(--muted-text)]">Loading your notebook…</p>}</div> : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside aria-label="Your collections" className="space-y-8">
            <nav aria-label="Collection selection" className="flex flex-col gap-2">
              <button type="button" className={`${buttonStyle} flex items-center justify-between text-left ${!selected ? "bg-[var(--primary-ink)] text-[var(--soft-white)]" : ""}`} aria-current={!selected ? "page" : undefined} disabled={busy} onClick={() => select()}><span>Saved artworks</span><span>{snapshot.savedIds.length}</span></button>
              {snapshot.collections.map((collection) => <button key={collection.id} type="button" aria-current={selected?.id === collection.id ? "page" : undefined} disabled={busy} onClick={() => select(collection)} className={`${buttonStyle} flex items-center justify-between gap-3 py-3 text-left ${selected?.id === collection.id ? "bg-[var(--primary-ink)] text-[var(--soft-white)]" : ""}`}><span className="min-w-0 break-words">{collection.name}</span><span>{collection.artworkIds.length}</span></button>)}
            </nav>
            <form onSubmit={create} className="space-y-3">
              <label htmlFor="collection-name" className="block text-xs uppercase tracking-[0.12em]">New private collection</label>
              <input id="collection-name" aria-label="Collection name" className={inputStyle} placeholder="A name, a mood, a moment" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} disabled={busy} />
              <button className={`${buttonStyle} w-full`} disabled={busy || !name.trim()}>Create collection</button>
            </form>
          </aside>
          <section aria-label={missingCollection ? "Collection unavailable" : selected?.name ?? "Saved artworks"} className="min-w-0">
            {missingCollection ? <div className="py-8"><h2 className="display-serif text-3xl">Collection unavailable.</h2><p className="mt-4 text-sm leading-7 text-[var(--muted-text)]">This collection is not available in your current notebook. Private account collections require their owner to sign in. Browser collections are only available on the browser where they were created.</p><button className={`${buttonStyle} mt-6`} onClick={() => select()}>View saved artworks</button></div> : <>
            <div className="border-b border-[var(--hairline)] pb-6">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-text)]">{selected ? `${selected.visibility} collection` : "Your saves"} · {visibleIds.length} {visibleIds.length === 1 ? "artwork" : "artworks"}</p>
              <h2 className="display-serif mt-2 break-words text-3xl md:text-4xl">{selected?.name ?? "Saved artworks"}</h2>
              {selected ? <>
                <Link href={`/collections/${selected.id}`} className="focus-ring mt-3 inline-block text-xs underline underline-offset-4">Open collection</Link>
                <form onSubmit={renameCollection} className="mt-6 flex max-w-lg flex-wrap items-end gap-3">
                  <label className="min-w-40 flex-1 text-xs">Rename collection<input className={`${inputStyle} mt-2`} value={rename} onChange={(event) => setRename(event.target.value)} maxLength={80} required disabled={busy} /></label>
                  <button className={buttonStyle} disabled={busy || !rename.trim() || rename.trim() === selected.name}>Save name</button>
                </form>
                <form onSubmit={(event) => { event.preventDefault(); const artwork = artworks.find(({ id }) => id === artworkId); if (artwork) void changeArtwork(artwork, true); }} className="mt-5 flex max-w-lg flex-wrap items-end gap-3">
                  <label className="min-w-40 flex-1 text-xs">Add artwork<select className={`${inputStyle} mt-2`} value={artworkId} onChange={(event) => setArtworkId(event.target.value)} disabled={busy || !availableArtworks.length} required><option value="">{availableArtworks.length ? "Choose from the artwork catalog" : "All artworks are in this collection"}</option>{availableArtworks.map((artwork) => <option key={artwork.id} value={artwork.id}>{snapshot.savedIds.includes(artwork.id) ? "Saved · " : ""}{artwork.title}</option>)}</select></label>
                  <button className={buttonStyle} disabled={busy || !artworkId}>Add to collection</button>
                </form>
                <div className="mt-5 text-xs">{confirmDelete ? <div className="flex flex-wrap items-center gap-3"><span>Delete this collection? Your saved artworks will remain.</span><button type="button" className={`${buttonStyle} text-[var(--oxblood)]`} disabled={busy} onClick={() => void deleteCollection()}>Delete permanently</button><button type="button" className={buttonStyle} disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button type="button" className="focus-ring min-h-11 text-[var(--muted-text)] underline underline-offset-4" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete collection</button>}</div>
              </> : <p className="mt-3 text-sm leading-6 text-[var(--muted-text)]">Works you save in Discover appear here, even before you create a collection.</p>}
            </div>
            {unavailableCount > 0 ? <p className="mt-6 text-sm text-[var(--muted-text)]">{unavailableCount} {unavailableCount === 1 ? "artwork is" : "artworks are"} currently unavailable in this catalog. Your saved references are retained.</p> : null}
            {visibleArtworks.length ? <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">{visibleArtworks.map((artwork) => <div key={artwork.id} data-collection-artwork={artwork.id}><ArtworkCard artwork={artwork} /><button type="button" className={`${buttonStyle} mt-4 w-full`} aria-label={`Remove ${artwork.title} from ${selected ? "collection" : "saved artworks"}`} disabled={busy} onClick={() => void changeArtwork(artwork, false)}>{selected ? "Remove from collection" : "Remove from saved"}</button></div>)}</div> : <div className="py-14"><h3 className="display-serif text-2xl">{selected ? "A space for your next discovery." : "Start with a work that moves you."}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted-text)]">{selected ? "Choose an artwork above to begin this collection." : "Tap Save on an artwork in Discover. It will be waiting here."}</p><Link className={`${buttonStyle} mt-6 inline-flex items-center`} href="/discover">Explore artworks</Link></div>}
            </>}
          </section>
        </div>
      )}
    </div>
  );
}
