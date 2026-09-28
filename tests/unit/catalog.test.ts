import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { DEMO_ARTISTS, DEMO_ARTWORKS, GALLERY_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import { MET_ARTWORKS } from "../../lib/artworks/metArtworks.ts";

test("catalog meets quantity, diversity, and stable synthetic-fixture gates", () => {
  assert.ok(DEMO_ARTWORKS.length >= 75);
  assert.ok(DEMO_ARTISTS.length >= 20);
  assert.ok(new Set(DEMO_ARTWORKS.map(({ movement }) => movement)).size >= 12);
  assert.equal(DEMO_ARTWORKS.slice(0, 12).every(({ isDemo }) => isDemo), true);
  assert.equal(DEMO_ARTWORKS[0].id, "30000000-0000-0000-0000-000000000001");
  assert.equal(DEMO_ARTWORKS[11].id, "30000000-0000-0000-0000-000000000012");
  assert.equal(new Set(DEMO_ARTWORKS.map(({ id }) => id)).size, DEMO_ARTWORKS.length);
  assert.equal(new Set(DEMO_ARTWORKS.map(({ slug }) => slug)).size, DEMO_ARTWORKS.length);
  assert.ok(new Set(MET_ARTWORKS.map(({ medium }) => medium)).size >= 3);
  assert.ok(new Set(MET_ARTWORKS.map(({ year }) => year)).size >= 3);
});

test("every museum image has archived clearance, local bytes, attribution, and matching SQL identities", async () => {
  const sources = JSON.parse(await readFile(new URL("../../lib/artworks/data/met-source-records.json", import.meta.url), "utf8")) as Array<{ objectID: number; isPublicDomain: boolean; objectURL: string; rightsAndReproduction: string; _verifiedAt: string }>;
  const seed = await readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
  assert.equal(sources.length, MET_ARTWORKS.length);
  for (const artwork of MET_ARTWORKS) {
    const source = sources.find(({ objectURL }) => objectURL === artwork.rights.sourceUrl);
    assert.equal(source?.isPublicDomain, true);
    assert.equal(source?.rightsAndReproduction.trim(), "");
    assert.ok(source?._verifiedAt);
    assert.equal(artwork.isDemo, false);
    assert.equal(artwork.visual.kind, "image");
    assert.equal(artwork.rights.license, "CC0 1.0 Universal");
    assert.equal(artwork.museum?.name, "The Metropolitan Museum of Art");
    assert.ok(seed.includes(artwork.id));
    assert.ok(seed.includes(artwork.artist.id));
    if (artwork.visual.kind === "image") {
      const info = await stat(new URL(`../../public${artwork.visual.src}`, import.meta.url));
      assert.ok(info.size > 1000);
      assert.ok(artwork.visual.width <= 1280 && artwork.visual.height <= 1600);
    }
  }
});

test("published museum catalog matches its release manifest and keeps prior saved identities", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/catalog-manifest.json", import.meta.url), "utf8")) as {
    realArtworkCount: number; totalArtworkCount: number; syntheticFixtureCount: number;
    sourceCounts: Record<string, number>; artistCount: number; categoryCount: number;
    artworks: { id: string; source: string; objectId: number; imagePath: string; imageSha256: string; sizeBytes: number; delivery?: string; width?: number; height?: number }[];
  };
  assert.equal(manifest.realArtworkCount, 1000);
  assert.equal(manifest.realArtworkCount, GALLERY_ARTWORKS.length);
  assert.equal(manifest.totalArtworkCount, DEMO_ARTWORKS.length);
  assert.equal(manifest.syntheticFixtureCount, DEMO_ARTWORKS.filter(work => work.isDemo).length);
  assert.equal(manifest.sourceCounts.met, MET_ARTWORKS.length);
  assert.deepEqual(manifest.sourceCounts, { met: 339, cleveland: 350, nga: 299, moma: 12 });
  assert.equal(manifest.artistCount, new Set(GALLERY_ARTWORKS.map(work => work.artist.id)).size);
  assert.equal(manifest.categoryCount, new Set(GALLERY_ARTWORKS.map(work => work.movement)).size);
  assert.equal(new Set(manifest.artworks.map(work => work.id)).size, manifest.realArtworkCount);
  const metManifest=JSON.parse(await readFile(new URL('../../lib/artworks/data/met-catalog-manifest.json',import.meta.url),'utf8')) as {preservedObjectIds:number[];objectIds:number[]};
  assert.ok(metManifest.preservedObjectIds.length >= 78);
  assert.ok(metManifest.preservedObjectIds.every(id => metManifest.objectIds.includes(id)));
  const priorIds = new Set(metManifest.preservedObjectIds);
  const seen = new Map<string, number>();
  const { createHash } = await import("node:crypto");
  type RemoteSource = { id: number; _imageEvidence: { url: string; sha256: string; sizeBytes: number; width?: number; height?: number } };
  const remoteSources = new Map<string, RemoteSource[]>();
  for (const provider of ["cleveland", "nga"]) remoteSources.set(provider, JSON.parse(await readFile(new URL(`../../lib/artworks/data/${provider}-source-records.json`, import.meta.url), "utf8")));
  for (const entry of manifest.artworks) {
    assert.ok(GALLERY_ARTWORKS.some(work => work.id === entry.id));
    if (entry.delivery === "remote") {
      const source = remoteSources.get(entry.source)?.find(record => record.id === entry.objectId);
      assert.ok(source);
      assert.equal(entry.imagePath, source._imageEvidence.url);
      assert.equal(new URL(entry.imagePath).hostname, entry.source === "cleveland" ? "openaccess-cdn.clevelandart.org" : "api.nga.gov");
      assert.equal(entry.imageSha256, source._imageEvidence.sha256);
      assert.equal(entry.sizeBytes, source._imageEvidence.sizeBytes);
      assert.equal(entry.width, source._imageEvidence.width);
      assert.equal(entry.height, source._imageEvidence.height);
    } else {
      const bytes = await readFile(new URL(`../../public${entry.imagePath}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.imageSha256);
      assert.equal(bytes.length, entry.sizeBytes);
    }
    if (!(entry.source === "met" && priorIds.has(entry.objectId))) assert.ok(!seen.has(entry.imageSha256), `Duplicate new image ${entry.objectId}`);
    seen.set(entry.imageSha256, entry.objectId);
  }
});
