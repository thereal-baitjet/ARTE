import type { SupabaseClient } from "@supabase/supabase-js";

export const COLLECTIONS_STORAGE_KEY = "arte:guest:collections";
export const SAVES_STORAGE_KEY = "arte:guest:saves";

export type PrivateCollection = {
  id: string;
  name: string;
  visibility: "private" | "unlisted" | "public";
  artworkIds: string[];
};

export type CollectionSnapshot = {
  userId: string | null;
  collections: PrivateCollection[];
  savedIds: string[];
};

function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
}

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function readGuestCollections(): CollectionSnapshot {
  const raw = readJson(COLLECTIONS_STORAGE_KEY);
  const collections: PrivateCollection[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.name !== "string") continue;
      if (collections.some((existing) => existing.id === item.id)) continue;
      collections.push({ id: item.id, name: item.name, visibility: "private", artworkIds: stringIds(item.artworkIds) });
    }
  }
  return { userId: null, collections, savedIds: stringIds(readJson(SAVES_STORAGE_KEY)) };
}

export function writeGuestCollections(collections: PrivateCollection[]) {
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  window.dispatchEvent(new Event("arte:collections-changed"));
}

export function writeGuestSaves(savedIds: string[]) {
  localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(savedIds));
  window.dispatchEvent(new Event("arte:collections-changed"));
}

export function validateCollectionName(name: string, collections: PrivateCollection[], excludingId?: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a name for your collection.");
  if (trimmed.length > 80) throw new Error("Use 80 characters or fewer for the collection name.");
  if (collections.some((collection) => collection.id !== excludingId && collection.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    throw new Error("You already have a collection with that name.");
  }
  return trimmed;
}

function databaseError(error: { code?: string } | null, message: string) {
  if (!error) return;
  if (error.code === "23505") throw new Error("You already have a collection with that name.");
  throw new Error(message);
}

export async function readAllRows<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>, message: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const result = await load(offset, offset + 499);
    databaseError(result.error, message);
    rows.push(...result.data ?? []);
    if (!result.data || result.data.length < 500) return rows;
  }
  throw new Error("Your notebook is too large to load in one visit. Please contact ARTE for help.");
}

export async function readAccountCollections(client: SupabaseClient, userId: string): Promise<CollectionSnapshot> {
  const [collectionRows, saveRows] = await Promise.all([
    readAllRows<{ id: string; name: string; visibility: PrivateCollection["visibility"] }>((from, to) => client.from("collections").select("id,name,visibility").eq("owner_id", userId).order("created_at", { ascending: false }).order("id").range(from, to), "Your collections could not be loaded. Please try again."),
    readAllRows<{ artwork_id: string }>((from, to) => client.from("saves").select("artwork_id").eq("user_id", userId).order("created_at", { ascending: false }).order("artwork_id").range(from, to), "Your saved artworks could not be loaded. Please try again."),
  ]);
  const collections: PrivateCollection[] = collectionRows.map((row) => ({ ...row, artworkIds: [] }));
  const byId = new Map(collections.map((collection) => [collection.id, collection]));
  // Bound URL size independently from row pagination for accounts with many collections.
  for (let offset = 0; offset < collections.length; offset += 50) {
    const ids = collections.slice(offset, offset + 50).map(({ id }) => id);
    const items = await readAllRows<{ collection_id: string; artwork_id: string }>((from, to) => client.from("collection_items").select("collection_id,artwork_id").in("collection_id", ids).order("collection_id").order("position").order("artwork_id").range(from, to), "The artworks in your collections could not be loaded. Please try again.");
    for (const item of items) byId.get(item.collection_id)?.artworkIds.push(item.artwork_id);
  }
  return { userId, collections, savedIds: saveRows.map(({ artwork_id }) => artwork_id) };
}

export async function createAccountCollection(client: SupabaseClient, userId: string, name: string): Promise<PrivateCollection> {
  const result = await client.from("collections").insert({ owner_id: userId, name, visibility: "private" }).select("id,name,visibility").single();
  databaseError(result.error, "Your collection could not be created. Please try again.");
  if (!result.data) throw new Error("Your collection was not created.");
  return { ...result.data, artworkIds: [] } as PrivateCollection;
}

export async function renameAccountCollection(client: SupabaseClient, userId: string, id: string, name: string) {
  const result = await client.from("collections").update({ name }).eq("owner_id", userId).eq("id", id).select("id").single();
  databaseError(result.error, "Your collection could not be renamed. Please try again.");
}

export async function deleteAccountCollection(client: SupabaseClient, userId: string, id: string) {
  const result = await client.from("collections").delete().eq("owner_id", userId).eq("id", id);
  databaseError(result.error, "Your collection could not be deleted. Please try again.");
}

export async function updateAccountCollectionItem(client: SupabaseClient, collectionId: string, artworkId: string, add: boolean, position: number) {
  // Ownership of the parent collection is enforced by collection_items_owner_all RLS.
  const result = add
    ? await client.from("collection_items").upsert({ collection_id: collectionId, artwork_id: artworkId, position }).select("artwork_id").single()
    : await client.from("collection_items").delete().eq("collection_id", collectionId).eq("artwork_id", artworkId);
  databaseError(result.error, `The artwork could not be ${add ? "added to" : "removed from"} your collection. Please try again.`);
}

export async function removeAccountSave(client: SupabaseClient, userId: string, artworkId: string) {
  const result = await client.from("saves").delete().eq("user_id", userId).eq("artwork_id", artworkId);
  databaseError(result.error, "The saved artwork could not be removed. Please try again.");
}
