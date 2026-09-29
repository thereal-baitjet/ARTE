import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
assert.ok(url && key && serviceKey, "Local Supabase credentials required");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname), "Only disposable local Supabase is allowed");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const users = [];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3102"], { stdio: ["ignore", "ignore", "pipe"] });
let serverError = "";
server.stderr.on("data", (chunk) => { serverError += chunk.toString().slice(0, 1000); });
const base = "http://127.0.0.1:3102";
const checked = (result) => { assert.equal(result.error, null, result.error?.message); return result.data; };
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Next server must start: " + serverError);
  const work = checked(await admin.from("artworks").select("id").eq("is_published", true).eq("is_synthetic", false).eq("image_rights_state", "public_domain").limit(1))[0];
  assert.ok(work);
  const tokens = [];
  for (let i = 0; i < 3; i++) {
    const email = `corridor-api-${randomUUID()}@example.com`;
    const password = `Corridor-${randomUUID()}!`;
    const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push(user.id);
    const client = createClient(url, key, options);
    tokens.push(checked(await client.auth.signInWithPassword({ email, password })).session.access_token);
  }
  checked(await admin.from("early_access_members").insert(users.slice(0, 2).map((user_id) => ({ user_id }))));
  async function call(token, method = "GET", noteText, query = "") {
    const response = await fetch(`${base}/api/corridor/${work.id}${query}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      ...(noteText !== undefined ? { body: JSON.stringify({ noteText }) } : {}),
    });
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    assert.match(response.headers.get("vary"), /Authorization/i);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await call(null)).status, 401);
  assert.equal((await call("invalid.session.token")).status, 401);
  assert.equal((await call(tokens[2])).status, 403);
  assert.equal((await call(tokens[2], "POST", "Cannot enter")).status, 403);
  assert.equal((await call(tokens[2], "GET", undefined, "?access=1")).data.eligible, false);
  assert.equal((await call(tokens[0], "GET", undefined, "?access=1")).data.eligible, true);
  assert.equal((await call(tokens[0], "POST", "A quiet moment")).status, 200);
  assert.equal((await call(tokens[0], "POST", "Again")).status, 409);
  const shared = await call(tokens[1]);
  assert.equal(shared.status, 200);
  assert.equal(shared.data.notes[0].noteText, "A quiet moment");
  assert.equal(shared.data.notes[0].isOwn, false);
  assert.ok(!JSON.stringify(shared.data).includes(users[0]));
  assert.equal((await call(tokens[1], "PATCH", "Not mine")).status, 404);
  assert.equal((await call(tokens[1], "DELETE")).status, 404);
  assert.equal((await call(tokens[0], "PATCH", "A slower moment")).data.noteText, "A slower moment");
  assert.equal((await call(tokens[0], "PATCH", "https://spam.example")).status, 422);
  assert.equal((await call(tokens[0], "PATCH", "x".repeat(141))).status, 400);
  assert.equal((await call(tokens[0], "PATCH", "x".repeat(3000))).status, 413);
  assert.equal((await call(tokens[0], "DELETE")).status, 200);
  assert.equal((await call(tokens[1])).data.notes.length, 0);
  checked(await admin.from("early_access_members").update({ revoked_at: new Date().toISOString() }).eq("user_id", users[0]));
  assert.equal((await call(tokens[0])).status, 403);
  console.log("Corridor HTTP API: verified Auth, cohort isolation, CRUD, moderation, bounded bodies, revocation, and private headers passed.");
} finally {
  server.kill("SIGTERM");
  for (const id of users) checked(await admin.auth.admin.deleteUser(id));
}
