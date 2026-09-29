"use client";

import { useEffect, useRef, useState } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { getAuthSnapshot } from "@/lib/auth/session";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import { EMPTY_SEARCH_FILTERS, MAX_SEARCH_LENGTH, searchStateToParams, type SearchFacets, type SearchFilters, type SearchPageResponse, type SearchState } from "@/lib/search/state";

const suggestions = ["Van Gogh", "landscape", "flowers", "Hokusai"];

type FailedRequest = { state: SearchState; cursor: string | null; message: string };

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

export function ArtworkSearch({ initialPage, facets }: { initialPage: SearchPageResponse; facets: SearchFacets }) {
  const [state, setState] = useState(initialPage.state);
  const [draft, setDraft] = useState(initialPage.state.query);
  const [page, setPage] = useState<SearchPageResponse | null>(initialPage);
  const [loading, setLoading] = useState<"search" | "more" | null>(null);
  const [error, setError] = useState<FailedRequest | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const activeFilterCount = Object.values(state.filters).filter(Boolean).length;
  const isSearching = Boolean(state.query || activeFilterCount);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function requestPage(nextState: SearchState, cursor: string | null = null) {
    const authRevision = getAuthSnapshot().revision;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(cursor ? "more" : "search");
    setError(null);
    if (!cursor) setPage(null);
    const params = searchStateToParams(nextState);
    if (cursor) params.set("cursor", cursor);
    let retryCursor = cursor;
    try {
      const response = await fetch(`/api/search?${params}`, { signal: controller.signal });
      if (response.status === 400) {
        retryCursor = null;
        throw new Error("The collection changed. Try again to refresh these results.");
      }
      if (!response.ok) throw new Error(cursor ? "More works could not be loaded. Your current results are still here." : "Search could not be loaded. Please try again.");
      const nextPage = await response.json() as SearchPageResponse;
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setState(nextPage.state);
      setPage((current) => {
        if (!cursor || !current) return nextPage;
        const known = new Set(current.results.map(({ artwork }) => artwork.id));
        return { ...nextPage, results: [...current.results, ...nextPage.results.filter(({ artwork }) => !known.has(artwork.id))] };
      });
      if (!cursor && getAuthSnapshot().revision === authRevision) recordAnalyticsEvent({ eventType: "search_query", source: "catalog_search", payload: { query: nextPage.state.query, ...nextPage.state.filters, resultCount: nextPage.total } });
    } catch (cause) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError({ state: nextState, cursor: retryCursor, message: cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Search could not be loaded. Please try again." });
    } finally {
      if (requestRef.current === controller) setLoading(null);
    }
  }

  function apply(nextState: SearchState) {
    const next = { ...nextState, query: nextState.query.trim().slice(0, MAX_SEARCH_LENGTH) };
    setState(next);
    setDraft(next.query);
    const params = searchStateToParams(next).toString();
    window.history.replaceState(null, "", params ? `/search?${params}` : "/search");
    void requestPage(next);
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
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted-text)]">An artist, a subject, a remembered form. Explore {initialPage.catalogTotal} museum works through their titles, descriptions, and catalog metadata.</p>
      </header>

      <form role="search" aria-label="Search artworks" className="mt-9" onSubmit={(event) => { event.preventDefault(); apply({ ...state, query: draft }); }}>
        <label htmlFor="artwork-query" className="sr-only">Search artworks, artists, or subjects</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="artwork-query" type="search" value={draft} maxLength={MAX_SEARCH_LENGTH} placeholder="Try ‘landscape’ or ‘Van Gogh’" onChange={(event) => setDraft(event.target.value)} className="focus-ring min-h-14 min-w-0 flex-1 border border-[var(--hairline)] bg-[var(--soft-white)] px-5 text-base" />
          <button type="submit" className="focus-ring min-h-12 bg-[var(--primary-ink)] px-8 text-xs uppercase tracking-[0.15em] text-[var(--soft-white)]">Search</button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1" aria-label="Suggested searches">
        <span className="text-xs text-[var(--muted-text)]">Start with</span>
        {suggestions.map((query) => <button key={query} type="button" onClick={() => apply({ query, filters: { ...EMPTY_SEARCH_FILTERS } })} className="focus-ring min-h-11 border-b border-transparent text-xs text-[var(--secondary-ink)] hover:border-[var(--primary-ink)]">{query}</button>)}
      </div>

      <fieldset className="mt-7 border-t border-[var(--hairline)] pt-6">
        <legend className="sr-only">Filter artworks</legend>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <FilterSelect label="Artists" value={state.filters.artist} options={facets.artists} onChange={(value) => updateFilter("artist", value)} />
          <FilterSelect label="Styles / categories" value={state.filters.movement} options={options(facets.movements)} onChange={(value) => updateFilter("movement", value)} />
          {facets.moods.length ? <FilterSelect label="Moods" value={state.filters.mood} options={options(facets.moods)} onChange={(value) => updateFilter("mood", value)} /> : null}
          {facets.palettes.length ? <FilterSelect label="Colors" value={state.filters.palette} options={options(facets.palettes)} onChange={(value) => updateFilter("palette", value)} /> : null}
          <FilterSelect label="Orientations" value={state.filters.orientation} options={options(facets.orientations)} onChange={(value) => updateFilter("orientation", value)} />
        </div>
      </fieldset>

      <div className="mt-8 flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--hairline)] pb-4">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-[var(--secondary-ink)]">{loading === "search" ? "Searching the collection…" : page ? <>{page.total} {page.total === 1 ? "work" : "works"}{state.query ? <> for <span className="font-medium">“{state.query}”</span></> : " in the collection"}{activeFilterCount ? ` · ${activeFilterCount} ${activeFilterCount === 1 ? "filter" : "filters"}` : ""}</> : "Search unavailable"}</p>
        {isSearching ? <button type="button" onClick={() => apply({ query: "", filters: { ...EMPTY_SEARCH_FILTERS } })} className="focus-ring min-h-11 text-xs underline underline-offset-4">Clear search and filters</button> : null}
      </div>

      {error ? <div role="alert" className="mt-6 border border-[var(--hairline)] p-5 text-sm leading-7"><p>{error.message}</p><button type="button" onClick={() => void requestPage(error.state, error.cursor)} className="focus-ring mt-2 min-h-11 underline underline-offset-4">Try again</button></div> : null}

      {page?.results.length ? (
        <div className="mt-8 grid items-start gap-x-7 gap-y-12 md:grid-cols-2 xl:grid-cols-3" aria-busy={loading === "more"}>
          {page.results.map(({ artwork, matches, corrections }, index) => (
            <div key={artwork.id} data-testid="search-result" onClickCapture={(event) => {
              if (!(event.target as HTMLElement).closest("a")) return;
              recordAnalyticsEvent({ eventType: "search_result_open", artwork, source: "catalog_search", position: index, payload: { query: state.query, ...state.filters } });
            }}>
              <ArtworkCard artwork={artwork} />
              {matches.length ? <p className="mt-4 border-l border-[var(--antique-gold)] pl-3 text-xs leading-6 text-[var(--muted-text)]">{matches.map(({ label, value }) => `${label}: ${value}`).join(" · ")}</p> : null}
              {corrections.length ? <p className="mt-2 text-xs leading-6 text-[var(--muted-text)]">Near match: {corrections.map(({ from, to }) => `“${from}” → “${to}”`).join("; ")}</p> : null}
            </div>
          ))}
        </div>
      ) : !loading && !error && page ? (
        <div className="mx-auto max-w-md py-20 text-center">
          <h2 className="display-serif text-4xl">No works found.</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted-text)]">Try fewer words, another subject, or remove a filter. Every search word must match the catalog metadata.</p>
          <button type="button" onClick={() => apply({ query: "", filters: { ...EMPTY_SEARCH_FILTERS } })} className="focus-ring mt-6 min-h-11 border-b border-[var(--primary-ink)] text-xs uppercase tracking-[0.14em]">Explore all works</button>
        </div>
      ) : null}
      {page && page.total > 0 ? <div className="mt-10 text-center"><p className="text-xs text-[var(--muted-text)]">Showing {page.results.length} of {page.total} works</p>{page.nextCursor && !error ? <button type="button" disabled={loading === "more"} onClick={() => void requestPage(state, page.nextCursor)} className="focus-ring mt-4 min-h-12 border border-[var(--primary-ink)] px-8 text-xs uppercase tracking-[0.14em] disabled:opacity-50">{loading === "more" ? "Loading…" : "Load more works"}</button> : null}</div> : null}
      <p className="mt-14 border-t border-[var(--hairline)] pt-5 text-xs leading-6 text-[var(--muted-text)]">Search uses museum catalog text and descriptive tags, with limited spelling tolerance. It does not analyze images or use an AI model.</p>
    </div>
  );
}
