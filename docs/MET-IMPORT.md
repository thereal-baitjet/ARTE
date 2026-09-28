# Met catalog import and recovery

The current Met release contains **339 real, public-domain artworks**, covering 65 attribution-qualified artist identities and 26 museum categories. All 78 original artworks retain their identifiers, URLs and byte-identical WebP images. The final 339 optimized image hashes are unique. This is the Met contribution to the combined 500-work release; the combined manifest owns the total across museums.

## Commands

Run from the repository root with Python 3 and the installed Node dependencies:

```sh
python3 scripts/collect-met-catalog.py --target 500 --workers 12
python3 scripts/fetch-met-images.py --target 500 --workers 8
node scripts/build-met-catalog.mjs --target=500
node --test tests/unit/importer.test.mjs
```

`--target` is the requested **Met-only** count. It must not be smaller than the published Met inventory. The combined 500-work milestone is separate: 339 Met works plus 161 Cleveland works. The Met importer does not manufacture missing inventory or relax its target after a failure.

The collection command uses the official `/public/collection/v1.1/search` endpoint with offset pagination and `/public/collection/v1/objects/{id}` records. It scans a bounded set of named creators across media and regions, then orders results round-robin across searches. Source information remains museum supplied; unknown palette, mood and historical movement are not invented.

## Safety and staging

- Metadata cache lifetime is seven days by default (`--cache-hours` controls it). `_verifiedAt` is updated only after an actual object response, not when a cache entry is reused.
- Up to 12 concurrent metadata requests share a six-request-per-second throttle. Transient failures use bounded retries/backoff and respect bounded `Retry-After`. HTTP 400, 401, 403 and 404 do not trigger retries.
- Rights require a public-domain flag, named creator, title, image URL, museum source URL and no restriction text. If an existing published record fails re-verification, the pipeline blocks before replacing the live catalog.
- Candidate metadata is staged in `.met-import-cache/candidate-records.json`. The image stage writes `.met-import-cache/ready-records.json` only after the requested count and all published identities are present.
- Downloads accept only bounded JPEGs from `images.metmuseum.org`, record source URL/hash evidence and invalidate cached images when their source URL changes. Failed new records are rejected and later candidates backfill the target. Published records are never silently dropped.
- Exact downloaded-byte duplicates are rejected before selection. The builder also checks optimized WebP hashes; any new duplicate blocks publication and is recorded in `duplicate-images.json` so rerunning the image stage backfills it.
- The builder checks image evidence, rights freshness, identifiers, target count and image dimensions before touching live output. WebP files fit within 1280×1600 without enlargement or cropping. Unchanged existing images are copied exactly.
- All files are staged first. Each published replacement is atomic, recovery copies are retained, and a failed replacement restores previous files and moves newly added images back to staging. The source-specific manifest is written last as the release marker.

These commands do not write to hosted Supabase or deploy the website. Generated SQL is repeatable, and the Met generator preserves any appended Cleveland section. Deployment remains a separate tested source release.

## Outputs

- `lib/artworks/data/met-source-records.json`: original source metadata, actual verification times and image-download evidence.
- `lib/artworks/metArtworks.ts`: generated typed catalog with deterministic source-scoped UUIDs. Existing artwork slugs are preserved.
- `public/artworks/met-*.webp`: optimized image assets.
- `supabase/seed.sql`: matching museum, artist, artwork, source, image, category and tag rows. The museum row includes the required slug.
- `lib/artworks/data/met-catalog-manifest.json`: exact identities, image hashes, source/artist/category counts and medium/date distributions.

The combined `catalog-manifest.json` is generated separately after all source contributions are ready.

## September 2026 expansion evidence

The Met API supplied 340 rights-cleared candidates including the original 78. One new image (object 198608) returned HTTP 404, leaving 339 verified image-ready works. A subsequent API access denial returned an Incapsula HTTP 403 page, including for a previously accessible object. Bulk requests were stopped; no challenge was bypassed. The release uses the verified records already obtained and a separate authorized museum source for the remaining works.

The final image stage ran with `--target 339 --candidates .met-import-cache/met-final-candidates.json`; the builder ran with `--target=339`. All 339 optimized hashes were checked, and all 78 previous WebP files were compared byte-for-byte with Git HEAD. Ten offline importer tests cover cache expiry, rights revocation, retry policy, unchanged published bytes on failure, stable identities, download failure and pre-publication count/identity gates.
