import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { parseSearchState } from "@/lib/search/engine";
import { getSearchPage, parseSearchLimit, SearchRequestError } from "@/lib/search/pagination";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if ((params.get("cursor")?.length ?? 0) > 128) return Response.json({ error: "Invalid search cursor." }, { status: 400 });
  try {
    const state = parseSearchState(params, PUBLIC_ARTWORKS);
    const page = getSearchPage(PUBLIC_ARTWORKS, state, params.get("cursor"), parseSearchLimit(params.get("limit")));
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SearchRequestError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Search is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
