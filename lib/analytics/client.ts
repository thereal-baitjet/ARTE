"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Artwork } from "../artworks/types.ts";
import { getAuthSnapshot, retryAuth, startAuth, subscribeAuth } from "../auth/session";
import { accountEvent, accountHiddenArtworkIds, composeAccountActivity, mergeAccountEvents, quarantineLegacyActivity, updateAccountChoices, MAX_ACTIVITY_EVENTS, type AccountChoices } from "./account.ts";
import { isAnalyticsEvent, MAX_HIDDEN_ARTWORK_IDS, type AnalyticsEvent, type AnalyticsEventType, type AnalyticsPayload } from "./types.ts";

const EVENT_STORAGE_KEY = "arte:analytics:events";
const SESSION_STORAGE_KEY = "arte:analytics:anonymous-session";
const ANALYTICS_PREFERENCE_KEY = "arte:analytics:personalization-enabled";
const HIDDEN_STORAGE_KEY = "arte:guest:hidden";
const EXPLICIT_EVENTS = new Set<AnalyticsEventType>(["artwork_like", "artwork_unlike", "artwork_save", "artwork_unsave", "artwork_share", "artwork_hide", "artwork_detail_open", "artist_open", "artist_follow", "artist_unfollow", "more_like_this_open", "collection_add", "collection_remove", "listing_open", "gallery_open", "inquiry_start", "search_query", "search_result_open"]);
export type ActivitySnapshot = { status: "loading" | "ready" | "error"; scope: string | null; error: string | null; enabled: boolean; revision: number };
const initial: ActivitySnapshot = { status: "loading", scope: null, error: null, enabled: false, revision: 0 };
let snapshot = initial;
let history: AnalyticsEvent[] = [];
let choices: AccountChoices = { likes: [], saves: [], follows: [] };
let hidden: string[] = [];
let accountSessionId = "";
let generation = 0;
let sequence = 0;
let journal: { sequence: number; event: AnalyticsEvent }[] = [];
let users = 0;
let cleanup: (() => void) | null = null;
let resettingUser: string | null = null;
let lastHydratedAt = 0;
let hydration: Promise<void> | null = null;
let accountChannel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
const pendingWrites = new Map<Promise<void>, string>();

export function getActivitySnapshot() { return snapshot; }
export function useActivitySnapshot() { return useSyncExternalStore(subscribeActivity, getActivitySnapshot, () => initial); }
function subscribeActivity(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(next: Partial<ActivitySnapshot>, reset = false) {
  snapshot = { ...snapshot, ...next, revision: snapshot.revision + 1 };
  for (const listener of listeners) listener();
  if (reset) window.dispatchEvent(new Event("arte:analytics-reset"));
}
function currentScope() {
  const auth = getAuthSnapshot();
  return auth.status === "authenticated" ? auth.user!.id : auth.status === "guest" ? "guest" : null;
}
function isCurrent(userId: string, revision?: number) {
  const auth = getAuthSnapshot();
  return auth.status === "authenticated" && auth.user?.id === userId && (revision === undefined || auth.revision === revision) && snapshot.scope === userId;
}
export function createAccountActivityClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Account storage is unavailable.");
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function accountContext() {
  const auth = getAuthSnapshot();
  if (auth.status !== "authenticated" || !auth.session || !auth.user || snapshot.scope !== auth.user.id) throw new Error("Your account is still being checked. Please try again.");
  return { userId: auth.user.id, revision: auth.revision, client: createAccountActivityClient(auth.session.access_token) };
}
function identifier() { return crypto.randomUUID(); }
function invalidateHydration() { generation++; hydration = null; }
function broadcastAccountChange() {
  try { accountChannel?.postMessage({ type: "activity-invalidated" }); } catch { /* Focus refresh remains available if cross-tab delivery fails. */ }
}
function guestEvents(): AnalyticsEvent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsEvent).filter((event) => !event.userId).slice(-MAX_ACTIVITY_EVENTS) : [];
  } catch { return []; }
}
function guestEnabled() { try { return localStorage.getItem(ANALYTICS_PREFERENCE_KEY) !== "false"; } catch { return false; } }
function guestHidden(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 128))].slice(-MAX_HIDDEN_ARTWORK_IDS) : [];
  } catch { return []; }
}
export function personalizationAnalyticsEnabled() {
  const scope = currentScope();
  if (!scope || scope !== snapshot.scope) return false;
  return scope === "guest" ? guestEnabled() : snapshot.status === "ready" && snapshot.enabled;
}
export function readStoredEvents(): AnalyticsEvent[] {
  const scope = currentScope();
  if (!scope || scope !== snapshot.scope) return [];
  return scope === "guest" ? guestEvents() : composeAccountActivity(scope, history, choices);
}
export function readHiddenArtworkIds() {
  const scope = currentScope();
  if (!scope || scope !== snapshot.scope) return [];
  return scope === "guest" ? guestHidden() : [...hidden];
}

