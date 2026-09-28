import { artworkSummary } from "@/lib/artworks/summary";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";

export function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const cursor = search.get("cursor");
  const limit = Number(search.get("limit") ?? 20);
  const start = cursor ? PUBLIC_ARTWORKS.findIndex((artwork) => artwork.id === cursor) + 1 : 0;
  if ((cursor !== null && (cursor.length > 128 || start === 0)) || !Number.isInteger(limit) || limit < 1 || limit > 20) return Response.json({ error: "Invalid artwork page." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const items = PUBLIC_ARTWORKS.slice(start, start + limit);
  return Response.json({ items: items.map(artworkSummary), nextCursor: start + items.length < PUBLIC_ARTWORKS.length ? items.at(-1)?.id ?? null : null }, { headers: { "Cache-Control": "public, max-age=300" } });
}
