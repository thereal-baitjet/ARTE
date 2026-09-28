# Catalog provenance and repeatable import

## Current expansion scope

The checked-in release catalog contains **1,000 real museum works from four sources**, with twelve labeled synthetic fixtures retained for legacy saved references and demo routes. The source split is Met 339, Cleveland 350, National Gallery of Art (NGA) 299, and MoMA 12. All four source contributions are generated. Combined-manifest generation and `--check` passed against the source records, catalogs, 512 local image files, and 488 remote image evidence records. No synthetic fixture counts toward the public target. The complete database seed therefore contains 1,012 artwork records in its generated expectations; PostgreSQL execution remains a separate pending gate.

| Collection | Real works | Image delivery | Image rights evidence |
| --- | ---: | --- | --- |
| The Metropolitan Museum of Art | 339 | 339 local WebP files | Museum public-domain flag; Met Open Access CC0 |
| Cleveland Museum of Art | 350 | 161 preserved local WebP files; 189 official CDN images | Explicit `share_license_status === "CC0"` |
| National Gallery of Art | 299 | Official NGA IIIF service | Primary image record explicitly has `openaccess === "1"`; Public domain |
| The Museum of Modern Art | 12 | 12 local WebP files | Independently archived Commons public-domain reproduction evidence; MoMA metadata CC0 does not license images |

The verified delivery split is **512 local images and 488 remote museum images**. The Met's original 78 IDs, slugs, and image bytes remain unchanged; Cleveland's original 161 records and images also remain unchanged. Source-qualified artist identities are not necessarily distinct people across museums. The combined manifest records 696 source-qualified artist identities and 71 distinct category labels; those counts do not claim 696 distinct people or 71 art-historical movements. It is the authority for current counts and source-qualified identities; a source-local build or target alone is not a passing release gate.

## Source provenance and precise rights

