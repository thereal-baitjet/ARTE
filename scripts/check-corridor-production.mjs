import { PUBLIC_ARTWORKS } from "../lib/artworks/publicCatalog.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supply ARTE's public Supabase URL and publishable key.");
const origin = new URL(url).origin;
const sample = PUBLIC_ARTWORKS[0];
const headers = { apikey: key, "Content-Type": "application/json" };
const checks = [];

async function request(path, body) {
  const response = await fetch(origin + path, {
    method: body ? "POST" : "GET", headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  return { response, data: await response.json() };
}

const query = new URLSearchParams({ select: "id,is_published,is_synthetic,image_rights_state", id: `eq.${sample.id}`, limit: "1" });
const catalog = await request(`/rest/v1/artworks?${query}`);
checks.push({
  check: "published_artwork", status: catalog.response.status,
  passed: catalog.response.ok && Array.isArray(catalog.data) && catalog.data.length === 1
    && catalog.data[0].is_published === true && catalog.data[0].is_synthetic === false && catalog.data[0].image_rights_state === "public_domain",
});

for (const functionName of ["shared_corridor_access", "shared_corridor_page"]) {
  const result = await request(`/rest/v1/rpc/${functionName}`, {
    p_artwork_id: sample.id,
    ...(functionName.endsWith("page") ? { p_before: null, p_before_id: null } : {}),
  });
  checks.push({ check: `${functionName}_anonymous_denied`, status: result.response.status,
    passed: !result.response.ok && result.data?.code === "42501", code: result.data?.code ?? null });
}

console.log(JSON.stringify({ project: new URL(url).hostname.split(".")[0], sampleArtworkId: sample.id, checks,
  signedInJourney: "Requires a separate authorized early-access session; this preflight never sends email or writes notes." }, null, 2));
process.exitCode = checks.every((check) => check.passed) ? 0 : 1;
