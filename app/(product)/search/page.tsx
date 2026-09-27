import type { Metadata } from "next";
import { ArtworkSearch } from "@/components/search/ArtworkSearch";
import { DEMO_ARTWORKS } from "@/lib/artworks/demoArtworks";
import { parseSearchState } from "@/lib/search/engine";

export const metadata: Metadata = { title: "Search | ARTE", description: "Explore the ARTE collection by artist, color, mood, style, and composition." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") params.set(key, value);
  return <ArtworkSearch artworks={DEMO_ARTWORKS} initialState={parseSearchState(params, DEMO_ARTWORKS)} />;
}
