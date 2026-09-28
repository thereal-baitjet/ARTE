/** Combine verified provider releases; --check verifies the checked-in release marker. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { validateMomaRecord } from "./moma-validate.mjs";

export const CATALOG_PROVIDERS = {
  met: { sourceName: "The Metropolitan Museum of Art", museumSlug: "the-metropolitan-museum-of-art", domain: "metmuseum.org", license: "CC0 1.0 Universal", rawFile: "lib/artworks/data/met-source-records.json", catalogFile: "lib/artworks/metArtworks.ts" },
  cleveland: { sourceName: "Cleveland Museum of Art", museumSlug: "cleveland-museum-of-art", domain: "clevelandart.org", license: "CC0 1.0 Universal", rawFile: "lib/artworks/data/cleveland-source-records.json", catalogFile: "lib/artworks/clevelandArtworks.ts" },
  nga: { sourceName: "National Gallery of Art", museumSlug: "national-gallery-of-art", domain: "nga.gov", license: "Public domain (NGA Open Access)", rawFile: "lib/artworks/data/nga-source-records.json", catalogFile: "lib/artworks/ngaArtworks.ts" },
  moma: { sourceName: "The Museum of Modern Art", museumSlug: "the-museum-of-modern-art", domain: "moma.org", license: "Public domain", rawFile: "lib/artworks/data/moma-source-records.json", catalogFile: "lib/artworks/momaArtworks.ts" },
};
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

function officialUrl(value, domain, label) {
  assert.equal(typeof value, "string", `${label} must be an official HTTPS URL`);
  const url = new URL(value);
  assert.ok(url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === domain || url.hostname.endsWith(`.${domain}`)), `${label} must use the official ${domain} domain`);
  return url;
}

function counts(artworks, field) {
  const result = new Map();
  for (const artwork of artworks) result.set(artwork[field], (result.get(artwork[field]) ?? 0) + 1);
  return Object.fromEntries([...result].sort(([left], [right]) => left.localeCompare(right)));
}

/** Inputs are provider manifests plus their archived records and generated catalogs. */
export async function combineCatalogManifests({ providers, readImage, minimumRealArtworkCount = 1000, syntheticFixtureCount = 12 }) {
  assert.ok(Number.isSafeInteger(minimumRealArtworkCount) && minimumRealArtworkCount > 0, "minimum catalog size must be positive");
  assert.ok(Number.isSafeInteger(syntheticFixtureCount) && syntheticFixtureCount >= 0, "synthetic fixture count must be nonnegative");
  assert.deepEqual(Object.keys(providers).sort(), Object.keys(CATALOG_PROVIDERS).sort(), "all four supported source manifests are required");
  const ids = new Set();
  const sourceIds = new Set();
  const imageHashes = new Map();
  const originalImageHashes = new Map();
  const normalizedImageHashes = new Map();
  const artworks = [];
  const catalog = [];
  const sourceCounts = {};
  const sourceObjectIds = {};
  const generatedDates = [];
  for (const [source, { manifest, records, catalog: sourceCatalog }] of Object.entries(providers)) {
    const config = CATALOG_PROVIDERS[source];
    assert.equal(manifest.schemaVersion, 1, `${source}: unsupported manifest version`);
    assert.ok(Array.isArray(manifest.artworks) && manifest.artworks.length > 0, `${source}: missing manifest artworks`);
    assert.equal(manifest.realArtworkCount, manifest.artworks.length, `${source}: manifest count mismatch`);
    assert.deepEqual(manifest.sourceCounts, { [source]: manifest.artworks.length }, `${source}: source count mismatch`);
    assert.ok(Number.isFinite(Date.parse(manifest.generatedAt)), `${source}: generation timestamp missing`);
    generatedDates.push(manifest.generatedAt);
    assert.equal(records.length, manifest.artworks.length, `${source}: archived source count mismatch`);
    assert.equal(sourceCatalog.length, manifest.artworks.length, `${source}: generated catalog count mismatch`);
    const rawById = new Map(records.map((record) => [source === "met" ? record.objectID : record.id, record]));
    const artworkById = new Map(sourceCatalog.map((artwork) => [artwork.id, artwork]));
    assert.equal(rawById.size, records.length, `${source}: duplicate archived source identities`);
    assert.equal(artworkById.size, sourceCatalog.length, `${source}: duplicate generated artwork identities`);
    sourceCounts[source] = manifest.artworks.length;
    sourceObjectIds[source] = [];
    for (const entry of manifest.artworks) {
      assert.equal(entry.source, source, `${source}: incorrect record source`);
      assert.match(entry.id, UUID, `${source}: artwork ID must be a UUID`);
      assert.match(entry.artistId, UUID, `${source}: artist ID must be a UUID`);
      assert.ok(Number.isSafeInteger(entry.objectId) && entry.objectId > 0, `${source}: invalid object ID`);
      const identity = `${source}:${entry.objectId}`;
      assert.ok(!ids.has(entry.id), `Duplicate artwork UUID: ${entry.id}`);
      assert.ok(!sourceIds.has(identity), `Duplicate source identity: ${identity}`);
      ids.add(entry.id);
      sourceIds.add(identity);
      const raw = rawById.get(entry.objectId);
      const artwork = artworkById.get(entry.id);
      assert.ok(raw && artwork, `${identity}: source or generated artwork is missing`);
      assert.equal(artwork.isDemo, false, `${identity}: synthetic work cannot enter the public catalog`);
      assert.equal(artwork.artist.id, entry.artistId, `${identity}: artist identity mismatch`);
      assert.equal(artwork.museum?.name, config.sourceName, `${identity}: museum attribution mismatch`);
      assert.equal(artwork.rights.license, config.license, `${identity}: image license does not match verified provider image rights`);
      assert.equal(artwork.rights.sourceUrl, entry.sourceUrl, `${identity}: artwork source URL mismatch`);
      const sourceUrl = officialUrl(entry.sourceUrl, config.domain, `${identity} source URL`);
      assert.ok(!sourceUrl.search && !sourceUrl.hash, `${identity}: object source URL must not contain query parameters or fragments`);
      if (source === "met") {
        assert.equal(raw.isPublicDomain, true, `${identity}: source has not cleared public-domain rights`);
        assert.equal(String(raw.rightsAndReproduction ?? "").trim(), "", `${identity}: source rights restrictions are present`);
        assert.equal(entry.sourceUrl, `https://www.metmuseum.org/art/collection/search/${entry.objectId}`, `${identity}: incorrect Met object URL`);
        assert.equal(raw.objectURL, entry.sourceUrl, `${identity}: archived source URL mismatch`);
      } else if (source === "cleveland") {
        assert.equal(raw.share_license_status, "CC0", `${identity}: source has not cleared CC0 rights`);
        assert.equal(String(raw.copyright ?? "").trim(), "", `${identity}: source copyright restrictions are present`);
        assert.ok(["clevelandart.org", "www.clevelandart.org"].includes(sourceUrl.hostname), `${identity}: incorrect Cleveland object hostname`);
        assert.equal(decodeURIComponent(sourceUrl.pathname.replace(/\/$/, "")), `/art/${raw.accession_number}`, `${identity}: incorrect Cleveland accession URL`);
        assert.equal(raw.url, entry.sourceUrl, `${identity}: archived source URL mismatch`);
      } else if (source === "nga") {
        assert.equal(raw.object?.objectid, String(entry.objectId), `${identity}: NGA object identity mismatch`);
        assert.equal(raw.image?.depictstmsobjectid, String(entry.objectId), `${identity}: NGA image/object join mismatch`);
        assert.equal(raw.object?.accessioned, "1", `${identity}: NGA object is not accessioned`);
        assert.equal(raw.object?.isvirtual, "0", `${identity}: NGA virtual object is not publishable`);
        assert.equal(raw.image?.openaccess, "1", `${identity}: NGA image is not cleared for open access`);
        assert.equal(raw.image?.viewtype, "primary", `${identity}: NGA image must be the primary view`);
        assert.equal(entry.sourceUrl, `https://www.nga.gov/collection/art-object-page.${entry.objectId}.html`, `${identity}: incorrect NGA object URL`);
        assert.equal(raw.sourceUrl, entry.sourceUrl, `${identity}: archived NGA source URL mismatch`);
        assert.match(raw.image?.uuid ?? "", UUID, `${identity}: invalid NGA image UUID`);
        assert.equal(raw.image.iiifurl, `https://api.nga.gov/iiif/${raw.image.uuid}`, `${identity}: NGA image source mismatch`);
        assert.match(raw._datasetSource?.commit ?? "", /^[a-f0-9]{40}$/, `${identity}: pinned NGA dataset commit missing`);
      } else {
        validateMomaRecord(raw);
        assert.equal(entry.sourceUrl, raw.moma.URL, `${identity}: archived MoMA source URL mismatch`);
      }
      const imageEvidence = raw._imageEvidence;
      assert.ok(imageEvidence, `${identity}: archived image evidence missing`);
      const imageSourceUrl = imageEvidence.sourceUrl ?? imageEvidence.url;
      const imageUrl = officialUrl(imageSourceUrl, source === "moma" ? "wikimedia.org" : config.domain, `${identity} image URL`);
      const imageHosts = { met: "images.metmuseum.org", cleveland: "openaccess-cdn.clevelandart.org", nga: "api.nga.gov", moma: "upload.wikimedia.org" };
      assert.equal(imageUrl.hostname, imageHosts[source], `${identity}: image must come from the verified source image host`);
      const sourceImages = source === "met"
        ? [raw.primaryImage, raw.primaryImageSmall].filter(Boolean)
        : source === "cleveland"
          ? Object.values(raw.images ?? {}).map((image) => image?.url).filter(Boolean)
          : source === "nga"
            ? [`${raw.image.iiifurl}/full/!843,843/0/default.jpg`]
            : [raw._commonsEvidence.page.imageinfo[0].url];
      assert.ok(sourceImages.includes(imageSourceUrl), `${identity}: image evidence is not from the archived object`);
      assert.match(imageEvidence.sha256, SHA256, `${identity}: original image hash missing`);
      assert.ok(!originalImageHashes.has(imageEvidence.sha256), `Duplicate original image: ${identity} and ${originalImageHashes.get(imageEvidence.sha256)}`);
      originalImageHashes.set(imageEvidence.sha256, identity);
      assert.ok(Number.isSafeInteger(imageEvidence.sizeBytes) && imageEvidence.sizeBytes > 0, `${identity}: original image size missing`);
      assert.equal(entry.verifiedAt, raw._verifiedAt, `${identity}: verification timestamp mismatch`);
      assert.ok(Number.isFinite(Date.parse(entry.verifiedAt)), `${identity}: invalid verification timestamp`);
      assert.equal(artwork.visual.kind, "image", `${identity}: artwork has no displayable image`);
      assert.equal(artwork.visual.src, entry.imagePath, `${identity}: generated image path mismatch`);
      assert.match(entry.imageSha256, SHA256, `${identity}: delivered image hash missing`);
      assert.ok(!imageHashes.has(entry.imageSha256), `Duplicate exact image: ${identity} and ${imageHashes.get(entry.imageSha256)}`);
      imageHashes.set(entry.imageSha256, identity);
      const delivery = entry.delivery ?? "local";
      assert.ok(["local", "remote"].includes(delivery), `${identity}: unsupported image delivery`);
      let width, height, normalizedImageSha256;
      if (delivery === "remote") {
        assert.ok(source === "cleveland" || source === "nga", `${identity}: remote image delivery is not approved for this provider`);
        assert.ok(!imageUrl.search && !imageUrl.hash, `${identity}: remote image URL must not contain query parameters or fragments`);
        assert.equal(entry.imagePath, imageSourceUrl, `${identity}: remote image must use the verified source URL`);
        assert.equal(entry.imageSha256, imageEvidence.sha256, `${identity}: remote image hash differs from archived download evidence`);
        assert.equal(entry.sizeBytes, imageEvidence.sizeBytes, `${identity}: remote image size differs from archived download evidence`);
        assert.equal(imageEvidence.format, "jpeg", `${identity}: remote image must be a verified JPEG`);
        width = imageEvidence.width;
        height = imageEvidence.height;
        assert.match(imageEvidence.normalizedSha256 ?? "", SHA256, `${identity}: normalized remote image evidence missing`);
        assert.equal(entry.normalizedImageSha256, imageEvidence.normalizedSha256, `${identity}: normalized remote image hash mismatch`);
        normalizedImageSha256 = imageEvidence.normalizedSha256;
      } else {
        assert.equal(entry.imagePath, `/artworks/${source}-${entry.objectId}.webp`, `${identity}: invalid local image path`);
        const bytes = await readImage(entry.imagePath);
        assert.equal(bytes.length, entry.sizeBytes, `${identity}: local image size mismatch`);
        assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.imageSha256, `${identity}: local image hash mismatch`);
        const metadata = await sharp(bytes).metadata();
        assert.equal(metadata.format, "webp", `${identity}: local image must be WebP`);
        width = metadata.width;
        height = metadata.height;
        normalizedImageSha256 = entry.imageSha256;
        if (entry.normalizedImageSha256 !== undefined) assert.equal(entry.normalizedImageSha256, normalizedImageSha256, `${identity}: local normalized image hash mismatch`);
      }
      assert.ok(Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0, `${identity}: invalid image dimensions`);
      assert.equal(artwork.visual.width, width, `${identity}: generated image width mismatch`);
      assert.equal(artwork.visual.height, height, `${identity}: generated image height mismatch`);
      assert.ok(!normalizedImageHashes.has(normalizedImageSha256), `Duplicate normalized image: ${identity} and ${normalizedImageHashes.get(normalizedImageSha256)}`);
      normalizedImageHashes.set(normalizedImageSha256, identity);
      const enriched = { ...entry, delivery, width, height, normalizedImageSha256, imageSourceUrl, rightsState: "public_domain", license: config.license, sourceName: config.sourceName, museumSlug: config.museumSlug };
      for (const field of ["width", "height", "imageSourceUrl", "rightsState", "license", "sourceName", "museumSlug"]) {
        if (entry[field] !== undefined) assert.equal(entry[field], enriched[field], `${identity}: manifest ${field} mismatch`);
      }
      artworks.push(enriched);
      catalog.push(artwork);
      sourceObjectIds[source].push(entry.objectId);
    }
  }
  assert.ok(artworks.length >= minimumRealArtworkCount, `Catalog has ${artworks.length} real artworks; minimum is ${minimumRealArtworkCount}`);
  const categoryCounts = counts(catalog, "movement");
  return {
    schemaVersion: 1,
    generatedAt: generatedDates.sort((left, right) => Date.parse(left) - Date.parse(right)).at(-1),
    realArtworkCount: artworks.length,
    syntheticFixtureCount,
    totalArtworkCount: artworks.length + syntheticFixtureCount,
    sourceCounts,
    artistCount: new Set(catalog.map((artwork) => artwork.artist.id)).size,
    categoryCount: Object.keys(categoryCounts).length,
    categoryCounts,
    mediumCounts: counts(catalog, "medium"),
    dateCounts: counts(catalog, "year"),
    sourceObjectIds,
    artworks,
  };
}

