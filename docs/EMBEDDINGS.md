# Embedding pipeline

ARTE includes an offline, replaceable embedding pipeline. The default provider hashes existing catalog metadata into deterministic 512-dimensional vectors. It makes no network calls and has no model/API cost. It does **not** inspect pixels, identify image content, or implement semantic image understanding. Hash collisions are possible; synonym recognition is not provided.

The live recommendation engine continues to use its explainable feature and interaction scoring. These offline vectors are not silently substituted for that algorithm, and generating them does not alter recommendations or write to Supabase.

## Run

Node 22 is required. Choose an explicit output path. For a disposable local check:

```bash
node --experimental-strip-types scripts/embeddings.ts generate --out /tmp/arte-embeddings.json
node --experimental-strip-types scripts/embeddings.ts update --out /tmp/arte-embeddings.json
node --experimental-strip-types scripts/embeddings.ts rebuild --out /tmp/arte-embeddings.json
```

- `generate` creates an index and refuses to overwrite an existing file.
- `update` reuses valid records whose artwork ID, input hash, and provider descriptor match. It generates new/changed records and drops works removed from the catalog. With no prior file it generates the initial index.
- `rebuild` explicitly regenerates all records, including after a provider or source change. It can replace a corrupt prior index.

Commands print generated, reused, removed, and total counts. Failures exit nonzero. All modes first write a temporary file. Generate atomically links it without overwriting; update/rebuild rename it only after successful generation, so a failed provider does not destroy the prior output. Corrupt files fail update; use rebuild intentionally to recover. Concurrent writers to the same output are unsupported; run one pipeline process per index.

## Contract and change detection

`EmbeddingProvider` declares an ID, version, dimensions, modality, and asynchronous `embed(input)` method. Its input has the artwork ID, normalized metadata, and an optional image URL. The metadata provider uses namespaced word tokens, deterministic signed hashing, and unit-length normalization. Its `metadata` modality is stored in the index alongside the provider/version.

The schema-versioned output contains the provider descriptor and records with `artworkId`, a SHA-256 `inputHash`, and a numeric `vector`. Records sort by artwork ID. Input fields and set-like metadata are canonicalized, so reordering the source catalog or tags does not trigger unnecessary generation. Timestamps are omitted to keep unchanged output stable.

Changing effective metadata, the image URL reference, or any provider descriptor field invalidates cached records. The image URL is only a source-change reference for the metadata fallback; it is never downloaded. Changes to bytes at an unchanged URL are not detected. A future image provider must introduce a content digest or explicitly rebuild for those changes.

Every vector must contain exactly 512 finite numbers and at least one nonzero value. This matches the current PostgreSQL `vector(512)` columns. Duplicate IDs, unsupported index schemas/dimensions, and malformed vectors are rejected. The CLI writes only JSON, never database columns; a future importer must respect provider modality and must not label metadata vectors as `image_embedding`.

## Add another provider

Implement `EmbeddingProvider` in `lib/embeddings/`, choose a new stable provider ID/version, and return a 512-dimensional vector. The builder accepts any implementation of this contract. Increment the provider version whenever preprocessing or model behavior changes. Connect paid or network providers only as a separate, explicitly configured deployment decision; none is bundled or called here.

Tests cover deterministic vectors, canonical change detection, cache reuse, source edits, version changes, explicit rebuild, removed records, invalid output, duplicate IDs, and the distinction between metadata hashing and image understanding.
