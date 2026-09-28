import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { CATALOG_PROVIDERS, combineCatalogManifests } from "../../scripts/build-catalog-manifest.mjs";
import { generateDatabaseCatalogTest } from "../../scripts/generate-database-catalog-test.mjs";

const momaFixture = JSON.parse(await readFile(new URL("../../lib/artworks/data/moma-source-records.json", import.meta.url), "utf8"))[0];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture() {
  const providers = {};
  const images = new Map();
  for (const [index, source] of Object.keys(CATALOG_PROVIDERS).entries()) {
    const config = CATALOG_PROVIDERS[source];
    const objectId = source === "moma" ? momaFixture.id : 7;
    const id = `${String(index + 1).repeat(8)}-0000-0000-0000-000000000007`;
    const artistId = `${String(index + 5).repeat(8)}-0000-0000-0000-000000000001`;
    const rawImage = sharp({ create: { width: 2, height: 3, channels: 3, background: ["#bb2222", "#2222aa", "#22aa22", "#bb9922"][index] } });
    const bytes = source === "nga" ? await rawImage.jpeg().toBuffer() : await rawImage.webp().toBuffer();
    const hash = digest(bytes);
    const sourceUrl = source === "met" ? `https://www.metmuseum.org/art/collection/search/${objectId}`
      : source === "cleveland" ? "https://clevelandart.org/art/2020.7"
        : source === "nga" ? `https://www.nga.gov/collection/art-object-page.${objectId}.html` : momaFixture.moma.URL;
    const imageUuid = "99999999-0000-0000-0000-000000000007";
    const imageUrl = source === "met" ? "https://images.metmuseum.org/CRDImages/7.jpg"
      : source === "cleveland" ? "https://openaccess-cdn.clevelandart.org/2020.7/2020.7_web.jpg"
        : source === "nga" ? `https://api.nga.gov/iiif/${imageUuid}/full/!843,843/0/default.jpg` : momaFixture._imageEvidence.url;
    const delivery = source === "nga" ? "remote" : "local";
    const imagePath = delivery === "remote" ? imageUrl : `/artworks/${source}-${objectId}.webp`;
    const verifiedAt = source === "moma" ? momaFixture._verifiedAt : "2026-09-27T22:00:00.000Z";
    const entry = { id, artistId, source, objectId, imagePath, imageSha256: hash, sizeBytes: bytes.length, verifiedAt, sourceUrl, delivery };
    const raw = source === "met"
      ? { objectID: objectId, isPublicDomain: true, rightsAndReproduction: "", objectURL: sourceUrl, primaryImageSmall: imageUrl }
      : source === "cleveland"
        ? { id: objectId, accession_number: "2020.7", share_license_status: "CC0", url: sourceUrl, images: { web: { url: imageUrl } } }
        : source === "nga"
          ? { id: objectId, sourceUrl, object: { objectid: String(objectId), accessioned: "1", isvirtual: "0" }, image: { depictstmsobjectid: String(objectId), uuid: imageUuid, iiifurl: `https://api.nga.gov/iiif/${imageUuid}`, openaccess: "1", viewtype: "primary" }, _datasetSource: { commit: "a".repeat(40) } }
          : structuredClone(momaFixture);
    if (source !== "moma") {
      raw._verifiedAt = verifiedAt;
      raw._imageEvidence = { url: imageUrl, sha256: hash, sizeBytes: bytes.length };
    }
    if (delivery === "remote") {
      const normalized = digest(await sharp(bytes).webp().toBuffer());
      raw._imageEvidence = { ...raw._imageEvidence, width: 2, height: 3, format: "jpeg", normalizedSha256: normalized };
      entry.normalizedImageSha256 = normalized;
    } else images.set(imagePath, bytes);
    const artwork = { id, isDemo: false, artist: { id: artistId }, museum: { name: config.sourceName }, rights: { license: config.license, sourceUrl }, visual: { kind: "image", src: imagePath, width: 2, height: 3 }, movement: "Painting", medium: "Oil", year: "1900" };
    providers[source] = { manifest: { schemaVersion: 1, generatedAt: verifiedAt, realArtworkCount: 1, sourceCounts: { [source]: 1 }, artworks: [entry] }, records: [raw], catalog: [artwork] };
  }
  return { providers, images };
}

function combine(input, minimumRealArtworkCount = 4) {
  return combineCatalogManifests({
    providers: input.providers,
    minimumRealArtworkCount,
    readImage: async (imagePath) => {
      assert.ok(input.images.has(imagePath), `Missing local image: ${imagePath}`);
      return input.images.get(imagePath);
    },
  });
}

