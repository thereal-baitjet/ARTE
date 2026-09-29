"use client";

import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../supabase/client";

export type AuthSnapshot = {
  status: "loading" | "guest" | "authenticated" | "error";
  session: Session | null;
  user: User | null;
  configured: boolean;
  error: string | null;
  revision: number;
};
const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const initial: AuthSnapshot = { status: configured ? "loading" : "guest", session: null, user: null, configured, error: null, revision: 0 };
let snapshot = initial;
let generation = 0;
let pendingToken: string | null = null;
let verifiedAt = 0;
let consumers = 0;
let stop: (() => void) | undefined;
const listeners = new Set<() => void>();

export function getAuthSnapshot() { return snapshot; }
export function subscribeAuth(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useAuth() { return useSyncExternalStore(subscribeAuth, getAuthSnapshot, () => initial); }
function publish(next: Omit<AuthSnapshot, "revision" | "configured">) {
  const identityChanged = next.user?.id !== snapshot.user?.id || next.status !== snapshot.status;
  snapshot = { ...next, configured, revision: snapshot.revision + Number(identityChanged) };
  for (const listener of listeners) listener();
}

async function boundedAuth<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Account verification timed out.")), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

function acceptSession(session: Session | null, force = false) {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  if (!session) {
    generation++; pendingToken = null;
    if (snapshot.status !== "guest") publish({ status: "guest", session: null, user: null, error: null });
    return;
  }
  if (!force && (pendingToken === session.access_token || (snapshot.status === "authenticated" && snapshot.session?.access_token === session.access_token && Date.now() - verifiedAt < 300_000))) return;
  const current = ++generation;
  pendingToken = session.access_token;
  if (snapshot.user?.id !== session.user.id || snapshot.status !== "authenticated") {
    publish({ status: "loading", session: null, user: null, error: null });
  }
  // Leave Supabase's auth callback before invoking Auth again: callbacks hold its session lock.
  setTimeout(() => {
    if (current !== generation || !consumers) return;
    void boundedAuth(client.auth.getUser(session.access_token)).then(({ data, error }) => {
      if (current !== generation || !consumers) return;
      pendingToken = null;
      if (error || !data.user || data.user.id !== session.user.id) {
        publish({ status: "error", session: null, user: null, error: "Your account could not be verified. Please retry or sign in again." });
        return;
      }
      verifiedAt = Date.now();
      publish({ status: "authenticated", session: { ...session, user: data.user }, user: data.user, error: null });
    }).catch(() => {
      if (current !== generation || !consumers) return;
      pendingToken = null;
      publish({ status: "error", session: null, user: null, error: "Your account could not be reached. Check your connection and retry." });
    });
  }, 0);
}

export async function retryAuth() {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const before = generation;
  try {
    const { data, error } = await boundedAuth(client.auth.getSession());
    if (before !== generation || !consumers) return;
    if (error) {
      publish({ status: "error", session: null, user: null, error: "This sign-in link could not be used. Please request a new link." });
    } else acceptSession(data.session, true);
  } catch {
    if (before === generation && consumers) publish({ status: "error", session: null, user: null, error: "Your account could not be reached. Check your connection and retry." });
  }
}

export function startAuth() {
  consumers++;
  if (consumers === 1) {
    const client = getSupabaseBrowserClient();
    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => acceptSession(session));
      void retryAuth();
      const focus = () => { if (document.visibilityState === "visible" && Date.now() - verifiedAt >= 300_000) void retryAuth(); };
      window.addEventListener("focus", focus);
      document.addEventListener("visibilitychange", focus);
      stop = () => { subscription.unsubscribe(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
    }
  }
  return () => {
    consumers--;
    if (!consumers) { generation++; pendingToken = null; stop?.(); stop = undefined; }
  };
}
