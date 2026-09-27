# Release checklist

Current evidence is recorded in `GAUNTLET.md`, September 27 release continuation. Checked items apply only to the scope stated below. The full 48-test application run passed; after the final CTA contrast repair, lint/build and the 10 relevant foundation/release tests passed again. No new database or production-deployment pass is implied.

## Local guest application evidence

- [x] Consolidated lint, types, 43 unit tests, production build with 149 generated static pages, and 48 Chromium regressions pass on the tested application snapshot; zero browser retries used.
- [x] Final CSS contrast repair passes lint/build and 10 foundation/release browser tests, including a 4.5:1 primary CTA contrast assertion.
- [x] Inspect mobile 375×812, tablet 768×1024, desktop 1440×900 and large desktop 1920×1080 screenshots after the repair.
- [x] Six primary routes pass Axe A/AA checks, browser console/page-error checks, and horizontal-overflow checks at all four viewports; museum artwork browser coverage verifies decoded local imagery.
- [x] Guest search, save/reload, private named collection create/add/rename/remove/delete, onboarding, Art DNA share text, privacy resets, and local demo inquiry-draft journeys are verified.
- [x] Invalid API input, hidden-cursor pagination, stale/expired listing exclusions and unauthorized admin requests are verified within application tests.
- [x] All 78 real museum works retain archived public-domain clearance, local images, source attribution and seed identities; 12 synthetic works stay clearly labeled.
- [x] Demo listings and local inquiry drafts are unmistakable; no fake purchase or successful-send action is presented.
- [x] Offline metadata embeddings generate/rebuild 90 records and reuse all 90 unchanged records on update, without implying image understanding or changing live ranking.

## Required before closing release and deployment gates

- [ ] Record the final pushed commit and passing current application CI result; local evidence above must not be relabeled as a GitHub Actions run.
- [ ] Database workflow passes the new migration and 90-work seed, all 49 pgTAP assertions, Auth integration and reset/reapply repeatability. Historical database passes do not satisfy this revision.
- [ ] Obtain the authorized Vercel CLI session requested by the user following the connected-tool HTTP 403 and failed passkey sign-in path.
- [ ] Vercel deployment is READY; record the actual production URL and deployed commit.
- [ ] Smoke-test `/api/health`, browsing, museum attribution/image, search, save/reload, collections, onboarding/Art DNA, demo inquiry persistence and locked admin behavior on the actual production URL.

## Before claiming the full commercial product

- [ ] Hosted Supabase is configured with the current migrations/seed; real authentication, account persistence, reset identity isolation and cross-account security are verified.
- [ ] Implement and verify cross-device recommendation history/preference retrieval, hydration and merging. This remains code work, not a credential-only blocker.
- [ ] Replace the bundled public catalog retrieval path with live database publication and cache invalidation so admin publication/archive changes affect public browsing.
- [ ] Complete external-source ingestion administration, artwork/source/artist CRUD, rights review and publication workflows. Phase 7 remains partial.
- [ ] Live seller/gallery agreements, source permissions, inventory verification and expiry operations are in place.
- [ ] Real inquiries have a secure delivery workflow and production abuse controls.
- [ ] Global attention aggregation and anti-manipulation are implemented and verified.
- [ ] Operational monitoring, backups, alerts and rights takedown processes are configured and tested.

Unchecked items are not passing gates. The guest application evidence does not establish a completed commercial product, a passing new database release, or a successful deployment.
