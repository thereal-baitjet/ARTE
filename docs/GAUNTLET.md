# ARTE Gauntlet Report

This is the evidence log for the ARTE release-gate process. Historical passing gates below apply to their recorded commits. The latest [1,000-work expansion](#1000-work-four-source-expansion--current-gate) records the current scope and pending evidence. Earlier release continuations are historical snapshots; the full gauntlet is not complete.

## Status legend

- **PASS** — all gate requirements have command or browser evidence.
- **PASS WITH EXTERNAL BLOCKER** — implementation is complete and only an external account, credential, agreement, or domain action remains.
- **PARTIAL** — a bounded implementation is working, but product requirements still need code or integration work.
- **NOT VERIFIED** — required command, database, hosted, or deployment evidence has not been obtained.
- **FAIL** — one or more gate requirements remain unverified or broken.

---

## Phase 0 — Repository Reconnaissance

### Work completed

- Inspected repository `thereal-baitjet/ARTE`, default branch `main`.
- Inspected initial commit `0c31396974c23362d554583dc8c0a7b2b90fd9be`.
- Baseline files were only `.gitignore`, `LICENSE`, and `README.md`.
- No application source, package manifest, routes, tests, migrations, CI, or deployment configuration existed.
- No working application behavior existed to preserve or regress.
- Selected a reversible modular architecture: Next.js App Router, React, TypeScript, Tailwind CSS, Supabase PostgreSQL/pgvector, Playwright, and GitHub Actions.

### Commands and evidence

- Repository metadata and tree inspected through the connected GitHub integration.
- `node --version` → `v22.16.0`.
- `npm --version` → `10.9.2`.
- Local `git clone` failed because that sandbox session could not resolve `github.com`; no success was claimed from it.

### Highest-risk gaps identified

1. No executable application.
2. No validation or browser-verification target.
3. No database, authentication, authorization, or rights model.
4. No deterministic seed or ingestion boundary.
5. No deployment evidence.
6. Framework security updates must be checked again before production release.

### Gate

- Existing functionality understood: **PASS**
- Build status known: **PASS** — no build system existed at baseline.
- No destructive assumptions: **PASS**

**Final gate status: PASS**

---

## Phase 1 — Foundation and Design System

### Work completed

- Bootstrapped Next.js App Router with React, TypeScript, Tailwind CSS, ESLint, and Playwright.
- Added gallery palette, typography, focus states, reduced-motion behavior, responsive desktop navigation, and mobile navigation.
- Added loading, error, empty, and not-found primitives.
- Added the landing page and truthful placeholder routes for later phases.

### Commands and evidence

GitHub Actions run `36348443394`, commit `ce39c36d42db820863aeb0a8a2387b0f91e655ff`:

- `npm install` — PASS
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run build` — PASS
- `npx playwright install --with-deps chromium` — PASS
- `npm run test:e2e` — PASS

### Browser verification

Playwright verified the landing shell at 375 × 812, 768 × 1024, 1440 × 900, and 1920 × 1080. It asserted visible primary content and an empty console/page-error collection.

- Artifact: `playwright-report`
- Artifact ID: `10941257687`

### Gate

- Lint passes: **PASS**
- Type check passes: **PASS**
- Production build passes: **PASS**
- Responsive shell visually verified: **PASS**
- No console errors: **PASS**

**Final gate status: PASS**

---

## Phase 2 — Database, Auth, and Rights

### Work completed

- Added Supabase local configuration and pgvector-enabled PostgreSQL migrations.
- Added profiles, artists, artworks, images, source records, embeddings, movements, listings, likes, saves, follows, impressions, typed events, feed sessions, collections, recommendation profiles/events, synchronization runs, inquiries, and admin audit logs.
- Added database constraints that block publication when image rights are unclear or restricted.
- Added row-level security for ownership, public artwork visibility, listing freshness, and admin access.
- Added profile provisioning from `auth.users`.
- Added magic-link authentication UI with a safe unconfigured-environment state.
- Added artwork-rights presentation and application-side rights validation.
- Added deterministic synthetic seed data and pgTAP/Auth integration tests.

### Commands and evidence

Application run `36349274744`, commit `10437ecb4f9786e211a384fc90caa7fecf56fa64`:

- Lint, type check, unit tests, build, Playwright installation, and browser tests — PASS.

Database/Auth run `36349274803`, same commit:

- Start local Supabase stack — PASS
- Apply migrations and seed — PASS
- `supabase test db` — PASS
- Local Auth integration — PASS
- Re-apply migrations and seed — PASS
- Re-run database tests — PASS
- Stop local stack — PASS

### Bugs discovered and repaired

- Corrected SQL helper-function quoting and pgTAP plan count.
- Prevented recursive profile-policy lookup through a security-definer role helper.
- Started the complete local Supabase stack so Auth integration could run.

### External blockers

- Hosted Supabase credentials remain an external deployment action. Local migration, Auth, RLS, and repeatability behavior is verified.

### Gate

- Migrations apply cleanly: **PASS**
- Seed is repeatable: **PASS**
- Authentication works: **PASS**
- Unauthorized access is blocked: **PASS**
- Every seeded artwork has source and rights state: **PASS**

**Final gate status: PASS**

---

## Phase 3 — Core Feed Vertical Slice

### Work completed

- Added a full-height artwork-first discover feed with deterministic synthetic demo work.
- Added cursor pagination, duplicate suppression, safe invalid-cursor responses, artwork/artist routes, related works, attribution, and a synthetic-source disclosure.
- Added guest local persistence and authenticated Supabase persistence for likes and saves with optimistic rollback.
- Added feed-position restoration, keyboard controls, hide/not-for-me behavior, and a missing-image rights fallback.

### Attack findings and repairs

Initial run `36349835881` failed lint and correctly blocked the gate. Repairs addressed an unsafe text character, synchronous effect state update, non-Next internal navigation, and an anonymous PostCSS export warning.

### Commands and evidence

Passing run `36349923375`, commit `f0936ac0577d2f614fd5194e127cbfbe739cbf93`:

- Install, lint, type check, unit tests, build, Playwright installation, and end-to-end tests — PASS.

### Browser verification

Playwright verified mobile and desktop feed rendering, unique pagination, like/save reload persistence, artwork and artist routing, scroll restoration, missing imagery, invalid cursor recovery, and arrow-key navigation.

- Artifact ID: `10941534263`
- Digest: `sha256:47894a35d8a325eb915e45d26f1e4f07a592466eebb8da6f55605061cf83f801`

### Gate

- Core journey: **PASS**
- Like/save persistence: **PASS**
- No unexpected duplicates: **PASS**
- Mobile and desktop checks: **PASS**
- No broken-image crash: **PASS**

**Final gate status: PASS**

---

## Phase 4 — Personalization

### Work completed

- Added the complete typed event vocabulary required by the product specification.
- Added configurable interaction weights, dwell interpretation, deterministic taste-profile construction, and explainable ranking components.
- Added the conceptual ranking formula as configuration rather than scattered constants.
- Added feasibility-aware diversity scheduling across artists, movements, and media.
- Added stable seeded discovery behavior, seen-item penalties, and hidden-item suppression.
- Added a recommendation API that accepts bounded typed history and returns cursor-paginated recommendations.
- Added guest event persistence plus optional Supabase event persistence.
- Connected likes, saves, hides, shares, detail opens, artist opens, More Like This, impressions, visibility, dwell, and explanation opens to typed events.
- Added dynamic Why This? explanations that expose the scoring signals they actually use.
- Added More Like This modes for visual connection, mood, movement, palette, and unexpected connection.
- Expanded the development catalog to 12 rights-safe works and synchronized UUIDs, artists, movements, tags, and source records with the Supabase seed.

### Attack findings and repairs

Recommendation-core runs `36350325499` and `36350444604` failed the adjacent-artist diversity regression test. The initial greedy fallback could strand one artist at the end of the ranking. It was replaced with a feasibility-aware scheduler that considers remaining artist counts before selecting each candidate.

Core run `36350572007`, commit `3a792e871b8f8b43bfad946b5c3798f7b4558ce1`, then passed deterministic ranking, adaptation, diversity, hidden-work suppression, explanation-signal, similarity-mode, build, and browser regression checks.

Final browser run `36351059905` found two persistence-test failures. The test harness had registered an initialization script that cleared `localStorage` on every navigation and reload, erasing the exact preference and hide history being verified. The harness was corrected to clear storage once per test before entering the product. No production logic was weakened to satisfy the tests.

### Commands and evidence

Final application validation — run `36351205136`, commit `27d0a8e1ff4b93e6fc753fb88ffd102cb0bb592b`:

- `npm install` — PASS
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run build` — PASS
- `npx playwright install --with-deps chromium` — PASS
- `npm run test:e2e` — PASS

Database/catalog validation — run `36351059908`, commit `62550cafd68978528fbfce95b58026518498a317`:

- Start local Supabase stack — PASS
- Apply migrations and 12-work seed — PASS
- pgTAP schema, rights, source, movement, and RLS tests — PASS
- Local Auth integration — PASS
- Re-apply migrations and seed — PASS
- Re-run database tests — PASS
- Stop local stack — PASS

### Browser verification

The final Playwright suite verified:

- Explicit likes and saves alter the next personalized refresh.
- Hidden works do not immediately return.
- Why This? UI signal chips correspond to the engine’s actual explanation signals.
- Similar Palette and Unexpected Connection modes disclose their computed relationship.
- Personalized pagination remains duplicate-free.
- Existing mobile/desktop, persistence, routing, keyboard, missing-image, and console-error regressions remain passing.

Browser report:

- Artifact ID: `10942008614`
- Digest: `sha256:2cd98fdba91b4c94c858ac6a8603dd128276c6f4ed9d15e2a8492fcbbb365bfd`

### External blockers

- Historical evidence above verifies guest adaptation and the then-current local Supabase persistence/security path. Cross-device history hydration is not implemented; adding credentials alone does not complete hosted personalization. The new release migration and expanded seed also require their own database run, described in the continuation below.

### Gate

- Behavior influences recommendations: **PASS**
- Rankings are deterministic in tests: **PASS**
- Diversity thresholds pass: **PASS**
- Hidden works do not immediately return: **PASS**
- Explanations correspond to actual scoring signals: **PASS**

**Final gate status: PASS**

---

## Phase 5 — Search, Collections, and Art DNA

**Status: Guest application workflows verified; hosted and full-product acceptance remain pending.**

Deliverables implemented in the release continuation below:

- Structured and descriptive search
- Search filters and typo tolerance
- Private-by-default collections with guest and authenticated persistence
- Art DNA estimates derived from actual event history
- Shareable taste card
- Analytics/privacy controls and personalization reset


---

## Release continuation — September 27, 2026 (historical 90-record snapshot)

### Current outcome and scope

The local guest application has passed its application validation suite and a follow-up visual/accessibility regression after a contrast fix. It includes a real public-domain artwork catalog, discovery, search, private collections, onboarding, Art DNA, local activity controls, demo market flows, local attention views, and a fail-closed administration boundary.

This is not a completed commercial-product gauntlet or a verified Vercel deployment. Hosted database/authentication verification, cross-device personalization, a live database-backed public catalog, complete administration/ingestion, and commercial marketplace operations remain open. Some require implementation work, not only credentials.

### Catalog and feature completion

- Expanded the bundled catalog to **90 artworks: 78 Met Open Access records and 12 synthetic fixtures**. The app exposes **37 artist pages** and **21 displayed movement/category labels**. Museum classifications are presented as source categories, not invented art-historical movements. Attribution-qualified artist identities remain distinct; these figures are not a claim of 37 distinct real artists.
- Archived per-record public-domain evidence, original museum source links and metadata, optimized local images, and matching deterministic database seed identities. Rights/source checks and a browser test verify a genuine museum artwork, decoded local image, visible attribution, and source link. See `CATALOG.md`.
- Implemented structured/descriptive search, bounded typo tolerance, intersecting filters, URL state, and recoverable empty results.
- Implemented guest saves and private named collections with create/add/rename/remove/delete/reload behavior. Independent saves survive collection deletion. Authenticated persistence code exists; the current hosted flow is not a passing gate without real backend verification.
- Implemented optional onboarding with at least five selected works from twenty displayable candidates. Only committed selections add likes. Existing likes are not counted twice when onboarding repeats.
- Implemented Art DNA from actual weighted local events, relative affinity explanations, a shareable text summary, passive tracking pause/resume, hidden-work restoration, and explicit local resets that preserve saved works/collections. Guest analytics stay on the device. Pausing passive tracking does not disable intentional likes, saves, searches, and other explicit actions.
- Added a signed-in account activity reset with a separate confirmation. Its RPC accepts the originally confirmed user ID and checks it against `auth.uid()` inside the transaction. UI identity/epoch checks prevent a completed request for a previous account from clearing a newly selected account's local history. This code and its SQL tests are present; current hosted/SQL execution remains unverified.
- Added artist following and attention views derived from actual local activity. Empty history remains honestly empty; no invented global popularity is displayed. Cross-device history hydration and a global, abuse-resistant attention aggregate are not implemented.
- Added an explicitly demo-only market with currency/budget/availability filters, stale/expired inventory exclusions, a truthful verified-only empty state, and local inquiry drafts that can be reopened or deleted. A draft is not a sent inquiry or a purchase.
- Added an offline, pluggable embedding contract and deterministic metadata-hash fallback. All vectors have 512 dimensions. Generate/update/rebuild commands write versioned JSON with input hashes; they do not inspect images, call paid models, alter live recommendations, or write to the database. A 90-record generation, unchanged 90-record reuse, and 90-record rebuild were exercised. See `EMBEDDINGS.md`.
- Added locked admin views, authenticated role checks, narrow allowed mutations, bounded input, audit protections, and a repeatable internal synthetic-source adapter. Public browsing still uses the bundled catalog, so database archive/listing changes do not yet change the public catalog. Full artwork/source/artist CRUD, external-source administration, publication integration, and complete health operations remain unfinished. See `INGESTION.md`.

### Attack findings and repairs

- Repaired hiding the pagination cursor without losing the remainder of the gallery; subsequent pages keep a consistent ranking snapshot and suppress hidden records.
- Hardened analytics payload validation and recommendation API bounds; unknown artist IDs cannot inject profile keys. Impressions mark works as seen without inventing positive affinity.
- Hardened like/save/follow/account-state handling against storage failures, stale asynchronous responses, and account switches. Failed writes report failure and permit retry rather than claiming persistence.
- Corrected feed visibility/dwell measurement when an artwork article is taller than a small viewport.
- Added owner-only account-history reset policies and the expected-user-ID RPC check. Removed the unsafe zero-argument reset overload and disabled anonymous hosted analytics insertion.
- Strengthened rights/publication and fresh-listing constraints, inquiry limits, privileged mutation validation, and transactional audit behavior. These SQL changes still await database execution evidence.
- Corrected browser tests that assumed the original small catalog's first artwork would always appear on the initial page after expansion. Tests now act on the actual first displayed work or navigate directly when testing a specific fixture; production ranking was not weakened.
- An earlier validation attempt included generated Playwright report JavaScript in lint. Generated report files were excluded from source linting, then the full command sequence was rerun successfully.
- **Visual inspection after the full browser run found a real defect that the earlier assertions had missed:** an unlayered global anchor color rule overrode the landing CTA's light text, making its label effectively invisible on the dark button. The anchor defaults were moved into Tailwind's base layer. A computed foreground/background contrast assertion now requires at least 4.5:1 for the primary CTA. Fresh screenshots at all four viewports were visually reviewed after the repair.

### Command and browser evidence

The consolidated local application run is recorded in `/tmp/arte-final-validation.log`. These are local execution results, not new GitHub Actions run IDs:

| Command/check | Observed result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 43 tests total: 5 JavaScript tests and 38 TypeScript tests |
| `npm run build` | PASS — production build, 149 generated static pages |
| `npm run test:e2e -- --workers=2` | PASS — 48 Chromium tests, zero retries used, 56.6 seconds |

After the global-anchor contrast fix, the follow-up run in `/tmp/arte-contrast-validation.log` verified the changed surface:

| Command/check | Observed result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run build` | PASS — production TypeScript check and 149 generated static pages |
| `npm run test:e2e -- tests/e2e/foundation.spec.ts tests/e2e/release.spec.ts --workers=2` | PASS — 10 tests, zero retries used, 30.1 seconds |
| Screenshot review | All four landing viewport captures reviewed after the contrast repair |

The full 48-test run preceded the final CSS repair; the 10-test targeted run is the post-repair browser evidence. It is not a claim that all 48 tests were rerun after that CSS-only change.

Browser dimensions: **375×812**, **768×1024**, **1440×900**, and **1920×1080**. The release suite checks `/`, `/search`, `/collections`, `/profile/taste`, `/market`, and `/trending` at each size for visible primary content, horizontal overflow, console/page errors, and Axe WCAG 2 A/AA and WCAG 2.1 A/AA violations. Those checks passed. Foundation checks additionally verify the primary CTA contrast and route reachability. The broader suite covers discovery, pagination, artist/artwork routes, save/reload, private collection CRUD, onboarding, Art DNA sharing/privacy, inquiry-draft persistence, invalid API input, listing expiry, guest admin denial, and a real museum image.

Automated Axe results are scoped to those rendered routes and states; they are not a claim of exhaustive accessibility certification. The local browser used the configured Chromium executable override after the standard browser download failed; passing tests ran against a real Chromium process and a production `next start` server.

### New database release gate — NOT VERIFIED

`20260927220000_release_security.sql`, the expanded 90-work seed, and the updated database tests are included in the release changes for CI execution. The test plans total **49 pgTAP assertions: 17 foundation assertions plus 32 release assertions**. The workflow also starts Supabase, applies migrations/seed, runs local Auth integration, resets again, and reruns database tests to establish repeatability.

The current revision of that workflow has **not yet supplied passing execution evidence**. Historical database passes above do not validate the new migration, the expanded seed, or the new reset/anonymous-write/rights/listing/audit controls. Do not mark this gate PASS until the current workflow succeeds and its run/commit are recorded. Real hosted credentials and hosted account isolation remain separately unverified.

### Phase and release status

| Area | Current status | What still blocks the full gate |
| --- | --- | --- |
| Guest discovery, search, collections, onboarding and Art DNA | PASS for the tested local guest scope | Hosted persistence and account-reset flows need current backend evidence |
| Demo market and local attention | PASS for the explicitly labeled demo/local scope | Real inventory agreements, inquiry delivery, global attention and abuse controls require further work |
| Embedding pipeline | PASS for offline deterministic metadata generation/update/rebuild | Image/semantic embeddings and live ranking integration are not implemented or claimed |
| New database migration/seed/security gate | NOT VERIFIED | Current 49-assertion pgTAP/Auth/repeatability CI run pending |
| Phase 7 — Administration and ingestion | PARTIAL | Static public catalog remains disconnected from DB publication; external-source workflows and full CRUD remain incomplete |
| Cross-device personalization | PARTIAL / NOT IMPLEMENTED | Hosted-history retrieval, hydration, merging and device/account behavior need implementation and verification; keys alone are insufficient |
| Vercel production deployment | BLOCKED / NOT VERIFIED | Authorized deployment and READY-state production smoke tests have not completed |

### Vercel access and latest deployment direction

The connected deployment endpoint was unavailable (`Tool deploy_to_vercel not found`). Reading ARTE in the intended Vercel team returned **HTTP 403** with re-authentication required. The interactive sign-in attempt did not complete after a passkey authentication failure. No verified production URL or READY deployment resulted from these attempts.

The user's latest direction is to use the **Vercel CLI** instead of continuing the blocked browser authentication path. `docs/DEPLOYMENT.md` documents the CLI route. The release still needs an authorized CLI session, deployment of the intended repository revision, a recorded READY deployment URL/commit, and smoke checks on that actual URL. Local build/browser success is not deployment evidence.

**Historical conclusion at preparation time: tested local guest release candidate; full gauntlet, new database gate, and Vercel smoke verification remained open. Later CI/deployment observations are recorded below.**

### Prepared delivery

The final guest release includes a local CLI helper (`npm run deploy:vercel`), Vercel build configuration, and screenshot evidence in `screenshots/`. Following an initial approval block, the user explicitly authorized committing and publishing the release to GitHub on September 27, 2026. The release incorporates newer main commits for Supabase setup and Vercel configuration; neither is discarded. A source ZIP was also provided for local CLI deployment. GitHub publication is separate from successful deployment and hosted database verification.


---

## 500-work expansion — intermediate checkpoint

**Historical intermediate status: 500-work source validation completed; 79 unit tests and the 771-page production build passed. Its browser run ended with 55 passes and four failures, so this was not a complete browser/release gate. The 1,000-work release supersedes it below.**

### Intended catalog and source evidence

The completed public catalog contains **500 real public-domain artworks: 339 from The Metropolitan Museum of Art and 161 from the Cleveland Museum of Art**, plus twelve separate legacy synthetic fixtures. The complete source-qualified manifest is the release authority; a target or source-local build is not a passing combined-catalog gate.

The Met source contribution has been generated with 339 image-ready records, 65 attribution-qualified artist identities, 26 categories, and 16,985,218 WebP bytes. All 339 optimized hashes are unique. The original 78 artwork identities, slugs, and image bytes remain unchanged. The pipeline obtained 340 cleared metadata records; one new image (object 198608) returned 404. Later Met requests returned an Incapsula 403 denial, including for a known earlier object, so bulk requests stopped. No challenge was bypassed. See [MET-IMPORT](MET-IMPORT.md) for staged publication/recovery and importer evidence.

The remaining 161 works use Cleveland as a separate source. Its API also returned 403. The source integration uses the museum's officially published GitHub Open Access dataset instead, with pinned dataset provenance and explicit CC0/image gates. That contribution is now generated: 161 CC0 paintings, 161 source-attributed artist identities, and 13,197,442 WebP bytes. The dataset is pinned to museum repository commit `4684c48c7c07b1452db7963adf4aad8052055b7d` and its 343,572,124-byte LFS payload hash `e8b29e67f3df840bca6cd1ffd37ca5d187b913af2ab2edf6ddb8cf164cd4359f`. Combined-manifest generation and `--check` validation passed against actual source records and images; source-qualified SQL expectation generation and its `--check` also passed. The final manifest records 226 source-qualified artist identities and 26 categories, not necessarily 226 distinct individuals. Importer availability is not permission to omit verification or fill the target with synthetic records.

### Application changes and review findings

- Public discovery, search, onboarding, attention, related recommendations, and collection choices exclude synthetic works. Explicit lookup preserves old saved demo IDs, while the demo marketplace remains labeled and unsent.
- Public catalog computation moved to server boundaries. Search returns twelve summaries by default (maximum twenty-four); onboarding sends twenty choices; related results send at most four cards for each of five modes; attention returns twenty cards; collection choices return twenty and explicit lookups accept forty IDs. Taste returns a small summary rather than the catalog.
- Recommendation/taste/attention inputs cap recent events at 500 and actual bytes at 512 KiB. The shared hidden-ID bound is 1,000. At this checkpoint the public catalog had 500 works plus separately retained legacy references. A regression now hides 101 actual works, preserves a remaining like signal, and verifies duplicate-free pagination without hidden IDs returning.
- Guest history remains device-local persistence, but a bounded copy is sent to ARTE for server calculation. The calculation handlers do not persist guest activity, and their responses are `no-store`. Privacy copy states this distinction. Signed-in account writes and cross-device hydration remain separate capabilities.
- Review found stale Art DNA/attention could survive a reset when the new API failed. These views now clear old results when refreshing/resetting; a regression covers reset with an unavailable calculation endpoint.
- Review found missing palette/mood/composition was described as an observed visual contrast. Similarity fallback copy and scoring now disclose missing metadata and use only available catalog/format evidence.
- Museum labels, source records, image paths, and database parity checks must be source-specific for the Cleveland addition. Numeric museum object IDs are qualified by their source rather than assumed globally unique.
- The home hero is now an actual museum work. The obsolete placeholder-text assertion was removed. Four viewport browser checks now decode the hero image, check attribution, follow its artwork link, and verify CC0/source disclosure. Health assertions require the real catalog count to be an integer at least 500.

### Earlier exact-revision evidence

These are completed results for earlier revisions, not for the current 500-work changes:

| Revision | Evidence | Observed result |
| --- | --- | --- |
| `a06a1a039e93bc44a403d3cb68ce80bdf2bee0c9` | [Application CI 36354619386](https://github.com/thereal-baitjet/ARTE/actions/runs/36354619386) | PASS, including lint, types, units, production build, and Chromium suite |
| `a06a1a039e93bc44a403d3cb68ce80bdf2bee0c9` | [Database CI 36354619411](https://github.com/thereal-baitjet/ARTE/actions/runs/36354619411) | FAIL; the expanded museum seed omitted the required museum slug; correction awaits current workflow evidence |
| `403a2ee9bdb793adbaa2f9ded1d1b683b760da9f` | [Application CI 36355470554](https://github.com/thereal-baitjet/ARTE/actions/runs/36355470554) | PASS for removing synthetic works from the earlier Discover gallery; database workflow was not triggered by that change |
| Earlier published release | GitHub Vercel commit status | Success was observed; this is deployment-status evidence only |
| `403a2ee9bdb793adbaa2f9ded1d1b683b760da9f` | Unique deployment URL `/api/health` request | Redirected to Vercel login; returned HTML, not application health JSON |

The protected unique deployment was `https://arte-5p6vimxwu-thereal-baitjets-projects.vercel.app`. Production-project and branch aliases were also observed redirecting to login. No authenticated Vercel access was available, so these observations do not constitute a public production smoke pass.

### Gallery scrolling

The gallery starts with four works and appends two at a time within 150 pixels of the end. Automatic loading requires further forward scrolling, a 1.2-second cooldown, and leaving the end zone between batches. A manual load/retry button remains available. Disabling scroll anchoring on the root scroller only while the gallery is mounted preserves the reading position; the previous style is restored on navigation. The browser regression verifies position preservation, a second legitimate batch, no repeated loading while the marker remains visible, keyboard loading, and explicit error retry. NGA's verified 843-pixel images use direct delivery to avoid the optimizer's upstream timeout.

### Current validation ledger

| Gate | Current evidence |
| --- | --- |
| Focused implementation checks | Scoped lint/type checks and targeted importer/activity/related unit tests have passed during development; these do not validate the final combined revision |
| Root preflight lint and typecheck | PASS before Cleveland source integration; rerun on the final source required |
| Combined 500-work source/manifest/image validation | PASS — generation and `--check` against both source archives, catalog records, and actual image bytes/dimensions; SQL expectations also generated and checked, without executing PostgreSQL |
| Intermediate application validation | Lint/types passed; 79 unit tests passed (21 JavaScript and 58 TypeScript); production build passed with 771 generated pages. These results preceded the final 1,000-work integration. |
| Balanced asset visual sample | PASS — forty actual images (twenty per museum), all decoded at expected dimensions and visually inspected; historical contact sheet (superseded by the current four-source JPEG), 1600×4993, 4,079,770 bytes, SHA-256 `b433ac763bdacc623318360d266bf4acb623c6798e29c28962eb2ab97e158686` |
| Intermediate browser suite | 55 passed and 4 failed assertions. Follow-up fixes address catalog-order assumptions in core/related tests and the search announcer. A full passing rerun remains required. The asset contact sheet is not production-page verification. |
| Current database pgTAP, Auth, seed and reset/reapply workflow | PENDING |
| Exact pushed SHA and current application/database CI | PENDING |
| Current Vercel deployment status and public production smoke | PENDING; earlier protected URLs do not satisfy this gate |

The source integration also updates generated SQL expectations and the database workflow so the manifest, seed, museum attribution, and local image paths agree. Their presence is not proof that PostgreSQL executed them successfully. Hosted account isolation remains a separate deployment-specific check.

The full-product limitations remain: no complete cross-device history hydration, no live database-backed public publication, incomplete administration/external-source workflows, demo commercial inventory and unsent inquiries, and no platform-wide attention aggregate. Closing the catalog expansion must not mark those implementation gaps complete.


---

## 1000-work four-source expansion — current gate

**Status: all four source contributions and the exact 1,000-work combined-manifest gate have passed source validation. Consolidated application/browser tests now pass. Database execution, exact-SHA CI, and production smoke remain pending at this pre-push checkpoint.**

### Scope and source evidence

The combined release manifest contains exactly 1,000 real image-backed works: 339 Met, 350 Cleveland, 299 National Gallery of Art, and 12 MoMA. Twelve legacy synthetic fixtures remain outside public choices, producing 1,012 total seed records. The verified delivery split is 512 checked-in local images and 488 official museum-CDN images. No metadata-only record counts as an image-ready artwork.

- **Met 339:** existing verified contribution retained; original 78 identity/slug/image bytes preserved. Earlier Met 403 denial stopped further collection. This is a four-source expansion, not a claim of 1,000 Met works.
- **Cleveland 350:** generated with pinned official GitHub dataset provenance and explicit CC0 status. The original 161 local works remain unchanged; 189 additions use official CDN URLs, with original bytes decoded/hashed and normalized image evidence archived. Selection adds media diversity across 45 classifications and has 334 source-qualified artist identities.
- **NGA 299:** final artifacts generated; 299 works, 291 source-qualified artist identities, and 10 classifications. All primary JPEGs decoded and source/normalized hashes were recorded, with cross-source duplicate checks including MoMA. Fourteen source-focused unit tests passed. Import joins a pinned official CSV snapshot to primary images with `openaccess=1`, independently of metadata CC0. Accessioned/nonvirtual records and verified bounded official IIIF JPEGs are required. AIC's image 403 led to this legitimate separate source rather than retries around the denial.
- **MoMA 12:** generated and visually reviewed. The museum's pinned CC0 metadata is joined to independently checked Commons public-domain reproductions. The archive preserves permanent file revisions, complete API metadata, original hashes, attribution/credit, expired-copyright/faithful-reproduction evidence, and explicit identity matches. Missing license/attribution API fields remain null. Twelve actual images across six artists decoded correctly; local derivatives total 3,878,732 bytes. Three focused validator tests passed, covering all records and eight hostile/missing-evidence scenarios. Scoped ESLint passed.

See [CATALOG](CATALOG.md) for source hashes, precise rights, import commands, and the external-image dependency. Public data is interleaved across sources; image-source links and museum-record links are distinct when their provenance differs.

### Ranking optimization and limits of the measurement

The diversity scheduler now calculates the largest two remaining artist-group sizes once per selection round, rather than rescanning all groups for each candidate. Output parity was verified on two histories after the optimization. An informal development comparison informed the change, but no reproducible benchmark artifact is retained here; numerical speedups and production/user-latency claims are therefore omitted.

The existing bounds remain: 500 recent events, 1,000 hidden IDs, 512 KiB of actual activity-request bytes, small paginated card summaries, and private/no-store calculation responses. Raw guest event bodies are not persisted by these calculation APIs. More catalog records do not imply that the browser receives the whole catalog.

### Gallery scrolling

The gallery starts with four works and appends two at a time within 150 pixels of the end. Automatic loading requires further forward scrolling, a 1.2-second cooldown, and leaving the end zone between batches. A manual load/retry button remains available. Disabling scroll anchoring on the root scroller only while the gallery is mounted preserves the reading position; the previous style is restored on navigation. The browser regression verifies position preservation, a second legitimate batch, no repeated loading while the marker remains visible, keyboard loading, and explicit error retry. NGA's verified 843-pixel images use direct delivery to avoid the optimizer's upstream timeout.

### Current validation ledger

| Gate | Current evidence |
| --- | --- |
| Met 339 and Cleveland 350 source artifacts | PASS — generated and included in the passing combined source validation |
| NGA 299 final source artifacts | PASS — 299 generated records, per-image Open Access/identity checks, decoded official JPEGs, 14 focused tests |
| MoMA 12 independent image-rights/identity validation | PASS — 12 generated/decoded images, three focused tests, scoped lint, original/derivative hashes verified |
| Combined 1,000-work manifest and generated SQL expectations | PASS — 339/350/299/12 sources; 512 actual local WebP files and 488 archived remote JPEG proofs; manifest and generated SQL `--check` pass; 10 validator/generator unit cases and scoped lint pass. PostgreSQL execution is not implied. |
| Four-source visual asset sample | PASS — 48 actual images, 12 per source including all MoMA selections; hashes and decoded dimensions verified, zero page/request errors, three sixteen-image sheets visually reviewed. [JPEG](screenshots/catalog-1000-contactsheet.jpg): 1600×5455, 1,387,479 bytes, SHA-256 `3303ede95f6e845d713011fc112fb720ad64c4599b43a37dbb75740158cc9a51`. Remote panels use verified cached bytes, not live CDN checks. |
| Current 1,000-work lint/type/unit checkpoint | PASS — lint, typecheck, 87 total unit tests (27 JavaScript and 60 TypeScript); combined manifest/SQL `--check` also passes. Final lint/type checks also pass after the feed and image-delivery fixes. |
| Current 1,000-work production build | PASS — production build generated 1,743 pages. Full browser verification and any affected checks after further changes remain separate. |
| Full current browser suite | PASS — 65 Chromium tests with no retries or failures (2.3 minutes), including four viewport layouts, accessibility checks, all four museum image/source links, bounded pagination, guest persistence, and the scroll regression. This runtime used its explicitly configured network proxy and pinned proxy CA key for live remote image requests; CI defaults are unchanged. |
| Current database pgTAP, Auth, complete seed and reset/reapply | First hosted run applied the complete seed and passed 54/55 assertions; one older foundation assertion incorrectly required CC0 for all sources. It now checks each museum's actual image license; the generated per-record catalog assertions already passed. Auth and reset/reapply await the rerun. |
| Exact pushed SHA and matching application/database CI | Application CI passed on `a4bcef39af749131e41c2b493e30a14807370aec` ([run](https://github.com/thereal-baitjet/ARTE/actions/runs/36361920501)); the follow-up corrects the source-specific foundation license assertion and homepage source copy. Final checks are pending at this checkpoint. |
| Current Vercel status and actual public production smoke | Vercel reported deployment complete for `a4bcef39af749131e41c2b493e30a14807370aec`; the follow-up deployment and public smoke remain separate gates. Redirects to Vercel login do not satisfy smoke verification. |

New remote images remain external runtime dependencies despite import-time successful decoding. A cached-image contact sheet proves the reviewed bytes displayed correctly; it does not prove the current production browser can reach the source CDNs. Git publication must include generated source metadata/catalogs, manifests, seed sections, and local assets; ignored import caches and generated browser reports must not be published.

The full-product limitations are unchanged: no complete cross-device history hydration, no live database-backed public publication, incomplete external-source administration, demo commerce with unsent inquiries, and no platform-wide attention aggregate. Completing this catalog release does not close those separate implementation gates.

---

## Signed-in experience — September 2026

This release replaces per-button account lookups with one verified session store and shared, paginated interaction reads. Saves, likes, and follows use independent optimistic writes with rollback and stale-account protection. Private collection drafts, selections, messages, feed ranking, and taste results are cleared when identity changes. Collection reads no longer silently stop at the default 1,000-row API limit.

The account page now presents session controls and private-gallery destinations directly. Settings has dedicated privacy controls, with clear account versus guest scope, reset confirmation, persistent tracking preferences, recovery states, and mobile navigation. Sign-out closes this browser's session while preserving independently signed-in devices.

Account activity is hydrated from the existing database, bounded to 500 recent signals and current saved preferences. It stays in memory and is never replayed into guest history or another account. Current likes, saves, and follows replace historical toggle events to prevent duplicate weighting. Older releases wrote activity without reliable ownership; the first verified sign-in archives that ambiguous local history under `arte:analytics:legacy-v1` and removes it from active guest recommendations. Guest likes, saves, follows, collections, and privacy preferences are preserved. The archive is not replayed or uploaded.

Cross-tab messages contain invalidations only. Tracking changes, hidden-work restoration, and activity resets reload authoritative settings in other tabs. Activity resets preserve intentional likes, saves, follows, collections, and the tracking preference. These changes use existing schema and require no additional production migration.

The earlier cross-device-history limitation is superseded for this bounded recent-activity implementation. Public catalog publication, administration, demo commerce, and platform-wide attention limitations remain. Shared Corridor still separately requires its existing migration and explicit early-access enrollment; these account fixes do not enroll anyone.

### Verification checkpoint

- Focused interaction tests exercise concurrent writes, failed-write rollback, stale account responses, batch loading, retry, and pagination beyond 1,000 rows.
- Account-activity tests cover owner validation, bounded hydration, deduplication, retained choices, and legacy-history quarantine.
- Seven deterministic account/Corridor browser tests passed during implementation, including verified Auth request volume, failed-session recovery, note lifecycle, keyboard/mobile accessibility, and cross-tab sign-out. These fixtures do not prove database authorization.
- `tests/integration/account-browser-local.mjs` uses two real disposable Supabase accounts and a production Next build. Its gates cover persistence, failure/retry, private collection CRUD and RLS, fresh-device activity and preferences, reset semantics, cross-tab/local sign-out, account switching, mobile accessibility, and request volume. Database CI runs it alongside pgTAP, Auth/API tests, and migration reset/reapply.
- Final local checks, exact-commit CI, and production deployment smoke are pending at this pre-publication checkpoint. Production authenticated journeys require a real account; disposable local Auth testing does not imply access to a production user's private data.
