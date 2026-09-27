import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import { buildEmbeddingIndex, parseEmbeddingIndex } from "../../lib/embeddings/index.ts";
import { embeddingInputFor, inputFingerprint, MetadataHashProvider } from "../../lib/embeddings/metadata.ts";
import type { EmbeddingInput, EmbeddingProvider } from "../../lib/embeddings/types.ts";

const catalog = DEMO_ARTWORKS.slice(0, 2);

function countingProvider(version = "1.0.0") {
  const base = new MetadataHashProvider();
  let calls = 0;
  const provider: EmbeddingProvider = { descriptor: { ...base.descriptor, version }, embed: (input: EmbeddingInput) => { calls += 1; return base.embed(input); } };
  return { provider, calls: () => calls };
}

test("metadata vectors are deterministic, normalized, 512-dimensional, and explicitly labeled", async () => {
  const provider = new MetadataHashProvider();
  const input = embeddingInputFor(catalog[0]);
  const first = await provider.embed(input);
  assert.deepEqual(first, await provider.embed(input));
  assert.equal(first.length, 512);
  assert.ok(Math.abs(Math.hypot(...first) - 1) < 0.000001);
  assert.equal(provider.descriptor.modality, "metadata");
  assert.notDeepEqual(first, await provider.embed(embeddingInputFor(catalog[1])));
});

test("reordered catalog and metadata retain fingerprints and avoid provider work", async () => {
  const first = await buildEmbeddingIndex(catalog, new MetadataHashProvider());
  const counting = countingProvider();
  const reordered = catalog.toReversed().map((artwork) => ({ ...artwork, tags: artwork.tags.toReversed(), features: { ...artwork.features, palette: artwork.features.palette.toReversed() } }));
  const updated = await buildEmbeddingIndex(reordered, counting.provider, first.index);
  assert.deepEqual(updated.index, first.index);
  assert.deepEqual(updated.stats, { generated: 0, reused: 2, removed: 0, total: 2 });
  assert.equal(counting.calls(), 0);
});

test("changed metadata, provider version, and explicit rebuild invalidate the proper records", async () => {
  const original = await buildEmbeddingIndex(catalog, new MetadataHashProvider());
  const modified = catalog.map((artwork, index) => index === 0 ? { ...artwork, movement: "A revised movement" } : artwork);
  const changed = await buildEmbeddingIndex(modified, new MetadataHashProvider(), original.index);
  assert.equal(changed.stats.generated, 1);
  assert.equal(changed.stats.reused, 1);
  assert.notEqual(changed.index.records[0].inputHash, original.index.records[0].inputHash);
  const upgraded = countingProvider("2.0.0");
  assert.equal((await buildEmbeddingIndex(catalog, upgraded.provider, original.index)).stats.generated, 2);
  assert.equal(upgraded.calls(), 2);
  assert.equal((await buildEmbeddingIndex(catalog, new MetadataHashProvider(), original.index, true)).stats.generated, 2);
});

test("updates remove deleted catalog entries and reject duplicate artwork IDs", async () => {
  const original = await buildEmbeddingIndex(catalog, new MetadataHashProvider());
  const updated = await buildEmbeddingIndex(catalog.slice(0, 1), new MetadataHashProvider(), original.index);
  assert.deepEqual(updated.stats, { generated: 0, reused: 1, removed: 1, total: 1 });
  await assert.rejects(buildEmbeddingIndex([catalog[0], catalog[0]], new MetadataHashProvider()), /Duplicate artwork ID/);
});

test("invalid provider output and corrupted caches cannot silently enter the index", async () => {
  const good = new MetadataHashProvider();
  for (const vector of [[1, 2], Array<number>(512).fill(0), [Number.NaN, ...Array<number>(511).fill(1)]]) {
    await assert.rejects(buildEmbeddingIndex(catalog, { descriptor: good.descriptor, embed: async () => vector }), /invalid vector/);
  }
  const original = await buildEmbeddingIndex(catalog, good);
  assert.deepEqual(parseEmbeddingIndex(original.index), original.index);
  assert.throws(() => parseEmbeddingIndex({ ...original.index, records: [original.index.records[0], original.index.records[0]] }), /duplicate/);
  assert.throws(() => parseEmbeddingIndex({ ...original.index, provider: { ...good.descriptor, dimensions: 256 } }), /dimensions/);
});

test("image URL is a cache invalidation reference, never image understanding", async () => {
  const input = embeddingInputFor(catalog[0]);
  const changed = { ...input, imageUrl: "https://example.com/changed-public-domain-image.jpg" };
  assert.notEqual(inputFingerprint(input), inputFingerprint(changed));
  const provider = new MetadataHashProvider();
  assert.deepEqual(await provider.embed(input), await provider.embed(changed));
});