function parseGeneratedCatalog(text) {
  const assignment = text.indexOf("= [");
  assert.ok(assignment >= 0, "Generated artwork catalog must contain a JSON array assignment");
  return JSON.parse(text.slice(assignment + 2).trim().replace(/;$/, ""));
}

export async function buildCatalogManifest(root, { check = false, target = 1000 } = {}) {
  assert.ok(Number.isSafeInteger(target) && target >= 1000, "Combined release target must be at least 1000 real artworks");
  const providers = {};
  for (const [source, config] of Object.entries(CATALOG_PROVIDERS)) {
    providers[source] = {
      manifest: JSON.parse(await readFile(path.join(root, `lib/artworks/data/${source}-catalog-manifest.json`), "utf8")),
      records: JSON.parse(await readFile(path.join(root, config.rawFile), "utf8")),
      catalog: parseGeneratedCatalog(await readFile(path.join(root, config.catalogFile), "utf8")),
    };
  }
  const manifest = await combineCatalogManifests({ providers, readImage: (imagePath) => readFile(path.join(root, "public", imagePath)), minimumRealArtworkCount: target });
  assert.equal(manifest.realArtworkCount, target, "Combined catalog count must equal the requested release target");
  const output = path.join(root, "lib/artworks/data/catalog-manifest.json");
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  if (check) assert.equal(await readFile(output, "utf8"), content, "Combined catalog manifest is stale; run node scripts/build-catalog-manifest.mjs");
  else { await writeFile(`${output}.tmp`, content); await rename(`${output}.tmp`, output); }
  console.log(`${check ? "Verified" : "Built"} combined catalog: ${manifest.realArtworkCount} real artworks; ${JSON.stringify(manifest.sourceCounts)}`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const target = Number(process.argv.find((value) => value.startsWith("--target="))?.split("=")[1] ?? 1000);
  await buildCatalogManifest(root, { check: process.argv.includes("--check"), target });
}
