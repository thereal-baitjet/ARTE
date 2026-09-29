"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getAuthSnapshot, retryAuth, startAuth, subscribeAuth, useAuth } from "@/lib/auth/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EMPTY_INTERACTIONS, InteractionStore, type InteractionTable } from "./interaction-store";

const keys: Record<InteractionTable, string> = { likes: "arte:guest:likes", saves: "arte:guest:saves", follows: "arte:guest:follows" };
const origin = "account-interactions";
let channel: BroadcastChannel | null = null;
let started = false;

function guestIds(table: InteractionTable): string[] {
  const raw = localStorage.getItem(keys[table]);
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

const store = new InteractionStore({
  async read(owner, table) {
    if (!owner) return guestIds(table);
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("Account unavailable.");
    const column = table === "follows" ? "artist_id" : "artwork_id";
    const ids: string[] = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const result = await client.from(table).select(column).eq("user_id", owner).order(column).range(offset, offset + 499);
      if (result.error) throw result.error;
      const rows = result.data as unknown as Record<string, string>[];
      ids.push(...rows.map((row) => row[column]));
      if (rows.length < 500) return ids;
    }
    throw new Error("Your collection is too large to load at once.");
  },
  async write(owner, table, id, active) {
    const auth = getAuthSnapshot();
    if ((auth.status === "authenticated" ? auth.user?.id : auth.status === "guest" ? null : undefined) !== owner) throw new Error("Your session changed.");
    if (!owner) {
      const ids = new Set(guestIds(table));
      if (active) ids.add(id); else ids.delete(id);
      localStorage.setItem(keys[table], JSON.stringify([...ids]));
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("Account unavailable.");
    const column = table === "follows" ? "artist_id" : "artwork_id";
    const result = active
      ? await client.from(table).upsert({ user_id: owner, [column]: id }).select(column).single()
      : await client.from(table).delete().eq("user_id", owner).eq(column, id);
    if (result.error) throw result.error;
  },
  committed(table) {
    window.dispatchEvent(new CustomEvent(`arte:${table}-changed`, { detail: { origin } }));
    channel?.postMessage({ type: "invalidate", table });
  },
});

function synchronizeAuth() {
  const auth = getAuthSnapshot();
  store.activate(auth.status === "authenticated" ? auth.user?.id : auth.status === "guest" ? null : undefined);
}

function start() {
  if (started) return;
  started = true;
  startAuth();
  subscribeAuth(synchronizeAuth);
  synchronizeAuth();
  const tables = Object.keys(keys) as InteractionTable[];
  for (const table of tables) {
    window.addEventListener(`arte:${table}-changed`, (event) => {
      if ((event as CustomEvent<{ origin?: string }>).detail?.origin !== origin) {
        void store.refresh(table);
        channel?.postMessage({ type: "invalidate", table });
      }
    });
  }
  window.addEventListener("storage", (event) => {
    for (const table of tables) if (event.key === null || event.key === keys[table]) void store.refresh(table);
  });
  window.addEventListener("arte:analytics-reset", () => {
    // Resetting account activity keeps intentional likes, saves and follows intact.
    if (getAuthSnapshot().status === "guest") { void store.refresh("likes"); void store.refresh("follows"); }
  });
  try {
    if (typeof BroadcastChannel === "undefined") return;
    channel = new BroadcastChannel("arte:account-interactions");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as { type?: unknown; table?: unknown } | null;
      if (message?.type === "invalidate" && tables.includes(message.table as InteractionTable)) void store.refresh(message.table as InteractionTable);
    };
  } catch { /* Cross-tab updates are optional when browser messaging is unavailable. */ }
}

export function useInteraction(table: InteractionTable, id: string) {
  const auth = useAuth();
  const snapshot = useSyncExternalStore(store.subscribe, () => store.get(table), () => EMPTY_INTERACTIONS);
  useEffect(() => { start(); store.request(table); }, [table]);
  const owner = auth.status === "authenticated" ? auth.user?.id : auth.status === "guest" ? null : undefined;
  const current = snapshot.owner === owner && owner !== undefined;
  return {
    active: current && snapshot.values.has(id),
    ready: current && snapshot.ready,
    pending: current && snapshot.pending.has(id),
    failed: current && snapshot.failures.has(id),
    loadFailed: auth.status === "error" || (current && snapshot.error),
    set: async (active: boolean) => {
      const revision = getAuthSnapshot().revision;
      const saved = await store.set(table, id, active);
      return saved && getAuthSnapshot().revision === revision;
    },
    retry: () => { if (getAuthSnapshot().status === "error") retryAuth(); else void store.refresh(table); },
  };
}