test("combined manifest preserves source-qualified identities and verified derivative metadata", async () => {
  const result = await combine(await fixture());
  assert.equal(result.realArtworkCount, 4);
  assert.equal(result.totalArtworkCount, 16);
  assert.deepEqual(result.sourceCounts, { met: 1, cleveland: 1, nga: 1, moma: 1 });
  assert.equal(result.artistCount, 4);
  assert.equal(result.categoryCount, 1);
  assert.deepEqual(result.categoryCounts, { Painting: 4 });
  assert.deepEqual(result.sourceObjectIds, { met: [7], cleveland: [7], nga: [7], moma: [momaFixture.id] });
  assert.ok(result.artworks.every((entry) => entry.width === 2 && entry.height === 3 && entry.rightsState === "public_domain" && entry.license === CATALOG_PROVIDERS[entry.source].license));
});

test("combined release rejects a missing provider or fewer than the target real works", async () => {
  const missing = await fixture();
  delete missing.providers.cleveland;
  await assert.rejects(combine(missing), /all four supported source manifests/);
  await assert.rejects(combine(await fixture(), 1000), /minimum is 1000/);
});

test("combined release rejects duplicate UUIDs and exact image bytes across providers", async () => {
  const duplicateId = await fixture();
  duplicateId.providers.cleveland.manifest.artworks[0].id = duplicateId.providers.met.manifest.artworks[0].id;
  await assert.rejects(combine(duplicateId), /Duplicate artwork UUID/);
  const duplicateImage = await fixture();
  duplicateImage.providers.cleveland.manifest.artworks[0].imageSha256 = duplicateImage.providers.met.manifest.artworks[0].imageSha256;
  await assert.rejects(combine(duplicateImage), /Duplicate exact image/);
});

test("combined release rejects duplicate source identities within a provider", async () => {
  const input = await fixture();
  const met = input.providers.met;
  met.records.push(structuredClone(met.records[0]));
  met.catalog.push({ ...structuredClone(met.catalog[0]), id: "55555555-0000-0000-0000-000000000007" });
  met.manifest.artworks.push({ ...structuredClone(met.manifest.artworks[0]), id: met.catalog[1].id });
  met.manifest.realArtworkCount = 2;
  met.manifest.sourceCounts.met = 2;
  await assert.rejects(combine(input), /duplicate archived source identities/);
});

test("combined release rejects missing images, changed bytes and mismatched dimensions", async () => {
  const missing = await fixture();
  missing.images.delete("/artworks/cleveland-7.webp");
  await assert.rejects(combine(missing), /Missing local image/);
  const corrupt = await fixture();
  const bytes = Buffer.from(corrupt.images.get("/artworks/cleveland-7.webp"));
  bytes[bytes.length - 1] ^= 1;
  corrupt.images.set("/artworks/cleveland-7.webp", bytes);
  await assert.rejects(combine(corrupt), /local image hash mismatch/);
  const dimensions = await fixture();
  dimensions.providers.cleveland.catalog[0].visual.width = 0;
  await assert.rejects(combine(dimensions), /generated image width mismatch/);
});

test("combined release rejects restricted rights and unrelated source or image URLs", async () => {
  const restricted = await fixture();
  restricted.providers.cleveland.records[0].share_license_status = "Copyright";
  await assert.rejects(combine(restricted), /not cleared CC0 rights/);
  const copyrighted = await fixture();
  copyrighted.providers.cleveland.records[0].copyright = "All rights reserved";
  await assert.rejects(combine(copyrighted), /copyright restrictions/);
  const source = await fixture();
  source.providers.cleveland.manifest.artworks[0].sourceUrl = "https://clevelandart.org.evil.example/art/7";
  source.providers.cleveland.catalog[0].rights.sourceUrl = source.providers.cleveland.manifest.artworks[0].sourceUrl;
  await assert.rejects(combine(source), /official clevelandart.org domain/);
  const image = await fixture();
  image.providers.met.records[0]._imageEvidence.sourceUrl = "https://images.metmuseum.org/unrelated.jpg";
  await assert.rejects(combine(image), /not from the archived object/);
});

