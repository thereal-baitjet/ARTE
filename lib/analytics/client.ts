"use client";

import type { Artwork } from "../artworks/types.ts";
import { getSupabaseBrowserClient } from "../supabase/client";
import { isAnalyticsEvent, type AnalyticsEvent, type AnalyticsEventType, type AnalyticsPayload } from "./types.ts";

const EVENT_STORAGE_KEY = "arte:analytics:events";
const SESSION_STORAGE_KEY = "arte:analytics:anonymous-session";
const ANALYTICS_PREFERENCE_KEY = "arte:analytics:personalization-enabled";
const HIDDEN_STORAGE_KEY = "arte:guest:hidden";
const MAX_STORED_EVENTS = 500;

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
  return localStorage.getItem(ANALYTICS_PREFERENCE_KEY) !== "false";
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
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
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
}

type RecordEventInput = {
  eventType: AnalyticsEventType;
  artwork?: Artwork;
  source: string;
  position?: number | null;
  recommendationReason?: string | null;
  payload?: AnalyticsPayload;
};

async function persistEvent(event: AnalyticsEvent) {
  const client = getSupabaseBrowserClient();
  if (!client) return;

  const { data } = await client.auth.getUser();
  await client.from("events").insert({
    user_id: data.user?.id ?? null,
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

  const event: AnalyticsEvent = {
    id: identifier("event"),
    eventType: input.eventType,
    anonymousSessionId: anonymousSessionId(),
    artworkId: input.artwork?.id ?? null,
    artistId: input.artwork?.artist.id ?? null,
    source: input.source,
    position: input.position ?? null,
    recommendationReason: input.recommendationReason ?? null,
    timestamp: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    payload: input.payload,
  };

  const events = readStoredEvents();
  events.push(event);
  writeStoredEvents(events);
  window.dispatchEvent(new CustomEvent("arte:analytics-event", { detail: event }));
  void persistEvent(event);
  return event;
}
