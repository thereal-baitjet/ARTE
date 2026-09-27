# Catalog provenance and repeatable import

The checked-in catalog contains **90 works**: the original 12 clearly labeled synthetic fixtures and **78 genuine Met Open Access records with local images**. The Met records represent 27 distinct museum-supplied creator names (33 attribution-qualified identities, such as workshop/follower/possibly-by records). Including the four fictional fixture identities, the application exposes 37 artist pages. There are 21 distinct displayed movement/category labels, including the nine synthetic fixture categories. Museum classifications are categories, not claimed art-historical movements.

## Official sources and rights gate

- Policy: https://www.metmuseum.org/policies/image-resources
- API reference: https://metmuseum.github.io/
- License: https://creativecommons.org/publicdomain/zero/1.0/
- Per-object API URLs, museum object URLs, public-domain flags, source metadata timestamps, and actual verification times are preserved in `lib/artworks/data/met-source-records.json`.

The importer accepts only records with `isPublicDomain === true`, a named creator, a primary image, a museum source URL, and no `rightsAndReproduction` restriction text. A successful image download is required. The archive is a verification snapshot, not a promise that the museum's records will never change. Re-import before expanding or refreshing the selection. None of these works is presented as available for sale or endorsed by the museum.

The museum's policy dedicates qualifying Open Access images and basic collection data under CC0. Attribution is retained even though CC0 does not require it. The application preserves museum titles, creator qualifiers, dates, media, dimensions, credit lines, and category/subject tags. It does not infer artistic movement, palette, mood, image embeddings, or creator biography from an image. Missing metadata stays unfilled. Display descriptions assemble supplied facts; artist biographies use the source's artist-display biography when present.

## Reproduce the import

From the repository root, with Python 3, Node 22, installed project dependencies, and network access:

```sh
python scripts/collect-met-catalog.py
python scripts/fetch-met-images.py
node scripts/build-met-catalog.mjs
node --experimental-strip-types --test tests/unit/catalog.test.ts tests/unit/search.test.ts
```

The collection step uses the current paginated `/public/collection/v1.1/search` endpoint, with bounded candidate lists, five workers, and two attempts per request. The official documentation schedules retirement of the legacy `/v1/search` endpoint on October 1, 2026. Per-object records continue to use `/public/collection/v1/objects/{id}`.

Temporary metadata/downloads live in the ignored `.met-import-cache/` directory. The collection script reuses per-query caches; remove that directory before a fresh rights verification. Download limits are 12 MiB per image, and images must come from `images.metmuseum.org`. The checked-in 78 WebP derivatives total about 4.1 MiB. Sharp resizes each to fit inside 1280×1600 pixels without enlargement or cropping; Next Image then serves responsive sizes. Browser builds do not fetch the museum API.

## Outputs and database parity

- `lib/artworks/metArtworks.ts`: typed app catalog generated from the verified source records.
- `public/artworks/met-*.webp`: optimized local images.
- `supabase/seed.sql`: matching deterministic UUIDs for museum, artists, artworks, images, source records, categories, and tags. Generated SQL is idempotent and replaces only the marked Met section when rebuilt.
- `/sources/met`: public provenance and policy explanation.

The original twelve fixture IDs, ordering, and synthetic records are preserved. Legacy `DEMO_ARTWORKS` and `DEMO_ARTISTS` exports now expose the combined catalog to avoid a broad import migration. `SYNTHETIC_ARTWORKS` and `MET_ARTWORKS` expose the two factual source groups separately.

Apply the current migrations and seed to a configured Supabase project before enabling hosted interactions for this catalog; its artist/artwork foreign keys must match these deterministic IDs. Guest browsing uses the checked-in catalog directly.

## Validation scope

`tests/unit/catalog.test.ts` checks minimum collection size, artist/category/medium/date diversity, stable original IDs, unique IDs/slugs, every real record's archived public-domain clearance, attribution/license, local image bytes/dimensions, and matching seed identities. Search unit tests cover the expanded corpus. The browser search suite includes a real museum artwork route, decoded image, visible CC0 attribution, and original museum source link.