test("database catalog expectations preserve all six assertions across overlapping provider object IDs", async () => {
  const manifest = await combine(await fixture());
  const sql = generateDatabaseCatalogTest(manifest);
  assert.match(sql, /select plan\(6\)/);
  assert.equal((sql.match(/select results_eq\(/g) ?? []).length, 6);
  assert.match(sql, /unique \(source_name, source_artwork_id\)/);
  assert.ok(sql.includes("'The Metropolitan Museum of Art', '7', 'the-metropolitan-museum-of-art'"));
  assert.ok(sql.includes("'Cleveland Museum of Art', '7', 'cleveland-museum-of-art'"));
  assert.ok(sql.includes("'/artworks/met-7.webp'"));
  assert.ok(sql.includes("'/artworks/cleveland-7.webp'"));
  assert.ok(sql.includes("'National Gallery of Art', '7', 'national-gallery-of-art'"));
  assert.ok(sql.includes("'Public domain (NGA Open Access)'"));
  assert.ok(sql.includes("'Public domain'"));
  assert.match(sql, /i\.width = e\.image_width and i\.height = e\.image_height/);
  assert.doesNotMatch(sql, /where not a\.is_synthetic and s\.source_name =/);
});

test("remote releases require exact archived download hashes, dimensions and normalization evidence", async () => {
  const missingDimensions = await fixture();
  delete missingDimensions.providers.nga.records[0]._imageEvidence.width;
  await assert.rejects(combine(missingDimensions), /invalid image dimensions/);
  const changedHash = await fixture();
  changedHash.providers.nga.manifest.artworks[0].imageSha256 = "e".repeat(64);
  await assert.rejects(combine(changedHash), /remote image hash differs/);
  const changedSize = await fixture();
  changedSize.providers.nga.manifest.artworks[0].sizeBytes++;
  await assert.rejects(combine(changedSize), /remote image size differs/);
  const missingNormalized = await fixture();
  delete missingNormalized.providers.nga.records[0]._imageEvidence.normalizedSha256;
  await assert.rejects(combine(missingNormalized), /normalized remote image evidence missing/);
  const duplicateNormalized = await fixture();
  const metHash = duplicateNormalized.providers.met.manifest.artworks[0].imageSha256;
  duplicateNormalized.providers.nga.manifest.artworks[0].normalizedImageSha256 = metHash;
  duplicateNormalized.providers.nga.records[0]._imageEvidence.normalizedSha256 = metHash;
  await assert.rejects(combine(duplicateNormalized), /Duplicate normalized image/);
});

test("remote Cleveland images stay offline-verifiable and reject query-modified delivery URLs", async () => {
  const input = await fixture();
  const provider = input.providers.cleveland;
  const entry = provider.manifest.artworks[0];
  const raw = provider.records[0];
  const bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: "#4422bb" } }).jpeg().toBuffer();
  const normalizedSha256 = digest(await sharp(bytes).webp().toBuffer());
  entry.delivery = "remote";
  entry.imagePath = raw.images.web.url;
  entry.imageSha256 = digest(bytes);
  entry.sizeBytes = bytes.length;
  entry.normalizedImageSha256 = normalizedSha256;
  raw._imageEvidence = { url: entry.imagePath, sha256: entry.imageSha256, sizeBytes: bytes.length, width: 2, height: 3, format: "jpeg", normalizedSha256 };
  provider.catalog[0].visual.src = entry.imagePath;
  input.images.delete("/artworks/cleveland-7.webp");
  const result = await combine(input);
  assert.equal(result.artworks.filter((artwork) => artwork.delivery === "remote").length, 2);
  entry.imagePath += "?token=changed";
  raw.images.web.url = entry.imagePath;
  raw._imageEvidence.url = entry.imagePath;
  provider.catalog[0].visual.src = entry.imagePath;
  await assert.rejects(combine(input), /remote image URL must not contain query/);
});

test("NGA fair-use imagery and MoMA metadata licensing cannot substitute for image clearance", async () => {
  const nga = await fixture();
  nga.providers.nga.records[0].image.openaccess = "0";
  await assert.rejects(combine(nga), /NGA image is not cleared/);
  const moma = await fixture();
  moma.providers.moma.records[0]._commonsEvidence.page.imageinfo[0].extmetadata.Copyrighted.value = "True";
  await assert.rejects(combine(moma), /Commons image is marked copyrighted/);
  const wrongLicense = await fixture();
  wrongLicense.providers.moma.catalog[0].rights.license = "CC0 1.0 Universal";
  await assert.rejects(combine(wrongLicense), /image license does not match verified provider image rights/);
  const duplicateOriginal = await fixture();
  duplicateOriginal.providers.cleveland.records[0]._imageEvidence.sha256 = duplicateOriginal.providers.met.records[0]._imageEvidence.sha256;
  await assert.rejects(combine(duplicateOriginal), /Duplicate original image/);
});
