import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "./validation";

export function adminResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Authorization" } });
}

export async function requireAdmin(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { response: adminResponse({ error: "Administrator sign-in required." }, 401) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response: adminResponse({ error: "Administration is unavailable in this environment." }, 503) };
  try {
    // The same verified caller token reaches PostgreSQL: RLS remains enforced.
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return { response: adminResponse({ error: "Your session has expired. Sign in again." }, 401) };
    const role = await client.from("profiles").select("role").eq("id", data.user.id).single();
    if (role.error || role.data?.role !== "admin") return { response: adminResponse({ error: "Administrator access required." }, 403) };
    return { client, user: data.user };
  } catch {
    return { response: adminResponse({ error: "Administration could not verify your session. Try again." }, 503) };
  }
}
