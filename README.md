# ARTE — Discover art that discovers you

ARTE is a Next.js art-discovery application with explainable recommendations, search, private collections, visual onboarding, and Art DNA. The checked-in public catalog contains **1,000 real, attributed museum works: 339 Met, 350 Cleveland, 299 National Gallery of Art, and 12 MoMA works**. Combined source/manifest validation has passed; consolidated application, database, and deployment gates remain pending. Images have source-specific public-domain evidence; the MoMA selection uses independently verified Wikimedia Commons reproductions rather than treating museum metadata CC0 as an image license. Public discovery, search, onboarding, attention, and related-work choices exclude synthetic fixtures. Twelve labeled fixtures remain for legacy saved references, direct demo routes, and the demo marketplace. See [CATALOG](docs/CATALOG.md) and [GAUNTLET](docs/GAUNTLET.md). Its marketplace demonstrates discovery and inquiry drafts; it does not sell real inventory or send inquiries.

## Run locally

Use Node.js 22 and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The guest experience runs without credentials. Open http://localhost:3000.

## Validate

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

For an existing Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The test runner starts the production server; build first. Database and auth integration run in the dedicated GitHub Actions workflow using local Supabase. See [GAUNTLET](docs/GAUNTLET.md) for actual evidence and unresolved gates.

## Product routes

- `/discover`: personalized, paginated feed with likes, saves, hides, and explanations.
- `/search`: descriptive metadata search, filters, typo tolerance, and shareable query URLs.
- `/onboarding`: optional artwork selections that build an initial taste profile.
- `/collections`: saved works and private named collections.
- `/profile/taste`: Art DNA estimates, export, and privacy controls; `/taste` is an alias.
- `/profile` and `/settings`: account access and personalization controls.
- `/trending`: explicitly scoped attention signals, never artistic merit.
- `/market`: marked demo listings with freshness filters and private inquiry drafts.
- `/admin`: fail-closed authenticated administration, sources, and diagnostics.
- `/api/health`: deployment health, real artwork count, and account-configuration status.

## Persistence and external services

Guest preferences, collections, history, follows, and inquiry drafts are stored in this browser. Clearing browser data removes them. A bounded copy of up to 500 recent events is sent to ARTE to calculate recommendations, Art DNA, and personal attention; these calculation endpoints do not persist guest history. Search and collection views request small pages of artwork summaries instead of downloading the complete catalog. Signed-in activity can also be saved to the configured account backend. Supabase integration enables configured account operations; deployment still requires a hosted project, migrations, Auth URLs, and a verified live account test. Recent recommendation history is device-local; hosted writes alone do not establish cross-device personalization.

Real inventory, seller verification, live gallery contact, payment processing, and paid image embeddings are not enabled. The catalog is released with source control; 512 images are local and 488 use official museum CDNs after import-time download/hash/decode checks. Remote delivery depends on those services. Administrative database changes do not automatically replace the released catalog. Do not advertise the demo as a connected commercial marketplace.

## Deployment and documentation

Import `thereal-baitjet/ARTE` into Vercel with the repository root and Next.js preset. `vercel.json` uses `npm ci` and `npm run build`. Guest mode needs no environment variables. See [DEPLOYMENT](docs/DEPLOYMENT.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [RECOMMENDATIONS](docs/RECOMMENDATIONS.md), [RIGHTS](docs/RIGHTS.md), and [RELEASE-CHECKLIST](docs/RELEASE-CHECKLIST.md).
