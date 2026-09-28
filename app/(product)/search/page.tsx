import type { Metadata } from "next";
import { ArtworkSearch } from "@/components/search/ArtworkSearch";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { getSearchFacets, parseSearchState } from "@/lib/search/engine";
import { getSearchPage } from "@/lib/search/pagination";
import { searchStateToParams } from "@/lib/search/state";

export const metadata: Metadata = { title: "Search | ARTE", description: "Explore the ARTE collection by artist, color, mood, style, and composition." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") params.set(key, value);
  const state = parseSearchState(params, PUBLIC_ARTWORKS);
  return <ArtworkSearch key={searchStateToParams(state).toString()} initialPage={getSearchPage(PUBLIC_ARTWORKS, state)} facets={getSearchFacets(PUBLIC_ARTWORKS)} />;
}
