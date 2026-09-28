"use client";

import type { Artwork } from "../artworks/types.ts";
import { getSupabaseBrowserClient } from "../supabase/client";
import { isAnalyticsEvent, MAX_HIDDEN_ARTWORK_IDS, type AnalyticsEvent, type AnalyticsEventType, type AnalyticsPayload } from "./types.ts";

const EVENT_STORAGE_KEY = "arte:analytics:events";
const SESSION_STORAGE_KEY = "arte:analytics:anonymous-session";
const ANALYTICS_PREFERENCE_KEY = "arte:analytics:personalization-enabled";
const HIDDEN_STORAGE_KEY = "arte:guest:hidden";
const MAX_STORED_EVENTS = 500;
const pendingHostedWrites = new Set<Promise<void>>();
let hostedResetInProgress = false;

const EXPLICIT_EVENTS = new Set<AnalyticsEventType>([
  "artwork_like",
  "artwork_unlike",
  "artwork_save",
  "artwork_unsave",
  "artwork_share",
  "artwork_hide",
  "artwork_detail_open",
  "artist_open",
  "artist_follow",
  "artist_unfollow",
  "more_like_this_open",
  "collection_add",
  "collection_remove",
  "listing_open",
  "gallery_open",
  "inquiry_start",
  "search_query",
  "search_result_open",
]);

function identifier(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function anonymousSessionId() {
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created = identifier("anonymous");
  localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export function personalizationAnalyticsEnabled() {
  try { return localStorage.getItem(ANALYTICS_PREFERENCE_KEY) !== "false"; }
  catch { return false; }
}

export function setPersonalizationAnalyticsEnabled(enabled: boolean) {
  localStorage.setItem(ANALYTICS_PREFERENCE_KEY, String(enabled));
  window.dispatchEvent(new Event("arte:analytics-preference"));
}

export function readStoredEvents(): AnalyticsEvent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsEvent).slice(-MAX_STORED_EVENTS) : [];
  } catch {
    return [];
  }
}

function writeStoredEvents(events: AnalyticsEvent[]) {
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events.slice(-MAX_STORED_EVENTS)));
}

export function readHiddenArtworkIds() {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 128))].slice(-MAX_HIDDEN_ARTWORK_IDS) : [];
  } catch {
    return [];
  }
}

export function hideArtworkLocally(artworkId: string) {
  const hidden = new Set(readHiddenArtworkIds());
  hidden.add(artworkId);
  localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...hidden]));
}

export function restoreHiddenArtworkHistory() {
  localStorage.removeItem(HIDDEN_STORAGE_KEY);
  writeStoredEvents(readStoredEvents().filter((event) => event.eventType !== "artwork_hide"));
  window.dispatchEvent(new Event("arte:analytics-reset"));
}

/** A device-only reset. Never implies deletion of hosted events or account data. */
export function resetLocalTasteHistory(clearGuestLikes = false) {
  localStorage.removeItem(EVENT_STORAGE_KEY);
  localStorage.removeItem(HIDDEN_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
  if (clearGuestLikes) {
    localStorage.removeItem("arte:guest:likes");
    localStorage.removeItem("arte:guest:follows");
    window.dispatchEvent(new Event("arte:follows-changed"));
  }
  window.dispatchEvent(new Event("arte:analytics-reset"));
}

export async function resetHostedTasteHistory(expectedUserId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Account storage is unavailable.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sign in before clearing account activity.");
  if (data.user.id !== expectedUserId) throw new Error("Your signed-in account changed. Review the reset and try again.");
  if (hostedResetInProgress) throw new Error("A reset is already in progress.");
  hostedResetInProgress = true;
  try {
    // Finish earlier writes before deleting, so they cannot restore old history later.
    await Promise.allSettled([...pendingHostedWrites]);
    const current = await client.auth.getUser();
    if (current.error || current.data.user?.id !== data.user.id) throw new Error("Your signed-in account changed. Review the reset and try again.");
    // The RPC checks this ID against auth.uid() within the deletion transaction.
    // A mutable browser session cannot redirect a confirmed reset to another account.
    const result = await client.rpc("reset_my_personalization", { expected_user_id: expectedUserId });
    if (result.error) throw new Error("Account activity could not be cleared. Try again later.");
  } finally { hostedResetInProgress = false; }
}

type RecordEventInput = {
  eventType: AnalyticsEventType;
  artwork?: Pick<Artwork, "id"> & { artist: Pick<Artwork["artist"], "id"> };
  artistId?: string;
  source: string;
  position?: number | null;
  recommendationReason?: string | null;
  payload?: AnalyticsPayload;
};

async function persistEvent(event: AnalyticsEvent) {
  const client = getSupabaseBrowserClient();
  if (!client) return;

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return;
  await client.from("events").insert({
    user_id: data.user.id,
    anonymous_session_id: event.anonymousSessionId,
    artwork_id: event.artworkId ?? null,
    artist_id: event.artistId ?? null,
    feed_session_id: event.feedSessionId ?? null,
    event_type: event.eventType,
    source: event.source,
    position: event.position ?? null,
    recommendation_reason: event.recommendationReason ?? null,
    viewport: event.viewport ?? null,
    payload: event.payload ?? {},
    created_at: event.timestamp,
  });
}

export function recordAnalyticsEvent(input: RecordEventInput): AnalyticsEvent | null {
  if (!personalizationAnalyticsEnabled() && !EXPLICIT_EVENTS.has(input.eventType)) return null;

  // Private browsing and storage restrictions must never break a user action.
  let sessionId: string;
  try { sessionId = anonymousSessionId(); } catch { return null; }

  const event: AnalyticsEvent = {
    id: identifier("event"),
    eventType: input.eventType,
    anonymousSessionId: sessionId,
    artworkId: input.artwork?.id ?? null,
    artistId: input.artwork?.artist.id ?? input.artistId ?? null,
    source: input.source,
    position: input.position ?? null,
    recommendationReason: input.recommendationReason ?? null,
    timestamp: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    payload: input.payload,
  };

  const events = readStoredEvents();
  events.push(event);
  try { writeStoredEvents(events); } catch { return null; }
  window.dispatchEvent(new CustomEvent("arte:analytics-event", { detail: event }));
  if (!hostedResetInProgress) {
    const write = persistEvent(event).catch(() => { /* Local preferences remain usable when hosting is unavailable. */ });
    pendingHostedWrites.add(write);
    void write.finally(() => pendingHostedWrites.delete(write));
  }
  return event;
}
