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
- Local `git clone` attempt failed because that sandbox session could not resolve `github.com`; no success was claimed from it.

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

- Bootstrapped a Next.js App Router application with React, TypeScript, Tailwind CSS, ESLint, and Playwright.
- Added gallery palette, typography, focus states, reduced-motion behavior, responsive desktop navigation, and mobile bottom navigation.
- Added loading, error, empty, and not-found primitives.
- Added a polished landing page and truthful placeholder routes for later phases.
- Added unit tests, production-build validation, and browser tests.

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

Playwright verified the landing shell at:

- 375 × 812 mobile
- 768 × 1024 tablet
- 1440 × 900 desktop
- 1920 × 1080 large desktop

The tests asserted the main heading and primary action were visible and that browser console/page-error collections remained empty. Full-page screenshots were stored in artifact `playwright-report`, artifact ID `10941257687`.

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
- Added core tables for profiles, artists, artworks, images, source records, embeddings, movements, listings, likes, saves, follows, impressions, typed events, feed sessions, collections, recommendation profiles/events, synchronization runs, inquiries, and admin audit logs.
- Added database constraints that block publication when image rights are unclear or restricted.
- Added row-level security for private user data, ownership boundaries, public artwork visibility, expired listing visibility, and admin access.
- Added account provisioning from `auth.users` to `profiles`.
- Added a browser Supabase client and magic-link authentication interface with a safe unconfigured-environment state.
- Added the `ArtworkRights` presentation component and application-side rights validation.
- Added deterministic, repeatable, synthetic seed data with explicit demo/source/rights labels.
- Added pgTAP coverage for schema presence, source provenance, rights enforcement, private collections, cross-user like prevention, and owner access.
- Added a local Supabase Auth integration test for sign-up, sign-in, session issuance, and profile provisioning.

### Commands and evidence

Application validation — GitHub Actions run `36349274744`, commit `10437ecb4f9786e211a384fc90caa7fecf56fa64`:

- `npm install` — PASS
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run build` — PASS
- `npx playwright install --with-deps chromium` — PASS
- `npm run test:e2e` — PASS

Latest browser report artifact:

- Name: `playwright-report`
- Artifact ID: `10941183731`
- Digest: `sha256:76dd030e9db1da6f7f922e97d72a91c2373dfac7395ac8a707cf408c301e8e43`

Database/Auth validation — GitHub Actions run `36349274803`, commit `10437ecb4f9786e211a384fc90caa7fecf56fa64`:

- Start local Supabase stack — PASS
- Apply migrations and seed — PASS
- `supabase test db` — PASS
- Run local Auth integration — PASS
- Re-apply migrations and seed — PASS
- Re-run `supabase test db` — PASS
- Stop local Supabase stack — PASS

### Bugs discovered and repaired

- Corrected SQL helper-function quoting.
- Corrected the pgTAP test plan.
- Prevented recursive profile-policy lookup by moving role lookup behind a security-definer helper.
- Updated the database workflow to start the complete local Supabase stack so Auth integration could execute.

### External blockers

- Hosted Supabase credentials are not connected. Local migrations, RLS, Auth, and repeatability are verified; hosted account connection remains an external deployment action.

### Gate

- Migrations apply cleanly: **PASS**
- Seed is repeatable: **PASS**
- Authentication works: **PASS** — verified against local Supabase Auth.
- Unauthorized data access is blocked: **PASS**
- Every seeded artwork has source and rights state: **PASS**

**Final gate status: PASS**

---

## Phase 3 — Core Feed Vertical Slice

### Work completed

- Added a full-height, artwork-first discover feed using deterministic, clearly labeled synthetic demo work.
- Added stable cursor pagination through `/api/feed` with duplicate suppression and safe invalid-cursor responses.
- Added artwork presentation, metadata, rights-aware missing-image fallback, and interaction controls.
- Added guest like/save persistence through local storage and authenticated Supabase persistence when connected.
- Added optimistic interaction updates with rollback on Supabase failure.
- Added artwork detail pages, artist detail pages, related works, source attribution, and a synthetic-data disclosure route.
- Added feed-position preservation when opening detail pages and returning.
- Added keyboard controls for previous/next artwork, like, save, artwork information, and related works.
- Added hide/not-for-me behavior and a recovery path when all visible works are hidden.

### Attack findings and repairs

Initial CI run `36349835881` failed lint and correctly blocked the phase gate.

Reproduced failures:

- Unescaped apostrophe in the demo-source disclosure.
- Synchronous state update inside a React effect.
- Internal navigation used `window.location.assign` rather than the Next.js router.
- Existing anonymous PostCSS export produced a lint warning.

Repairs:

- Replaced the unsafe text character.
- Deferred hidden-state hydration through `requestAnimationFrame`.
- Moved internal shortcut navigation to `useRouter().push()`.
- Named the PostCSS configuration export.

### Commands and evidence

Passing GitHub Actions run `36349923375`, commit `f0936ac0577d2f614fd5194e127cbfbe739cbf93`:

- `npm install` — PASS
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run build` — PASS
- `npx playwright install --with-deps chromium` — PASS
- `npm run test:e2e` — PASS

### Browser verification

Playwright verified:

- Discover feed at 375 × 812 mobile with no console/page errors.
- Discover feed at 1440 × 900 desktop with no console/page errors.
- Cursor pagination appends unique artwork IDs.
- Guest likes and saves survive page reload.
- Artwork and artist routes resolve correctly.
- Feed scroll position restores after returning from an artwork.
- Intentional missing imagery renders a rights-first fallback rather than a broken asset.
- Invalid cursors return HTTP 400 with a controlled error payload.
- Arrow-key navigation advances the feed.

Browser report artifact:

- Name: `playwright-report`
- Artifact ID: `10941534263`
- Digest: `sha256:47894a35d8a325eb915e45d26f1e4f07a592466eebb8da6f55605061cf83f801`

### External blockers

- Hosted authenticated persistence requires the external Supabase project credentials documented in `.env.example`. Guest persistence and local Supabase ownership behavior are verified.

### Gate

- User can complete the core journey: **PASS**
- Likes and saves persist: **PASS**
- Feed does not duplicate records unexpectedly: **PASS**
- Mobile and desktop visual checks pass: **PASS**
- No broken-image crash: **PASS**

**Final gate status: PASS**

---

## Phase 4 — Personalization

**Status: IN PROGRESS**

Planned gate deliverables:

- Typed event tracking
- Deterministic recommendation profile
- Explainable ranking service
- Diversity controls
- More Like This modes
- Why This? explanations tied to actual signals
- Hidden-work suppression
