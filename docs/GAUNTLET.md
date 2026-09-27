# ARTE Gauntlet Report

This is the evidence log for the ARTE release-gate process.

## Status legend

- **PASS** — all gate requirements have command or browser evidence.
- **PASS WITH EXTERNAL BLOCKER** — implementation is complete and only an external account, credential, agreement, or domain action remains.
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

- Cross-device hosted personalization requires the external Supabase project credentials documented in `.env.example`. Guest adaptation and the complete local Supabase persistence/security path are verified.

### Gate

- Behavior influences recommendations: **PASS**
- Rankings are deterministic in tests: **PASS**
- Diversity thresholds pass: **PASS**
- Hidden works do not immediately return: **PASS**
- Explanations correspond to actual scoring signals: **PASS**

**Final gate status: PASS**

---

## Phase 5 — Search, Collections, and Art DNA

**Status: IN PROGRESS**

Planned gate deliverables:

- Structured and descriptive search
- Search filters and typo tolerance
- Private-by-default collections with guest and authenticated persistence
- Art DNA estimates derived from actual event history
- Shareable taste card
- Analytics/privacy controls and personalization reset
