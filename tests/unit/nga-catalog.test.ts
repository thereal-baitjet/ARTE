import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NGA_ARTWORKS } from "../../lib/artworks/ngaArtworks.ts";

type ImageRecord = {
  id: string; objectId: number; artistId: string; imagePath: string; imageSha256: string;
  normalizedImageSha256: string; delivery: string; sizeBytes: number; width: number;
  height: number; sourceUrl: string; imageSourceUrl: string; rightsState: string; license: string;
};
type Manifest = {
  realArtworkCount: number; artistCount: number; artworks: ImageRecord[];
  dataset: { commit: string; files: Record<string, { sha256: string; sizeBytes: number }> };
};
type Source = {
  id: number; sourceUrl: string;
  object: { objectid: string; accessioned: string; isvirtual: string; attribution: string; title: string };
  image: { openaccess: string; viewtype: string; depictstmsobjectid: string; iiifurl: string; uuid: string };
  _datasetSource: Manifest["dataset"];
  _verifiedAt: string;
  _imageEvidence: { url: string; sha256: string; normalizedSha256: string; sizeBytes: number; width: number; height: number; format: string; downloadedAt: string };
};

test("NGA image clearance is independent of metadata licensing and joins the exact museum object", async () => {
  const sources: Source[] = JSON.parse(await readFile(new URL("../../lib/artworks/data/nga-source-records.json", import.meta.url), "utf8"));
  const manifest: Manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/nga-catalog-manifest.json", import.meta.url), "utf8"));
  assert.equal(sources.length, manifest.realArtworkCount);
  assert.equal(NGA_ARTWORKS.length, manifest.realArtworkCount);
  assert.equal(new Set(NGA_ARTWORKS.map(({ id }) => id)).size, manifest.realArtworkCount);
  assert.equal(new Set(NGA_ARTWORKS.map(({ artist }) => artist.id)).size, manifest.artistCount);
  assert.equal(manifest.dataset.commit, "dfdbcf1a226ce1f2953f5e8422e71d923869b67e");
  assert.deepEqual(Object.keys(manifest.dataset.files).sort(), ["constituents.csv", "objects.csv", "published_images.csv"]);
  for (const evidence of Object.values(manifest.dataset.files)) {
    assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
    assert.ok(evidence.sizeBytes > 0);
  }
  const artworks = new Map(NGA_ARTWORKS.map((artwork) => [artwork.id, artwork]));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const counts = new Map<string, number>();
  for (const entry of manifest.artworks) {
    const source = sourcesById.get(entry.objectId);
    const artwork = artworks.get(entry.id);
    assert.ok(source && artwork);
    assert.ok(Number.isInteger(source.id) && source.id > 0);
    assert.equal(source.object.objectid, String(source.id));
    assert.equal(source.image.depictstmsobjectid, String(source.id));
    assert.equal(source.object.accessioned, "1");
    assert.equal(source.object.isvirtual, "0");
    assert.equal(source.image.openaccess, "1");
    assert.equal(source.image.viewtype, "primary");
    assert.equal(source._datasetSource.commit, manifest.dataset.commit);
    assert.deepEqual(source._datasetSource.files, manifest.dataset.files);
    assert.ok(Number.isFinite(Date.parse(source._verifiedAt)));
    assert.equal(source.sourceUrl, `https://www.nga.gov/collection/art-object-page.${source.id}.html`);
    assert.equal(entry.sourceUrl, source.sourceUrl);
    assert.equal(artwork.rights.sourceUrl, source.sourceUrl);
    assert.equal(artwork.title, source.object.title);
    assert.equal(artwork.artist.name, source.object.attribution);
    assert.equal(artwork.isDemo, false);
    assert.equal(artwork.museum?.name, "National Gallery of Art");
    assert.equal(entry.license, "Public domain (NGA Open Access)");
    assert.equal(artwork.rights.license, entry.license);
    assert.equal(entry.rightsState, "public_domain");
    counts.set(source.object.attribution, (counts.get(source.object.attribution) ?? 0) + 1);
  }
  assert.ok([...counts.values()].every((count) => count <= 3));
});

test("NGA remote images retain actual decoded dimensions and independent raw/normalized hash evidence", async () => {
  const sources: Source[] = JSON.parse(await readFile(new URL("../../lib/artworks/data/nga-source-records.json", import.meta.url), "utf8"));
  const manifest: Manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/nga-catalog-manifest.json", import.meta.url), "utf8"));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const rawHashes = new Set<string>();
  const normalizedHashes = new Set<string>();
  for (const provider of ["met", "cleveland"]) {
    const prior: Manifest = JSON.parse(await readFile(new URL(`../../lib/artworks/data/${provider}-catalog-manifest.json`, import.meta.url), "utf8"));
    for (const image of prior.artworks) {
      rawHashes.add(image.imageSha256);
      normalizedHashes.add(image.normalizedImageSha256 ?? image.imageSha256);
    }
  }
  for (const entry of manifest.artworks) {
    const source = sourcesById.get(entry.objectId)!;
    const evidence = source._imageEvidence;
    assert.equal(source.image.iiifurl, `https://api.nga.gov/iiif/${source.image.uuid}`);
    assert.equal(evidence.url, `${source.image.iiifurl}/full/!843,843/0/default.jpg`);
    assert.equal(entry.imagePath, evidence.url);
    assert.equal(entry.imageSourceUrl, evidence.url);
    assert.equal(entry.delivery, "remote");
    assert.equal(entry.imageSha256, evidence.sha256);
    assert.equal(entry.normalizedImageSha256, evidence.normalizedSha256);
    assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
    assert.match(evidence.normalizedSha256, /^[a-f0-9]{64}$/);
    assert.equal(entry.sizeBytes, evidence.sizeBytes);
    assert.ok(entry.sizeBytes > 1000);
    assert.equal(entry.width, evidence.width);
    assert.equal(entry.height, evidence.height);
    assert.ok(entry.width > 0 && entry.width <= 843);
    assert.ok(entry.height > 0 && entry.height <= 843);
    assert.equal(evidence.format, "jpeg");
    assert.ok(Number.isFinite(Date.parse(evidence.downloadedAt)));
    assert.equal(rawHashes.has(entry.imageSha256), false);
    assert.equal(normalizedHashes.has(entry.normalizedImageSha256), false);
    rawHashes.add(entry.imageSha256);
    normalizedHashes.add(entry.normalizedImageSha256);
    const artwork = NGA_ARTWORKS.find(({ id }) => id === entry.id);
    assert.ok(artwork?.visual.kind === "image");
    assert.equal(artwork.visual.src, entry.imagePath);
    assert.equal(artwork.visual.width, entry.width);
    assert.equal(artwork.visual.height, entry.height);
  }
});
