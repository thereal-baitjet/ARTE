# Release checklist

This checklist applies to the **1,000-real-work release: Met 339, Cleveland 350, NGA 299, and MoMA 12**, with twelve separate legacy synthetic fixtures (1,012 total seed records). All four source contributions and combined-manifest/source validation are complete; consolidated application checks pass; database and deployment gates remain pending at this pre-push checkpoint. The verified image split is 512 local and 488 official remote museum images. Earlier 500-work validation does not transfer automatically to this revision.

## Implemented scope and focused evidence

- [x] Met 339 generated with unique optimized hashes; original 78 IDs/slugs/images preserved.
- [x] Cleveland 350 generated with explicit CC0, pinned official provenance, original 161 local records/images preserved, and 189 downloaded/hash-verified remote image records.
- [x] MoMA 12 generated with pinned official metadata and independent Commons public-domain image evidence, permanent revisions, and preserved source credits; three focused validator tests pass.
- [x] Public browsing excludes synthetic fixtures; explicit legacy saved references still resolve.
- [x] Search, onboarding, related works, attention, taste, and collection lookups use bounded server payloads.
- [x] Activity endpoints validate event types and actual request bytes; calculation responses are `no-store` and do not persist guest history.
- [x] Privacy copy discloses server calculation from bounded device-local events; reset clears stale displayed results.
- [x] Missing palette/mood/composition metadata is described as unavailable.
- [x] Regressions cover more than 100 hidden works, real museum hero decoding/attribution/navigation, bounded APIs, pagination, and recoverable search failures.
- [x] The diversity scheduler removes redundant group-count scans; output parity was verified on two histories. No production latency claim is made.
- [x] Earlier 500-work unit suite passed 79 tests and production build generated 771 pages; its browser run had 55 passes and 4 failing assertions, so it was not a full browser pass.

## Required for this release

- [x] Confirm NGA 299 final typed catalog/manifest/seed and independent per-image Open Access evidence, decode/hash checks, and cross-source duplicate checks.
- [x] Combined manifest and `--check` confirm exactly 1,000 real works, split 339/350/299/12, twelve separate fixtures, and matching local/remote image evidence.
- [x] Generate source-qualified SQL catalog expectations and confirm `--check` consistency; generation alone is not PostgreSQL execution.
- [x] Review a balanced four-source asset sample including all 12 MoMA works and varied remote-image records. Cached-byte review is not a runtime CDN availability test.
- [x] Current 1,000-work checkpoint passes lint, typecheck, and 87 unit tests (27 JavaScript, 60 TypeScript).
- [x] Current 1,000-work production build passes with 1,743 generated pages.
- [x] Complete the full Chromium suite: 65 tests pass without retries; final scroll regressions, lint, types, and production build pass.
- [ ] Review fresh 375×812, 768×1024, 1440×900, and 1920×1080 product screenshots. Verify actual decoded imagery from all four museums, source/image-credit links, usable controls, no horizontal overflow or console errors, and tested Axe A/AA checks.
- [ ] Exercise the Cleveland CDN and NGA IIIF service in the browser, including a usable failed-image state.
- [ ] Current database workflow passes migrations/seed, generated expectations, pgTAP security checks, local Auth, and reset/reapply repeatability. Close the earlier missing-museum-slug failure with actual execution evidence.
- [ ] Record the pushed revision and passing application/database CI URLs for that exact SHA.
- [ ] Record Vercel deployment status, deployed SHA, and actual production URL.
- [ ] Smoke-test health (`artworkCount >= 1000`), source-specific image/attribution, discovery/search pagination, save/reload, collections, onboarding/Art DNA, attention, demo inquiry persistence, and locked admin on the actual public URL.

A deployment URL redirecting to Vercel login is not a successful application smoke test. Earlier GitHub status success does not establish that this catalog is deployed or publicly reachable.

## Before claiming the full commercial product

- [ ] Hosted Supabase uses current migrations/seed; real authentication, persistence, reset identity isolation, and cross-account security are verified.
- [ ] Implement and verify cross-device recommendation-history retrieval, hydration, and merging.
- [ ] Connect live database publication/archive operations to public catalog retrieval and cache invalidation.
- [ ] Complete external-source administration, artwork/source/artist CRUD, rights review, and publication workflows.
- [ ] Establish live seller/gallery agreements, source permissions, verified inventory, and expiry operations.
- [ ] Implement secure inquiry delivery and production abuse controls; demo drafts remain unsent.
- [ ] Implement and verify global attention aggregation and resistance to manipulation.
- [ ] Configure and test monitoring, backups, alerts, rights-takedown operations, and external-image availability monitoring.

Unchecked items are not passing gates. Catalog size alone does not complete hosted personalization, commerce, or the full gauntlet.