Met records require `isPublicDomain === true`, a named creator, title, primary image, canonical museum object URL, and no restriction text. Archived responses, verification timestamps, URLs, and original/optimized image evidence are in `lib/artworks/data/met-source-records.json` and `met-catalog-manifest.json`. The completed Met contribution has 339 works, 65 attribution-qualified artist identities, 26 categories, and 16,985,218 local WebP bytes. [Met policy](https://www.metmuseum.org/policies/image-resources) and [API documentation](https://metmuseum.github.io/) describe its source program.

Cleveland uses its [official Open Access dataset](https://github.com/ClevelandMuseumArt/openaccess), pinned to commit `4684c48c7c07b1452db7963adf4aad8052055b7d`. The 343,572,124-byte `data.json` snapshot has SHA-256 `e8b29e67f3df840bca6cd1ffd37ca5d187b913af2ab2edf6ddb8cf164cd4359f`. Qualifying records require explicit CC0 status, no copyright restriction, a canonical museum record, and an official image URL. All selected image bytes were downloaded, decoded, and hashed during import even when delivery remains remote. The 350-work contribution has 334 source-qualified artist identities and 45 classification labels; new additions span media beyond paintings and are limited to three per creator attribution. The original 161 paintings remain unchanged. Metadata/source evidence lives in `cleveland-source-records.json`; the manifest distinguishes local and remote delivery.

NGA uses its [official open-data repository](https://github.com/NationalGalleryOfArt/opendata), pinned to commit `dfdbcf1a226ce1f2953f5e8422e71d923869b67e`. The import verifies pinned hashes for `objects.csv`, `published_images.csv`, and `constituents.csv`. A metadata CC0 license is insufficient image clearance: the joined primary published-image record must explicitly have `openaccess === "1"`; the object must be accessioned and nonvirtual. Selected official IIIF JPEGs are bounded, downloaded, decoded, and hashed, with normalized image hashes for duplicate checks. Image rights are displayed as **Public domain (NGA Open Access)**, grounded in the [NGA Open Access terms](https://www.nga.gov/terms-and-notices). The final 299-work contribution has 291 source-qualified artist identities and 10 classification labels; it balances classifications and caps each creator attribution at three works. The archived downloaded JPEGs total 45,448,370 bytes. Technical Material records are actual artist woodblocks/plates, not placeholder images.

MoMA uses the [official collection metadata repository](https://github.com/MuseumofModernArt/collection), pinned to commit `3053da6addd4d210b955021f410430ac3bbf18d4`. Its 144,917,269-byte `Artworks.json` snapshot has SHA-256 `288d65589d7dadec509984c50f726454be4bbe00e68e61cf7d6116713a408807`. **Its CC0 grant applies to metadata, not MoMA images.** No MoMA thumbnail or image URL is reused. Twelve curated paintings instead use individually checked Wikimedia Commons files labeled Public domain and `Copyrighted=False`, with `PD-Art` faithful-reproduction and `PD-old-100-expired` evidence. The official records document creation before 1931 and artist deaths from 1890 through 1918. The archive preserves full Commons API metadata, file and permanent revision URLs, original image SHA-1/SHA-256/size, artist and source credits, license templates, and the identity match to the museum record. Missing API `Attribution` or `LicenseUrl` values stay explicitly null; they are not invented. Image-source links remain distinct from MoMA object links. Six artists and 3,878,732 local WebP bytes are represented. A Rousseau Commons template's discrepant death year is retained with a note; the official MoMA death date is preserved unchanged.

All sources retain supplied titles, creator attributions, dates, media, dimensions, credit lines, and categories. Classification is not an inferred art-historical movement. No palette, mood, image embedding, or biography is invented from the image. Museum attribution does not imply endorsement or availability for sale.

## Access failures and authorized alternatives

The Met expansion obtained 340 cleared candidates; object 198608's image returned 404, leaving 339 image-ready works. Later requests returned an Incapsula 403 denial, including a known earlier object. Bulk access stopped and no challenge was bypassed. There is no remaining claim that 500 or 1,000 Met-only works were verified.

Cleveland's direct API also returned 403. Its museum-published GitHub dataset was used as the authorized alternative, retaining the same CC0/image gates. An Art Institute of Chicago image request returned 403, so that source did not contribute to this release; NGA's published data and image service supplied the additional source instead. Commons returned a rate limit during the MoMA import. Sequential requests respected the retry delay; the importer stops rather than shortening a longer or unparseable delay and never retries an explicit 403. A denied source is not a reason to fabricate rights, count metadata-only entries, or bypass access controls.

## Repeatable imports

Run from the repository root with Python 3, Node 22, installed project dependencies, and legitimate source access. Fresh imports still depend on source availability.

```sh
# Met: preserve the released 339-work contribution. See MET-IMPORT.md.
python3 scripts/collect-met-catalog.py --target 339 --workers 12
python3 scripts/fetch-met-images.py --target 339 --workers 8
node scripts/build-met-catalog.mjs --target=339

# Cleveland: retain the first 161 and add diverse CC0 records.
python3 scripts/import-cleveland-catalog.py --target 350 --buffer 30
node scripts/build-cleveland-catalog.mjs --target=350

# NGA: a per-image Open Access flag is required independently of metadata CC0.
python3 scripts/import-nga-catalog.py --target 299 --buffer 30
node scripts/build-nga-catalog.mjs --target=299

# MoMA: curated museum metadata joined to independently verified Commons files.
python3 scripts/moma-import.py
node scripts/moma-build.mjs
node --test tests/unit/moma-import.test.mjs
```

Pinned snapshot hashes, original image hashes, decoded dimensions, source URLs, and verification times remain in source archives. Cache reuse must not be described as a fresh museum clearance. Local WebP derivatives fit within 1280×1600 without enlargement or cropping. Import builders stage artifacts and write their source manifests after validation. Commands do not deploy the application or mutate hosted Supabase. See [MET-IMPORT](MET-IMPORT.md) for its additional cache, recovery, and rate-limit details.

## Application outputs and delivery dependencies

`PUBLIC_ARTWORKS` is the server-side museum-only catalog. It interleaves all four sources near the start while retaining the first Met work and published identities. `GALLERY_ARTWORKS` aliases it; the legacy combined lookup catalog also retains the twelve synthetic fixtures. Public discovery, search, onboarding, related results, attention, and collection choices exclude those fixtures. Explicit saved-ID lookup can still resolve them.

The twelve MoMA and all Met images are local, as are Cleveland's original 161 images. The additional 189 Cleveland works use `openaccess-cdn.clevelandart.org`; NGA 299 uses `api.nga.gov` IIIF. These 488 images introduce a runtime external CDN dependency: a successful import hash does not guarantee future remote availability. Product image-error handling must remain usable, and release browser/deployment checks must exercise remote images. Import caches are ignored by Git; new remote image bytes are not duplicated into repository blobs. Cached verified bytes can support offline asset review, but that is not a runtime network-availability test.

Each source has a typed catalog, archived records, source manifest, and generated seed section. `scripts/build-catalog-manifest.mjs` assembles counts, source-qualified object identities, delivery modes, and image evidence. Its `--check` mode detects stale or inconsistent output. `scripts/generate-database-catalog-test.mjs` generates seed parity expectations from the combined manifest; generation is distinct from PostgreSQL execution.

```sh
node scripts/build-catalog-manifest.mjs --target=1000
node scripts/generate-database-catalog-test.mjs
node scripts/build-catalog-manifest.mjs --target=1000 --check
node scripts/generate-database-catalog-test.mjs --check
```

`supabase/seed.sql` combines deterministic museum, artist, artwork, image, source, category, and tag records for the four source contributions and twelve fixtures. Apply current migrations and the entire seed before enabling hosted interactions; saved references use these stable IDs. Administrative database publication/archive changes still do not replace the checked-in public bundle. GitHub publication, CI success, database execution, Vercel status, and an actual public smoke test are separate gates.

## Verification gates

The release requires exactly 1,000 real public works and twelve separate fixtures, unique IDs/slugs and source-qualified object identities, stable old references, source-specific image rights, decoded/hash-verified image evidence, and generated/executed seed parity. Browser tests must verify actual image decoding and correct source attribution for all four museums, including remote delivery. Public pagination must return each real work once without synthetic records.

Search, related results, onboarding, collections, taste, and attention use bounded server responses rather than full-catalog client bundles. The 101-hidden-work regression protects personalization and pagination as the catalog grows. Command, database, browser, and deployed-URL evidence belongs in [GAUNTLET](GAUNTLET.md). The current [48-image contact sheet](screenshots/catalog-1000-contactsheet.jpg) includes twelve per source and all MoMA selections. Every sampled byte hash matched its source manifest, all 48 images decoded at expected dimensions, and three sixteen-image views were visually inspected. Remote panels use verified cached bytes, so this is asset evidence rather than a live CDN, product-page, or deployment check.
