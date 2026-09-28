/** Validate independent Commons image rights separately from MoMA's CC0 metadata. */
import assert from 'node:assert/strict';

export const MOMA_DATASET_COMMIT = '3053da6addd4d210b955021f410430ac3bbf18d4';
export const MOMA_DATASET_SHA256 = '288d65589d7dadec509984c50f726454be4bbe00e68e61cf7d6116713a408807';
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function validateMomaRecord(record) {
  const official = record?.moma;
  const evidence = record?._commonsEvidence;
  const identity = record?._identityEvidence;
  assert.ok(official && evidence && identity, 'MoMA needs both official metadata and independent Commons image evidence');
  assert.ok(Number.isSafeInteger(record.id) && record.id > 0, 'Invalid MoMA object ID');
  assert.equal(record.id, official.ObjectID, 'Official MoMA object mismatch');
  assert.equal(record.id, identity.objectId, 'Curated image identity mismatch');
  assert.equal(official.URL, `https://www.moma.org/collection/works/${record.id}`, 'Canonical MoMA URL mismatch');
  assert.equal(official.Classification, 'Painting', 'Only curated two-dimensional paintings are accepted');
  assert.equal(official.Cataloged, 'Y', 'MoMA catalog approval missing');
  assert.equal(official.Artist?.length, 1, 'A single documented creator is required');
  assert.equal(official.ConstituentID?.length, 1, 'Official creator identity missing');
  assert.equal(official.EndDate?.length, 1, 'Official creator death date missing');
  assert.ok(official.EndDate.every(year => Number.isInteger(year) && year > 0 && year < 1926), 'Creator must have died more than 100 years before this release');
  const years = String(official.Date).match(/\b(?:18|19)\d{2}\b/g)?.map(Number);
  assert.ok(years?.length && Math.max(...years) < 1931, 'Creation before 1931 must be documented');
  const page = evidence.page;
  const info = page?.imageinfo?.[0];
  const revision = page?.revisions?.[0];
  const wiki = revision?.slots?.main?.['*'];
  const metadata = info?.extmetadata;
  assert.ok(info && revision && wiki && metadata, 'Complete Commons API evidence is required');
  assert.equal(page.title, identity.commonsTitle, 'Commons file identity mismatch');
  const apiUrl = new URL(evidence.apiUrl);
  assert.ok(apiUrl.protocol === 'https:' && apiUrl.hostname === 'commons.wikimedia.org' && apiUrl.pathname === '/w/api.php' && apiUrl.searchParams.get('titles') === page.title, 'Per-file Commons metadata API URL mismatch');
  assert.match(identity.wikidata, /^Q[1-9]\d*$/, 'Wikidata identity missing');
  assert.ok(wiki.includes(identity.wikidata), 'Commons work identity mismatch');
  assert.equal(metadata.LicenseShortName?.value, 'Public domain', 'Commons image is not explicitly public domain');
  assert.equal(String(metadata.Copyrighted?.value).toLowerCase(), 'false', 'Commons image is marked copyrighted or lacks copyright evidence');
  assert.equal(String(metadata.Restrictions?.value ?? '').trim(), '', 'Commons reuse restrictions present');
  assert.ok(wiki.includes('PD-Art'), 'Faithful two-dimensional reproduction evidence missing');
  assert.ok(metadata.Categories?.value.includes('PD-old-100-expired'), 'Expired copyright basis missing');
  assert.ok(metadata.Categories?.value.includes('Artworks digital representation of 2D work'), 'Two-dimensional work evidence missing');
  const lastName = normalize(official.Artist[0]).split(/\s+/).at(-1);
  assert.ok(normalize(metadata.Artist?.value).includes(lastName), 'Commons artist does not match MoMA');
  if (identity.supportingCommonsFile) {
    const supporting = identity.supportingCommonsPage;
    const supportingWiki = supporting?.revisions?.[0]?.slots?.main?.['*'];
    assert.equal(supporting?.title, identity.supportingCommonsFile, 'Supporting file identity mismatch');
    assert.ok(supportingWiki?.includes(identity.wikidata) && supportingWiki.includes(`Moma online|${record.id}`), 'Direct MoMA identity corroboration missing');
  } else {
    assert.ok(wiki.includes('Museum of Modern Art') || wiki.includes('moma.org'), 'Commons identifies a different collection');
  }
  assert.ok(typeof identity.identityBasis === 'string' && identity.identityBasis.length > 40, 'Curated object match rationale missing');
  assert.equal(evidence.pageId, page.pageid, 'Commons page ID mismatch');
  assert.equal(evidence.revisionId, revision.revid, 'Commons revision mismatch');
  assert.equal(evidence.permanentUrl, `https://commons.wikimedia.org/w/index.php?oldid=${revision.revid}`, 'Permanent source revision missing');
  assert.equal(evidence.filePageUrl, info.descriptionurl, 'Commons file page mismatch');
  const imageUrl = new URL(info.url);
  assert.ok(imageUrl.protocol === 'https:' && imageUrl.hostname === 'upload.wikimedia.org' && !imageUrl.username && !imageUrl.port && imageUrl.pathname.startsWith('/wikipedia/commons/'), 'Image must be independently sourced from Commons');
  assert.equal(record._imageEvidence?.url, info.url, 'Original image URL evidence mismatch');
  assert.equal(record._imageEvidence?.sha1, info.sha1, 'Original Commons image hash mismatch');
  assert.match(info.sha1, /^[a-f0-9]{40}$/, 'Original Commons SHA1 missing');
  assert.match(record._imageEvidence?.sha256 ?? '', /^[a-f0-9]{64}$/, 'Downloaded original SHA256 missing');
  assert.equal(record._imageEvidence?.sizeBytes, info.size, 'Original byte count mismatch');
  assert.ok(info.size > 0 && info.size <= 40 * 1024 * 1024, 'Original exceeds import bounds');
  assert.equal(record._datasetSource?.commit, MOMA_DATASET_COMMIT, 'Unpinned MoMA metadata');
  assert.equal(record._datasetSource?.dataSha256, MOMA_DATASET_SHA256, 'MoMA metadata snapshot hash mismatch');
  assert.ok(Number.isFinite(Date.parse(record._verifiedAt)), 'Verification date missing');
  assert.ok(Date.parse(revision.timestamp) <= Date.parse(record._verifiedAt), 'Commons revision postdates verification');
  for (const key of ['LicenseShortName', 'Copyrighted', 'Artist', 'Attribution', 'Credit', 'LicenseUrl']) {
    assert.deepEqual(evidence.requiredMetadataFields?.[key], metadata[key] ?? null, `Archived Commons ${key} differs from the response`);
  }
  return { official, info, metadata };
}
