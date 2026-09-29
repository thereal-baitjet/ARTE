import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url, "SUPABASE_URL is required");
assert.ok(anonKey, "SUPABASE_ANON_KEY is required");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Auth integration must target the disposable local Supabase stack");

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};
const publicClient = createClient(url, anonKey, clientOptions);
const ownerClient = createClient(url, anonKey, clientOptions);
const otherClient = createClient(url, anonKey, clientOptions);
const adminClient = createClient(url, serviceRoleKey, clientOptions);
const manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/catalog-manifest.json", import.meta.url), "utf8"));
const createdUsers = [];

function success(result, operation) {
  assert.equal(result.error, null, `${operation}: ${result.error?.message ?? ""}`);
  return result.data;
}

async function signUpAndIn(client, label) {
  const email = `arte-${label}-${randomUUID()}@example.com`;
  const password = `Arte-integration-${randomUUID()}!`;
  const signup = success(await client.auth.signUp({ email, password }), `${label} sign-up`);
  assert.ok(signup.user?.id, "sign-up returns a user identity");
  createdUsers.push(signup.user.id);
  const signin = success(await client.auth.signInWithPassword({ email, password }), `${label} sign-in`);
  assert.ok(signin.session?.access_token, "sign-in returns a session");
  const profile = success(await client.from("profiles").select("id, role").eq("id", signup.user.id).single(), `${label} profile provisioning`);
  assert.equal(profile.id, signup.user.id);
  assert.equal(profile.role, "user");
  return signup.user.id;
}

