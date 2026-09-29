"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CorridorNote, CorridorPage } from "@/lib/corridor/types";

class CorridorError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const control = "focus-ring min-h-11 px-1 py-2 text-sm underline decoration-current/30 underline-offset-4 disabled:opacity-50";
type Props = { artworkId: string; token: string; onAccessLost: () => void };

export default function SharedCorridorPanel({ artworkId, token, onAccessLost }: Props) {
  const [page, setPage] = useState<CorridorPage | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const alive = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const accessLost = useRef(onAccessLost);
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  useEffect(() => { accessLost.current = onAccessLost; }, [onAccessLost]);

  async function request<T>(method = "GET", body?: object, cursor?: CorridorPage["nextCursor"]): Promise<T> {
    const controller = new AbortController();
    controllers.current.add(controller);
    const query = cursor ? `?cursor=${encodeURIComponent(btoa(JSON.stringify(cursor)))}` : "";
    try {
      const response = await fetch(`/api/corridor/${artworkId}${query}`, {
        method, cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) accessLost.current();
        throw new CorridorError(typeof data?.error === "string" ? data.error : "Please try again shortly.", response.status);
      }
      return data as T;
    } finally { controllers.current.delete(controller); }
  }
  // The panel is unmounted on account changes and collapse; no notes are persisted.
  useEffect(() => {
    alive.current = true;
    const pending = controllers.current;
    let cancelled = false;
    void request<CorridorPage>().then((data) => { if (!cancelled) setPage(data); })
      .catch((err: unknown) => { if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) setError("The notes could not be opened. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; alive.current = false; for (const controller of pending) controller.abort(); };
    // Credentials and artwork are immutable for this keyed panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  async function mutate(operation: "POST" | "PATCH" | "DELETE") {
    if (!page || busy) return;
    const previous = page;
    const text = draft.normalize("NFKC").replace(/\s+/gu, " ").trim();
    if (operation !== "DELETE" && (!text || Array.from(text).length > 140)) {
      setError("Please keep your note between 1 and 140 characters."); input.current?.focus(); return;
    }
    setBusy(true); setError(""); setStatus("");
    const now = new Date().toISOString();
    const optimistic: CorridorNote | null = operation === "DELETE" ? null : {
      id: page.ownNote?.id ?? "pending", noteText: text,
      createdAt: page.ownNote?.createdAt ?? now, updatedAt: now, isOwn: true,
    };
    setPage({ ...page, ownNote: optimistic, notes: page.notes.filter((note) => !note.isOwn) });
    try {
      const saved = await request<CorridorNote | null>(operation, operation === "DELETE" ? undefined : { noteText: text });
      if (!alive.current) return;
      setPage((current) => current ? { ...current, ownNote: saved } : current);
      setDraft(""); setEditing(false); setConfirmDelete(false);
      setStatus(operation === "POST" ? "Your note is now in the Shared Corridor." : operation === "PATCH" ? "Your note has been updated." : "Your note has been removed.");
    } catch (err) {
      if (!alive.current) return;
      setPage(previous);
      setError(err instanceof CorridorError ? err.message : "Your change could not be saved. Please try again.");
    } finally { if (alive.current) setBusy(false); }
  }
  async function more() {
    if (!page?.nextCursor || busy) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const next = await request<CorridorPage>("GET", undefined, page.nextCursor);
      if (!alive.current) return;
      setPage((current) => current ? { ...current, nextCursor: next.nextCursor,
        notes: [...current.notes, ...next.notes.filter((note) => !current.notes.some((existing) => existing.id === note.id))] } : current);
      setStatus("More notes are now available below.");
    } catch (err) {
      if (alive.current) setError(err instanceof CorridorError ? err.message : "More notes could not be opened. Please try again.");
    } finally { if (alive.current) setBusy(false); }
  }
  const own = page?.ownNote;
  const notes = page?.notes.filter((note) => !note.isOwn) ?? [];
  const showForm = page && (!own || editing);
  return (
    <div className="pb-6 pt-4 text-[var(--secondary-ink)]">
      <p className="max-w-lg text-xs leading-6">A quiet space for early-access members viewing this work. Notes stay within this circle, with no names or profiles attached.</p>
      {loading && <p className="mt-6 text-sm" role="status">Opening the notes…</p>}
      {!loading && page && (
        <>
          {!own && notes.length === 0 && <p className="display-serif mt-8 text-xl">Be the first to leave a quiet note here.</p>}
          {own && !editing && <div className="mt-8">
            <p className="display-serif whitespace-pre-wrap break-words text-xl leading-relaxed">{own.noteText}</p>
            <p className="mt-2 text-xs">— You</p>
            {!confirmDelete ? <div className="mt-2 flex gap-6">
              <button className={control} disabled={busy} onClick={() => { setDraft(own.noteText); setEditing(true); setStatus(""); setTimeout(() => input.current?.focus(), 0); }}>Edit your note</button>
              <button className={control} disabled={busy} onClick={() => setConfirmDelete(true)}>Delete your note</button>
            </div> : <div className="mt-3">
              <p className="text-sm">Remove your note from this work?</p>
              <div className="flex gap-6">
                <button className={control} disabled={busy} onClick={() => void mutate("DELETE")}>Remove note</button>
                <button className={control} disabled={busy} onClick={() => setConfirmDelete(false)}>Keep note</button>
              </div>
            </div>}
          </div>}
          {showForm && <form className="mt-8" onSubmit={(event) => { event.preventDefault(); void mutate(editing ? "PATCH" : "POST"); }}>
            <label htmlFor={id} className="display-serif text-xl">{editing ? "Edit your quiet note" : "A thought to leave here"}</label>
            <textarea ref={input} id={id} rows={3} value={draft} disabled={busy} aria-describedby={`${id}-hint`} autoComplete="off"
              onChange={(event) => setDraft(Array.from(event.target.value).slice(0, 140).join(""))}
              className="focus-ring display-serif mt-3 block w-full resize-y border-0 border-b border-[var(--hairline)] bg-transparent py-3 text-xl leading-relaxed disabled:opacity-60" />
            <div className="mt-2 flex justify-between gap-4 text-xs">
              <p id={`${id}-hint`}>One note per artwork. Up to 140 characters.</p>
              <span aria-hidden="true">{Array.from(draft).length}/140</span>
            </div>
            <div className="mt-3 flex gap-6">
              <button type="submit" className={control} disabled={busy || !draft.trim()}>{busy ? "Saving quietly…" : editing ? "Save note" : "Leave note"}</button>
              {editing && <button type="button" className={control} disabled={busy} onClick={() => { setEditing(false); setDraft(""); setError(""); }}>Cancel edit</button>}
            </div>
          </form>}
          {notes.length > 0 && <ul aria-label="Notes from early-access members" className="mt-10 space-y-8">
            {notes.map((note) => <li key={note.id}>
              <p className="display-serif whitespace-pre-wrap break-words text-xl leading-relaxed">{note.noteText}</p>
              <p className="mt-2 text-xs">— Early Access Member</p>
            </li>)}
          </ul>}
          {page.nextCursor && <button className={`${control} mt-5`} disabled={busy} onClick={() => void more()}>View more</button>}
        </>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-sm leading-6">{busy && own && !editing ? "Saving quietly…" : status}</p>
      {error && <div className="mt-3 text-sm leading-6">
        <p role="status">{error}</p>
        {!busy && <button className={control} onClick={() => { setLoading(true); setError(""); setStatus(""); setEditing(false); setConfirmDelete(false); setPage(null); setRetry((value) => value + 1); }}>Refresh notes</button>}
      </div>}
    </div>
  );
}
