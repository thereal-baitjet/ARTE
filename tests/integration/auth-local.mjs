import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url, "SUPABASE_URL is required");
assert.ok(anonKey, "SUPABASE_ANON_KEY is required");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const publicClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const adminClient = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = "phase2-auth@example.com";
const password = "Arte-Phase2-Test-Password-42!";

const { data: signup, error: signupError } = await publicClient.auth.signUp({ email, password });
assert.equal(signupError, null, signupError?.message);
assert.ok(signup.user?.id, "signup should return a user");

const { data: signin, error: signinError } = await publicClient.auth.signInWithPassword({ email, password });
assert.equal(signinError, null, signinError?.message);
assert.ok(signin.session?.access_token, "sign-in should return an access token");

const { data: profile, error: profileError } = await adminClient
  .from("profiles")
  .select("id, role")
  .eq("id", signup.user.id)
  .single();

assert.equal(profileError, null, profileError?.message);
assert.equal(profile.id, signup.user.id);
assert.equal(profile.role, "user");

console.log("local Supabase Auth signup, sign-in, and profile provisioning passed");
