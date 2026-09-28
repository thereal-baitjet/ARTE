import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CLEVELAND_ARTWORKS } from "../../lib/artworks/clevelandArtworks.ts";

type SourceRecord = {
  id: number;
  accession_number: string;
  share_license_status: string;
  copyright: string | null;
  url: string;
  images: { web: { url: string } };
  _verifiedAt: string;
  _datasetSource: { commit: string; dataSha256: string };
  _imageEvidence: { url: string; sha256: string; sizeBytes: number; width?: number; height?: number; format?: string; normalizedSha256?: string };
};
type ImageRecord = { id: string; objectId: number; imagePath: string; imageSha256: string; normalizedImageSha256?: string; delivery?: string; sizeBytes: number; width: number; height: number; sourceUrl: string; imageSourceUrl: string; license: string };
type Manifest = { realArtworkCount: number; dataset: { commit: string; dataSha256: string }; artworks: ImageRecord[] };

test("Cleveland works retain explicit CC0 clearance and pinned official dataset provenance", async () => {
  const sources: SourceRecord[] = JSON.parse(await readFile(new URL("../../lib/artworks/data/cleveland-source-records.json", import.meta.url), "utf8"));
  const manifest: Manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/cleveland-catalog-manifest.json", import.meta.url), "utf8"));
  assert.equal(CLEVELAND_ARTWORKS.length, manifest.realArtworkCount);
  assert.equal(sources.length, manifest.realArtworkCount);
  assert.equal(new Set(CLEVELAND_ARTWORKS.map(({ id }) => id)).size, manifest.realArtworkCount);
  assert.match(manifest.dataset.commit, /^[a-f0-9]{40}$/);
  assert.match(manifest.dataset.dataSha256, /^[a-f0-9]{64}$/);
  const byId = new Map(sources.map((source) => [source.id, source]));
  for (const entry of manifest.artworks) {
    const source = byId.get(entry.objectId);
    assert.ok(source);
    assert.equal(source.share_license_status, "CC0");
    assert.ok(!source.copyright);
    assert.equal(source._datasetSource.commit, manifest.dataset.commit);
    assert.equal(source._datasetSource.dataSha256, manifest.dataset.dataSha256);
    assert.ok(Number.isFinite(Date.parse(source._verifiedAt)));
    const sourceUrl = new URL(source.url);
    assert.ok(["clevelandart.org", "www.clevelandart.org"].includes(sourceUrl.hostname));
    assert.equal(decodeURIComponent(sourceUrl.pathname), `/art/${source.accession_number}`);
    assert.equal(entry.sourceUrl, source.url);
    assert.equal(source._imageEvidence.url, source.images.web.url);
    assert.equal(entry.imageSourceUrl, source.images.web.url);
    assert.equal(new URL(entry.imageSourceUrl).hostname, "openaccess-cdn.clevelandart.org");
    assert.match(source._imageEvidence.sha256, /^[a-f0-9]{64}$/);
    assert.ok(source._imageEvidence.sizeBytes > 1000);
    const artwork = CLEVELAND_ARTWORKS.find(({ id }) => id === entry.id);
    assert.ok(artwork);
    assert.equal(artwork.isDemo, false);
    assert.equal(artwork.rights.license, "CC0 1.0 Universal");
    assert.equal(artwork.rights.sourceUrl, source.url);
    assert.equal(artwork.museum?.name, "Cleveland Museum of Art");
  }
});

test("Cleveland local assets and remote download evidence match their manifest without duplicate images", async () => {
  const manifest: Manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/cleveland-catalog-manifest.json", import.meta.url), "utf8"));
  const met: Manifest = JSON.parse(await readFile(new URL("../../lib/artworks/data/met-catalog-manifest.json", import.meta.url), "utf8"));
  const sources: SourceRecord[] = JSON.parse(await readFile(new URL("../../lib/artworks/data/cleveland-source-records.json", import.meta.url), "utf8"));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const hashes = new Set(met.artworks.map(({ imageSha256 }) => imageSha256));
  for (const image of manifest.artworks) {
    const artwork = CLEVELAND_ARTWORKS.find(({ id }) => id === image.id);
    assert.ok(artwork?.visual.kind === "image");
    assert.equal(artwork.visual.src, image.imagePath);
    assert.equal(artwork.visual.width, image.width);
    assert.equal(artwork.visual.height, image.height);
    if (image.delivery === "remote") {
      const evidence = sourceById.get(image.objectId)?._imageEvidence;
      assert.ok(evidence);
      assert.equal(image.imagePath, image.imageSourceUrl);
      assert.equal(new URL(image.imagePath).protocol, "https:");
      assert.equal(new URL(image.imagePath).hostname, "openaccess-cdn.clevelandart.org");
      assert.equal(image.imageSha256, evidence.sha256);
      assert.equal(image.sizeBytes, evidence.sizeBytes);
      assert.equal(image.width, evidence.width);
      assert.equal(image.height, evidence.height);
      assert.equal(evidence.format, "jpeg");
      assert.equal(image.normalizedImageSha256, evidence.normalizedSha256);
      assert.match(image.normalizedImageSha256!, /^[a-f0-9]{64}$/);
    } else {
      const bytes = await readFile(new URL(`../../public${image.imagePath}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), image.imageSha256);
      assert.equal(bytes.length, image.sizeBytes);
      assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
      assert.ok(image.width <= 1280);
      assert.ok(image.height <= 1600);
    }
    assert.ok(image.width > 0 && image.height > 0);
    const normalizedHash = image.normalizedImageSha256 ?? image.imageSha256;
    assert.equal(hashes.has(normalizedHash), false);
    hashes.add(normalizedHash);
  }
});
