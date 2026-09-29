import { isAnalyticsEvent, MAX_HIDDEN_ARTWORK_IDS, type AnalyticsEvent } from "./types.ts";

export type AccountChoice = { id: string; createdAt: string };
export type AccountChoices = { likes: AccountChoice[]; saves: AccountChoice[]; follows: AccountChoice[] };
export const MAX_ACTIVITY_EVENTS = 500;
const toggleEvents = new Set(["artwork_like", "artwork_unlike", "artwork_save", "artwork_unsave", "artist_follow", "artist_unfollow"]);

export function accountEvent(row: Record<string, unknown>, expectedUserId: string): AnalyticsEvent | null {
  if (row.user_id !== expectedUserId) return null;
  const event = {
    id: row.id, userId: expectedUserId, eventType: row.event_type,
    anonymousSessionId: row.anonymous_session_id || `account:${expectedUserId}`,
    artworkId: row.artwork_id, artistId: row.artist_id, feedSessionId: row.feed_session_id,
    source: row.source || "account_activity", position: row.position,
    recommendationReason: row.recommendation_reason, timestamp: row.created_at,
    viewport: row.viewport, payload: row.payload,
  };
  return isAnalyticsEvent(event) ? event : null;
}

export function mergeAccountEvents(userId: string, ...groups: AnalyticsEvent[][]) {
  const unique = new Map<string, AnalyticsEvent>();
  for (const group of groups) for (const event of group) {
    if (event.userId === userId && isAnalyticsEvent(event)) unique.set(event.id, event);
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id)).slice(-MAX_ACTIVITY_EVENTS);
}

export function updateAccountChoices(choices: AccountChoices, event: AnalyticsEvent): AccountChoices {
  const kind = event.eventType === "artwork_like" || event.eventType === "artwork_unlike" ? "likes"
    : event.eventType === "artwork_save" || event.eventType === "artwork_unsave" ? "saves"
      : event.eventType === "artist_follow" || event.eventType === "artist_unfollow" ? "follows" : null;
  const id = kind === "follows" ? event.artistId : event.artworkId;
  if (!kind || !id) return choices;
  const remaining = choices[kind].filter((choice) => choice.id !== id);
  if (["artwork_like", "artwork_save", "artist_follow"].includes(event.eventType)) remaining.push({ id, createdAt: event.timestamp });
  return { ...choices, [kind]: remaining };
}

/** Current saved choices replace historical toggles, so another device cannot double their weight. */
export function composeAccountActivity(userId: string, history: AnalyticsEvent[], choices: AccountChoices): AnalyticsEvent[] {
  const signals: AnalyticsEvent[] = [];
  for (const kind of ["likes", "saves", "follows"] as const) {
    for (const choice of choices[kind]) signals.push({
      id: `choice:${kind}:${choice.id}`, userId,
      eventType: kind === "likes" ? "artwork_like" : kind === "saves" ? "artwork_save" : "artist_follow",
      anonymousSessionId: `account:${userId}`, source: "account_preferences",
      artworkId: kind === "follows" ? null : choice.id, artistId: kind === "follows" ? choice.id : null,
      timestamp: choice.createdAt,
    });
  }
  const recentHistory = history.filter((event) => event.userId === userId && !toggleEvents.has(event.eventType));
  // Keep recent explicit choices represented even after a busy browsing session.
  const selected = signals.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(-MAX_ACTIVITY_EVENTS);
  const remaining = MAX_ACTIVITY_EVENTS - selected.length;
  return [...(remaining ? recentHistory.slice(-remaining) : []), ...selected]
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
}

const LEGACY_KEYS = ["arte:analytics:events", "arte:guest:hidden", "arte:analytics:anonymous-session"] as const;
/** Older releases mixed account and guest activity, so its ownership cannot be safely inferred. */
export function quarantineLegacyActivity(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  const marker = "arte:analytics:scope-version";
  if (storage.getItem(marker) === "2") return;
  const archive = Object.fromEntries(LEGACY_KEYS.map((key) => [key, storage.getItem(key)]));
  if (Object.values(archive).some((value) => value !== null)) storage.setItem("arte:analytics:legacy-v1", JSON.stringify(archive));
  for (const key of LEGACY_KEYS) storage.removeItem(key);
  storage.setItem(marker, "2");
}


export function accountHiddenArtworkIds(userId: string, rows: Record<string, unknown>[], recent: AnalyticsEvent[]): string[] {
  const hiddenRows = rows.map((row) => accountEvent(row, userId)).filter((event): event is AnalyticsEvent => Boolean(event));
  return [...new Set([...recent.slice().reverse(), ...hiddenRows]
    .filter((event) => event.userId === userId && event.eventType === "artwork_hide" && event.artworkId)
    .map((event) => event.artworkId!))].slice(0, MAX_HIDDEN_ARTWORK_IDS);
}