async function hydrateAccount() {
  const context = accountContext();
  const current = ++generation;
  const startingSequence = sequence;
  try {
    await Promise.allSettled([...pendingWrites].filter(([, user]) => user === context.userId).map(([write]) => write));
    const { client, userId } = context;
    const [eventsResult, likesResult, savesResult, followsResult, profileResult, hiddenResult] = await Promise.all([
      client.from("events").select("id,user_id,anonymous_session_id,artwork_id,artist_id,feed_session_id,event_type,source,position,recommendation_reason,viewport,payload,created_at").eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(MAX_ACTIVITY_EVENTS),
      client.from("likes").select("artwork_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX_ACTIVITY_EVENTS),
      client.from("saves").select("artwork_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX_ACTIVITY_EVENTS),
      client.from("follows").select("artist_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX_ACTIVITY_EVENTS),
      client.from("profiles").select("personalization_analytics_enabled").eq("id", userId).single(),
      client.from("events").select("id,user_id,event_type,artwork_id,created_at").eq("user_id", userId).eq("event_type", "artwork_hide").not("artwork_id", "is", null).order("created_at", { ascending: false }).limit(MAX_HIDDEN_ARTWORK_IDS),
    ]);
    if (current !== generation || !isCurrent(userId, context.revision)) return;
    if ([eventsResult, likesResult, savesResult, followsResult, profileResult, hiddenResult].some((result) => result.error)) throw new Error("Your account activity could not be loaded. Your saved works are safe. Please retry.");
    const recent = journal.filter((entry) => entry.sequence > startingSequence).map(({ event }) => event);
    history = mergeAccountEvents(userId, (eventsResult.data ?? []).map((row) => accountEvent(row, userId)).filter((event): event is AnalyticsEvent => Boolean(event)), recent);
    choices = {
      likes: (likesResult.data ?? []).map((row) => ({ id: String(row.artwork_id), createdAt: String(row.created_at) })),
      saves: (savesResult.data ?? []).map((row) => ({ id: String(row.artwork_id), createdAt: String(row.created_at) })),
      follows: (followsResult.data ?? []).map((row) => ({ id: String(row.artist_id), createdAt: String(row.created_at) })),
    };
    for (const event of recent) choices = updateAccountChoices(choices, event);
    hidden = accountHiddenArtworkIds(userId, hiddenResult.data ?? [], recent);
    lastHydratedAt = Date.now();
    publish({ status: "ready", enabled: profileResult.data!.personalization_analytics_enabled === true, error: null }, true);
  } catch (error) {
    if (current !== generation || !isCurrent(context.userId, context.revision)) return;
    publish({ status: "error", error: error instanceof Error ? error.message : "Account activity is temporarily unavailable." }, true);
  }
}
export async function retryAccountActivity() {
  if (currentScope() === "guest") { publish({ status: "ready", enabled: guestEnabled(), error: null }, true); return; }
  if (!currentScope()) { await retryAuth(); return; }
  if (hydration) return hydration;
  const pending = hydrateAccount().finally(() => { if (hydration === pending) hydration = null; });
  hydration = pending;
  return pending;
}
export function startAccountActivity() {
  users++;
  if (users === 1) {
    const stopAuth = startAuth();
    const updateIdentity = () => {
      const scope = currentScope();
      if (scope === snapshot.scope) {
        if (!scope) {
          const auth = getAuthSnapshot();
          publish({ status: auth.status === "error" ? "error" : "loading", enabled: false, error: auth.error }, true);
        }
        return;
      }
      generation++; hydration = null; history = []; choices = { likes: [], saves: [], follows: [] }; hidden = []; journal = []; lastHydratedAt = 0;
      if (scope && scope !== "guest") {
        try { quarantineLegacyActivity(localStorage); } catch {
          // Account data remains memory-only even if this browser denies local storage.
        }
      }
      accountSessionId = scope && scope !== "guest" ? identifier() : "";
      const auth = getAuthSnapshot();
      publish({ scope, status: scope === "guest" ? "ready" : auth.status === "error" ? "error" : "loading", enabled: scope === "guest" && guestEnabled(), error: auth.error }, true);
      if (scope && scope !== "guest") void retryAccountActivity();
    };
    const stopAuthListener = subscribeAuth(updateIdentity);
    const refresh = () => {
      if (document.visibilityState === "visible" && currentScope() && currentScope() !== "guest" && Date.now() - lastHydratedAt > 30_000) void retryAccountActivity();
    };
    const storage = () => { if (currentScope() === "guest") publish({ enabled: guestEnabled() }); };
    updateIdentity();
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); window.addEventListener("storage", storage);
    let channel: BroadcastChannel | null = null;
    try { channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("arte:account-interactions") : null; } catch { /* Cross-tab refresh is optional when browser storage is restricted. */ }
    accountChannel = channel;
    if (channel) channel.onmessage = (message: MessageEvent<unknown>) => {
      if (message.data && typeof message.data === "object" && "type" in message.data && ["invalidate", "activity-invalidated"].includes(String(message.data.type)) && currentScope() && currentScope() !== "guest") {
        invalidateHydration();
        if (message.data.type === "activity-invalidated") publish({ status: "loading", enabled: false }, true);
        void retryAccountActivity();
      }
    };
    cleanup = () => { stopAuthListener(); stopAuth(); channel?.close(); accountChannel = null; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("storage", storage); };
  }
  return () => { users--; if (!users) { cleanup?.(); cleanup = null; } };
}

export async function setPersonalizationAnalyticsEnabled(enabled: boolean) {
  if (currentScope() === "guest") {
    try { localStorage.setItem(ANALYTICS_PREFERENCE_KEY, String(enabled)); } catch { throw new Error("This browser could not save your preference. Check whether site storage is allowed."); }
    publish({ enabled });
  } else {
    const { client, userId, revision } = accountContext();
    invalidateHydration();
    const result = await client.from("profiles").update({ personalization_analytics_enabled: enabled }).eq("id", userId).select("id").single();
    if (result.error) throw new Error("Your tracking preference could not be saved. Please try again.");
    if (!isCurrent(userId, revision)) throw new Error("Your account changed. Please review its settings.");
    invalidateHydration();
    publish({ enabled });
    if (snapshot.status !== "ready") void retryAccountActivity();
    broadcastAccountChange();
  }
  window.dispatchEvent(new Event("arte:analytics-preference"));
}
export function hideArtworkLocally(artworkId: string) {
  const scope = currentScope();
  if (!scope || scope !== snapshot.scope) return;
  if (scope === "guest") localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...new Set([...guestHidden(), artworkId])].slice(-MAX_HIDDEN_ARTWORK_IDS)));
  else hidden = [...new Set([...hidden, artworkId])].slice(-MAX_HIDDEN_ARTWORK_IDS);
}
export async function restoreHiddenArtworkHistory() {
  if (currentScope() === "guest") {
    localStorage.removeItem(HIDDEN_STORAGE_KEY);
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(guestEvents().filter((event) => event.eventType !== "artwork_hide")));
  } else {
    const { client, userId, revision } = accountContext();
    invalidateHydration();
    await Promise.allSettled([...pendingWrites].filter(([, user]) => user === userId).map(([write]) => write));
    const result = await client.from("events").delete().eq("user_id", userId).eq("event_type", "artwork_hide");
    if (result.error) throw new Error("Hidden works could not be restored. Please try again.");
    if (!isCurrent(userId, revision)) throw new Error("Your account changed. Please review its settings.");
    invalidateHydration();
    history = history.filter((event) => event.eventType !== "artwork_hide");
    journal = journal.filter(({ event }) => event.eventType !== "artwork_hide"); hidden = [];
    if (snapshot.status !== "ready") void retryAccountActivity();
    broadcastAccountChange();
  }
  publish({}, true);
}
export function resetLocalTasteHistory(clearGuestLikes = false) {
  if (currentScope() !== "guest") throw new Error("Use Clear account activity for your signed-in account.");
  localStorage.removeItem(EVENT_STORAGE_KEY); localStorage.removeItem(HIDDEN_STORAGE_KEY); localStorage.removeItem(SESSION_STORAGE_KEY);
  if (clearGuestLikes) {
    localStorage.removeItem("arte:guest:likes"); localStorage.removeItem("arte:guest:follows");
    window.dispatchEvent(new Event("arte:follows-changed"));
  }
  publish({}, true);
}
export async function resetHostedTasteHistory(expectedUserId: string) {
  const { client, userId, revision } = accountContext();
  if (userId !== expectedUserId) throw new Error("Your account changed. Review the reset and try again.");
  if (resettingUser) throw new Error("A reset is already in progress.");
  resettingUser = userId;
  invalidateHydration();
  try {
    await Promise.allSettled([...pendingWrites].filter(([, user]) => user === userId).map(([write]) => write));
    if (!isCurrent(userId, revision)) throw new Error("Your account changed. Review the reset and try again.");
    const result = await client.rpc("reset_my_personalization", { expected_user_id: userId });
    if (result.error) throw new Error("Account activity could not be cleared. Please try again.");
    if (!isCurrent(userId, revision)) return;
    invalidateHydration(); history = []; hidden = []; journal = [];
    publish({ status: "ready", error: null }, true);
    broadcastAccountChange();
  } finally { resettingUser = null; }
}

