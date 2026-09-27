# ARTE Gauntlet Report

This is the evidence log for the ARTE release-gate process. Historical passing gates below apply to their recorded commits. The September 27 release continuation records the current scope, new evidence, and remaining blockers; the full gauntlet is not complete.

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

## Release continuation — September 27, 2026

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

**Current release conclusion: tested local guest release candidate; full gauntlet, new database gate, and Vercel deployment remain open.**

### Prepared delivery

The final guest release includes a local CLI helper (`npm run deploy:vercel`), Vercel build configuration, and screenshot evidence in `screenshots/`. Following an initial approval block, the user explicitly authorized committing and publishing the release to GitHub on September 27, 2026. The release incorporates newer main commits for Supabase setup and Vercel configuration; neither is discarded. A source ZIP was also provided for local CLI deployment. GitHub publication is separate from successful deployment and hosted database verification.
