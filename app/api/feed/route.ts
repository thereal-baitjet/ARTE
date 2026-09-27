import { NextRequest, NextResponse } from "next/server";
import { getDemoFeedPage } from "@/lib/artworks/feed";

export function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");
  const rawLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "4", 10);
  const limit = Number.isNaN(rawLimit) ? 4 : rawLimit;
  const page = getDemoFeedPage(cursor, limit);

  if (!page.validCursor) {
    return NextResponse.json({ error: "Invalid feed cursor." }, { status: 400 });
  }

  return NextResponse.json({ items: page.items, nextCursor: page.nextCursor });
}
