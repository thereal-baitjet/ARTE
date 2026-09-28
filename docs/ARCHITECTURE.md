# Architecture

## Application and public catalog

Next.js App Router server components and route handlers own the versioned museum catalog. The public release catalog contains 1,000 works: 339 Met, 350 Cleveland, 299 NGA, and 12 curated MoMA records; combined source/manifest validation has passed. Public discovery, search, onboarding, attention, and related choices use `PUBLIC_ARTWORKS`, which interleaves museum contributions and excludes synthetic records and missing images. The first Met work and all published identities are preserved. The legacy combined lookup catalog preserves twelve synthetic IDs for saved references and explicitly labeled demo routes. A bundled catalog makes guest browsing reproducible without a remote database; museum APIs are used by offline import commands, not by website builds or browser navigation.

Artwork detail routes retain source-specific rights and museum attribution. The verified delivery split is 512 local images (Met 339, Cleveland 161, MoMA 12) and 488 official remote images (Cleveland 189, NGA 299), with aspect ratios preserved. NGA images are already bounded to 843 pixels and load directly from the official IIIF service, avoiding Next's seven-second upstream image-optimizer timeout; local and Cleveland images retain Next optimization. Original remote bytes were downloaded and decoded during import, but runtime availability depends on museum CDNs. Image failure handling must remain usable. MoMA object metadata is CC0 while its images are independently sourced from individually documented Commons public-domain reproductions; the UI keeps museum and image-source links separate. Museum classifications remain source categories. Missing palette, mood, or composition metadata is disclosed rather than described as an observed visual contrast.

## Bounded server/client interfaces

| Surface | Data sent to the browser |
| --- | --- |
| Discover and recommendation API | Four artworks by default, at most eight per page, with the scoring explanation needed by the feed |
| Search | Twelve artwork summaries by default, at most twenty-four per page; facets and a total count accompany the initial view |
| Onboarding | Twenty representative real-work summaries |
| Related works | At most four summaries per mode across five modes |
| Personal attention | At most twenty summaries and a total count |
| Art DNA | Six dimensions with at most three positive signals each, counts, and a headline |
| Collection choices and reference lookup | Twenty public choices per page; at most forty explicit IDs per lookup request; collection display pages contain twenty-four references |

Card summaries contain artwork identity, title, year, medium, visual data, and artist identity/name. They omit full biographies, descriptions, feature vectors, and rights records; the detail page supplies the full record. The complete catalog is not imported at runtime by client components.

Search is deterministic lexical/metadata retrieval with conservative spelling tolerance. Queries are capped at 160 characters. Its cursor is bound to the normalized search state, page size, and catalog identity list. Requests abort when superseded; a failed load preserves already displayed results and supports retry.

Recommendations accept at most 500 validated events, 1,000 hidden IDs, and 512 KiB of actual request bytes. The diversity scheduler calculates the largest two remaining artist-group sizes once per selection round, avoiding repeated scans for each candidate while preserving feasible artist spacing. A process-local cache holds at most twenty-four ranked results for sixty seconds, keyed by a hash of the derived profile and hidden IDs. It does not retain raw event bodies or establish an account session. Pagination uses a fixed interaction snapshot so a live hide cannot remove its cursor; newly hidden works are filtered immediately in the browser. Likes, saves, and follows surface persistence errors and guard stale account responses.

## Activity, privacy, and persistence

Guest history, preferences, saves, collections, follows, and inquiry drafts are stored on the current browser. Recommendations, Art DNA, and attention send a bounded copy of recent events to ARTE for calculation. Taste and attention responses are private and `no-store`; the endpoints set no account cookie and perform no analytics database writes. Recommendation responses are also `no-store`. This is server calculation from device-local history, not a promise that activity never leaves the device.

The shared activity parser validates each event and bounds actual streamed bytes, not only Content-Length. Explicit artwork lookup additionally caps its request at 12 KiB and forty IDs. Legacy synthetic works resolve only when an explicit saved ID asks for them; public choices do not list them. Resetting local history clears stale displayed taste/attention results even if a following API request fails. Pausing passive tracking does not disable intentional likes, saves, searches, or other explicit actions.

Signed-in interactions can be saved through Supabase. PostgreSQL RLS is the final ownership boundary; the browser has only a publishable key. Hosted history retrieval/merging is not implemented, so database writes alone do not establish cross-device personalization. The separate account-reset RPC checks the originally confirmed user ID against `auth.uid()` within the deletion transaction.

Administrative APIs verify the bearer token and administrator role and use the caller's RLS-scoped client. The admin interface operates on the database, while public browsing still uses the released bundle. Live database publication, cache invalidation, full source/artwork CRUD, and commercial inventory operations remain separate unfinished integrations. Marketplace values are demo data; inquiry drafts are not sent messages or purchases.

## Import and delivery

Each museum contributes source records, deterministic identities, provenance evidence, image hashes/dimensions, and matching seed SQL. The combined manifest records delivery mode as well as source-qualified identities; database expectations are generated from it. Local images remain in Git, while newly added remote museum bytes stay in ignored import caches. Browser builds do not run imports or fetch metadata APIs; remote imagery is fetched when the website is used.

The Met contribution stopped at 339 verified works after an explicit 403. Cleveland 350 uses a pinned official GitHub Open Access dataset after its API denial. An AIC image 403 led to a separate NGA 299 contribution, requiring per-image `openaccess=1` rather than assuming metadata CC0 covers images. MoMA 12 joins pinned official metadata to archived Commons file rights, identity evidence, and permanent revisions. Source denial never relaxes rights gates or justifies bypassing access controls.

GitHub Actions runs application validation and a separate local-Supabase migration, seed, RLS, Auth, and repeatability workflow. Vercel uses `npm ci` and a production Next.js build. `/api/health` returns status, app name, catalog type/count, and a backend-configured boolean; it exposes no credentials. Passing local checks, a GitHub deployment status, and an actual production smoke test are distinct evidence. Current results and unresolved gates belong in [GAUNTLET](GAUNTLET.md).