try {
  const catalog = await publicClient.from("artworks").select("id, image_rights_state, image_license, museum_id", { count: "exact" }).eq("is_synthetic", false);
  const artworks = success(catalog, "anonymous catalog read");
  assert.equal(catalog.count, manifest.realArtworkCount, "API exposes every real artwork in the release manifest");
  assert.equal(artworks.length, manifest.realArtworkCount, "real catalog fits in one bounded API page");
  const expectedLicenses = new Map(manifest.artworks.map((artwork) => [artwork.id, artwork.license]));
  assert.ok(artworks.every((artwork) => artwork.image_rights_state === "public_domain" && artwork.image_license === expectedLicenses.get(artwork.id) && artwork.museum_id), "public catalog preserves each verified image license and museum attribution");
  const artworkId = artworks[0].id;
  const anonymousWrite = await publicClient.from("events").insert({ anonymous_session_id: "auth-integration-anon", event_type: "feed_refresh" });
  assert.equal(anonymousWrite.error?.code, "42501", "anonymous analytics writes are rejected over the REST API");

  const ownerId = await signUpAndIn(ownerClient, "owner");
  const otherId = await signUpAndIn(otherClient, "other");
  assert.equal((await publicClient.rpc("shared_corridor_page", { p_artwork_id: artworkId })).error?.code, "42501");
  assert.equal(success(await ownerClient.rpc("shared_corridor_access", { p_artwork_id: artworkId }), "non-cohort gate"), false);
  assert.equal((await ownerClient.from("early_access_members").insert({ user_id: ownerId })).error?.code, "42501");
  success(await adminClient.from("early_access_members").insert([{ user_id: ownerId }, { user_id: otherId }]), "provision cohort");
  assert.equal((await ownerClient.from("shared_corridor_notes").select("*")).error?.code, "42501", "direct REST cannot expose owner IDs");
  const writeNote = (client, operation, text, work = artworkId) => client.rpc("shared_corridor_write", {
    p_artwork_id: work, p_operation: operation, p_note_text: text,
  });
  const note = success(await writeNote(ownerClient, "create", "A moment of stillness"), "create corridor note");
  assert.deepEqual(Object.keys(note).sort(), ["createdAt", "id", "isOwn", "noteText", "updatedAt"]);
  assert.equal((await writeNote(ownerClient, "create", "Duplicate")).error?.code, "23505");
  const shared = success(await otherClient.rpc("shared_corridor_page", { p_artwork_id: artworkId }), "cohort reads note");
  assert.equal(shared.notes.find((item) => item.id === note.id)?.isOwn, false);
  assert.equal((await writeNote(otherClient, "update", "Not mine")).error?.code, "P0404");
  assert.equal((await writeNote(otherClient, "delete", null)).error?.code, "P0404");
  success(await writeNote(ownerClient, "update", "Soft and still"), "edit own corridor note");
  success(await writeNote(ownerClient, "delete", null), "delete own corridor note");
  const parallel = await Promise.all(artworks.slice(1, 13).map((work) => writeNote(ownerClient, "create", "Quiet light", work.id)));
  assert.equal(parallel.filter((result) => !result.error).length, 9, "atomic daily cap survives concurrent requests and deletion");
  assert.equal(parallel.filter((result) => result.error?.code === "P0429").length, 3);
  success(await adminClient.from("early_access_members").update({ revoked_at: new Date().toISOString() }).eq("user_id", ownerId), "revoke membership");
  assert.equal((await ownerClient.rpc("shared_corridor_page", { p_artwork_id: artworkId })).error?.code, "42501", "existing session loses access after revocation");

  const escalation = await ownerClient.from("profiles").update({ role: "admin" }).eq("id", ownerId);
  assert.equal(escalation.error?.code, "42501", "an owner cannot promote their own role");

  const collection = success(await ownerClient.from("collections").insert({ owner_id: ownerId, name: `Integration collection ${randomUUID()}` }).select("id").single(), "create private collection");
  success(await ownerClient.from("collection_items").insert({ collection_id: collection.id, artwork_id: artworkId }), "add real artwork to collection");
  const hidden = success(await otherClient.from("collections").select("id").eq("id", collection.id), "cross-account private collection read");
  assert.deepEqual(hidden, [], "private collection is hidden from another account");
  const hiddenItems = success(await otherClient.from("collection_items").select("artwork_id").eq("collection_id", collection.id), "cross-account collection item read");
  assert.deepEqual(hiddenItems, [], "private collection contents are hidden too");
  const impersonation = await otherClient.from("saves").insert({ user_id: ownerId, artwork_id: artworkId });
  assert.equal(impersonation.error?.code, "42501", "another account cannot write the owner's saves");

  success(await ownerClient.from("saves").insert({ user_id: ownerId, artwork_id: artworkId }), "save real artwork");
  success(await ownerClient.from("events").insert({ user_id: ownerId, artwork_id: artworkId, event_type: "artwork_save" }), "record owner personalization");
  success(await otherClient.from("events").insert({ user_id: otherId, event_type: "feed_refresh" }), "record other personalization");
  const wrongReset = await ownerClient.rpc("reset_my_personalization", { expected_user_id: otherId });
  assert.equal(wrongReset.error?.code, "42501", "reset cannot target another account");
  success(await ownerClient.rpc("reset_my_personalization", { expected_user_id: ownerId }), "reset own personalization");
  assert.deepEqual(success(await ownerClient.from("events").select("id").eq("user_id", ownerId), "owner history after reset"), []);
  assert.equal(success(await ownerClient.from("saves").select("artwork_id").eq("user_id", ownerId), "saved works after reset").length, 1, "reset preserves intentional saves");
  assert.equal(success(await otherClient.from("events").select("id").eq("user_id", otherId), "other history after reset").length, 1, "reset preserves another account's history");

  success(await ownerClient.from("collections").update({ visibility: "public" }).eq("id", collection.id), "publish collection");
  assert.equal(success(await publicClient.from("collections").select("id").eq("id", collection.id), "published collection anonymous read").length, 1);
  assert.equal(success(await publicClient.from("collection_items").select("artwork_id").eq("collection_id", collection.id), "published collection item anonymous read").length, 1);
  success(await ownerClient.auth.signOut(), "sign out owner");
  assert.equal(success(await ownerClient.auth.getSession(), "session after sign out").session, null);

  console.log(`Local Supabase Auth, ${manifest.realArtworkCount}-work API catalog, account isolation, role protection, collection sharing, and personalization reset passed`);
} finally {
  for (const id of createdUsers) {
    success(await adminClient.auth.admin.deleteUser(id), "clean up integration user");
  }
}
