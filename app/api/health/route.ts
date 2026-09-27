export function GET() {
  return Response.json({ status: "ok", app: "ARTE", catalog: "public-domain-and-demo", accountBackendConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
