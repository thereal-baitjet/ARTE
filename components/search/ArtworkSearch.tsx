"use client";

import { useMemo, useState } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import type { Artwork } from "@/lib/artworks/types";
import { EMPTY_SEARCH_FILTERS, MAX_SEARCH_LENGTH, getSearchFacets, searchArtworks, searchStateToParams, type SearchFilters, type SearchState } from "@/lib/search/engine";

const suggestions = ["calm blue", "warm abstraction", "Maris Vale", "geometric form"];

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="min-w-0 text-[10px] uppercase tracking-[0.15em] text-[var(--muted-text)]">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 block min-h-11 w-full border border-[var(--hairline)] bg-transparent px-3 text-sm normal-case tracking-normal text-[var(--primary-ink)]">
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function ArtworkSearch({ artworks, initialState }: { artworks: Artwork[]; initialState: SearchState }) {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState(initialState.query);
  const facets = useMemo(() => getSearchFacets(artworks), [artworks]);
  const results = useMemo(() => searchArtworks(artworks, state.query, state.filters), [artworks, state]);
  const activeFilterCount = Object.values(state.filters).filter(Boolean).length;
  const isSearching = Boolean(state.query || activeFilterCount);

  function apply(nextState: SearchState) {
    const next = { ...nextState, query: nextState.query.trim().slice(0, MAX_SEARCH_LENGTH) };
    setState(next);
    setDraft(next.query);
    const params = searchStateToParams(next).toString();
    window.history.replaceState(null, "", params ? `/search?${params}` : "/search");
    recordAnalyticsEvent({ eventType: "search_query", source: "catalog_search", payload: { query: next.query, ...next.filters, resultCount: searchArtworks(artworks, next.query, next.filters).length } });
  }

  function updateFilter(key: keyof SearchFilters, value: string) {
    apply({ query: draft, filters: { ...state.filters, [key]: value } });
  }

  const options = (values: string[]) => values.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

  return (
    <div className="page-shell px-6 py-10 md:px-12 md:py-14 xl:px-16">
      <header className="max-w-3xl">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Search the collection</p>
        <h1 className="display-serif mt-4 text-5xl leading-[1.05] md:text-6xl">Follow a feeling.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted-text)]">A color, a mood, an artist, a remembered form. Explore {artworks.length} works through their titles, descriptions, and catalog metadata. Museum works and synthetic studies are clearly attributed.</p>
      </header>

      <form role="search" aria-label="Search artworks" className="mt-9" onSubmit={(event) => { event.preventDefault(); apply({ ...state, query: draft }); }}>
        <label htmlFor="artwork-query" className="sr-only">Search artworks, artists, colors, or moods</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="artwork-query" type="search" value={draft} maxLength={MAX_SEARCH_LENGTH} placeholder="Try ‘calm blue’ or ‘Maris Vale’" onChange={(event) => setDraft(event.target.value)} className="focus-ring min-h-14 min-w-0 flex-1 border border-[var(--hairline)] bg-[var(--soft-white)] px-5 text-base" />
          <button type="submit" className="focus-ring min-h-12 bg-[var(--primary-ink)] px-8 text-xs uppercase tracking-[0.15em] text-[var(--soft-white)]">Search</button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1" aria-label="Suggested searches">
        <span className="text-xs text-[var(--muted-text)]">Start with</span>
        {suggestions.map((query) => <button key={query} type="button" onClick={() => apply({ query, filters: { ...EMPTY_SEARCH_FILTERS } })} className="focus-ring min-h-11 border-b border-transparent text-xs text-[var(--secondary-ink)] hover:border-[var(--primary-ink)]">{query}</button>)}
      </div>

      <fieldset className="mt-7 border-t border-[var(--hairline)] pt-6">
        <legend className="sr-only">Filter artworks</legend>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <FilterSelect label="Artists" value={state.filters.artist} options={facets.artists} onChange={(value) => updateFilter("artist", value)} />
          <FilterSelect label="Styles / categories" value={state.filters.movement} options={options(facets.movements)} onChange={(value) => updateFilter("movement", value)} />
          <FilterSelect label="Moods" value={state.filters.mood} options={options(facets.moods)} onChange={(value) => updateFilter("mood", value)} />
          <FilterSelect label="Colors" value={state.filters.palette} options={options(facets.palettes)} onChange={(value) => updateFilter("palette", value)} />
          <FilterSelect label="Orientations" value={state.filters.orientation} options={options(facets.orientations)} onChange={(value) => updateFilter("orientation", value)} />
        </div>
      </fieldset>

      <div className="mt-8 flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--hairline)] pb-4">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-[var(--secondary-ink)]">{results.length} {results.length === 1 ? "work" : "works"}{state.query ? <> for <span className="font-medium">“{state.query}”</span></> : " in the collection"}{activeFilterCount ? ` · ${activeFilterCount} ${activeFilterCount === 1 ? "filter" : "filters"}` : ""}</p>
        {isSearching ? <button type="button" onClick={() => apply({ query: "", filters: { ...EMPTY_SEARCH_FILTERS } })} className="focus-ring min-h-11 text-xs underline underline-offset-4">Clear search and filters</button> : null}
      </div>

      {results.length ? (
        <div className="mt-8 grid items-start gap-x-7 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
          {results.map(({ artwork, matches, corrections }, index) => (
            <div key={artwork.id} data-testid="search-result" onClickCapture={(event) => {
              if (!(event.target as HTMLElement).closest("a")) return;
              recordAnalyticsEvent({ eventType: "search_result_open", artwork, source: "catalog_search", position: index, payload: { query: state.query, ...state.filters } });
            }}>
              <ArtworkCard artwork={artwork} />
              {matches.length ? <p className="mt-4 border-l border-[var(--antique-gold)] pl-3 text-xs leading-6 text-[var(--muted-text)]">{matches.slice(0, 3).map(({ label, value }) => `${label}: ${value}`).join(" · ")}</p> : null}
              {corrections.length ? <p className="mt-2 text-xs leading-6 text-[var(--muted-text)]">Near match: {corrections.map(({ from, to }) => `“${from}” → “${to}”`).join("; ")}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center">
          <h2 className="display-serif text-4xl">No works found.</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted-text)]">Try fewer words, another color, or remove a filter. Every search word must match the catalog; the current collection contains only {artworks.length} works.</p>
          <button type="button" onClick={() => apply({ query: "", filters: { ...EMPTY_SEARCH_FILTERS } })} className="focus-ring mt-6 min-h-11 border-b border-[var(--primary-ink)] text-xs uppercase tracking-[0.14em]">Explore all works</button>
        </div>
      )}
      <p className="mt-14 border-t border-[var(--hairline)] pt-5 text-xs leading-6 text-[var(--muted-text)]">Search uses catalog text and descriptive tags, with limited spelling tolerance. It does not analyze images or use an AI model.</p>
    </div>
  );
}