type RecordEventInput = { eventType: AnalyticsEventType; artwork?: Pick<Artwork, "id"> & { artist: Pick<Artwork["artist"], "id"> }; artistId?: string; source: string; position?: number | null; recommendationReason?: string | null; payload?: AnalyticsPayload };
export function recordAnalyticsEvent(input: RecordEventInput): AnalyticsEvent | null {
  const scope = currentScope();
  if (!scope || scope !== snapshot.scope || resettingUser === scope) return null;
  if (!personalizationAnalyticsEnabled() && !EXPLICIT_EVENTS.has(input.eventType)) return null;
  let sessionId = accountSessionId;
  if (scope === "guest") {
    try { sessionId = localStorage.getItem(SESSION_STORAGE_KEY) || identifier(); localStorage.setItem(SESSION_STORAGE_KEY, sessionId); } catch { return null; }
  }
  const event: AnalyticsEvent = { id: identifier(), eventType: input.eventType, anonymousSessionId: sessionId, userId: scope === "guest" ? null : scope, artworkId: input.artwork?.id ?? null, artistId: input.artwork?.artist.id ?? input.artistId ?? null, source: input.source, position: input.position ?? null, recommendationReason: input.recommendationReason ?? null, timestamp: new Date().toISOString(), viewport: { width: window.innerWidth, height: window.innerHeight }, payload: input.payload };
  if (scope === "guest") {
    try { localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify([...guestEvents(), event].slice(-MAX_ACTIVITY_EVENTS))); } catch { return null; }
  } else {
    const context = accountContext();
    history = mergeAccountEvents(scope, history, [event]); choices = updateAccountChoices(choices, event);
    journal.push({ sequence: ++sequence, event }); journal = journal.slice(-MAX_ACTIVITY_EVENTS);
    if (event.eventType === "artwork_hide" && event.artworkId) hidden = [...new Set([...hidden, event.artworkId])];
    const write = Promise.resolve(context.client.from("events").insert({ id: event.id, user_id: context.userId, anonymous_session_id: event.anonymousSessionId, artwork_id: event.artworkId, artist_id: event.artistId, feed_session_id: event.feedSessionId ?? null, event_type: event.eventType, source: event.source, position: event.position, recommendation_reason: event.recommendationReason, viewport: event.viewport, payload: event.payload ?? {}, created_at: event.timestamp }))
      .then(({ error }) => { if (error) throw error; if (event.eventType === "artwork_hide") broadcastAccountChange(); })
      .catch(() => { if (isCurrent(context.userId, context.revision)) publish({ error: "Your latest activity could not sync. Your saved choices are safe." }); });
    pendingWrites.set(write, context.userId); void write.finally(() => pendingWrites.delete(write));
  }
  window.dispatchEvent(new CustomEvent("arte:analytics-event", { detail: event }));
  return event;
}
