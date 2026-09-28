import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMomaRecord } from '../../scripts/moma-validate.mjs';
const records = JSON.parse(await readFile(new URL('../../lib/artworks/data/moma-source-records.json', import.meta.url), 'utf8'));

test('every curated MoMA image has separate archived public-domain and identity evidence', () => {
  assert.equal(records.length, 12);
  assert.equal(new Set(records.map(record => record.id)).size, 12);
  assert.equal(new Set(records.map(record => record._imageEvidence.sha256)).size, 12);
  for (const record of records) validateMomaRecord(record);
});

test('MoMA metadata CC0 cannot substitute for an independently public-domain image', () => {
  const altered = structuredClone(records[0]);
  altered._commonsEvidence.page.imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-NC 4.0';
  assert.throws(() => validateMomaRecord(altered), /not explicitly public domain/);
  const missing = structuredClone(records[0]);
  delete missing._commonsEvidence;
  assert.throws(() => validateMomaRecord(missing), /independent Commons image evidence/);
});

test('wrong museum work, unpinned metadata, and copyrighted reproductions fail closed', () => {
  for (const [modify, message] of [
    [record => { record.moma.ObjectID++; }, /object mismatch/],
    [record => { record._datasetSource.commit = 'unverified'; }, /Unpinned/],
    [record => { record._commonsEvidence.page.imageinfo[0].extmetadata.Copyrighted.value = 'True'; }, /marked copyrighted/],
    [record => { record._commonsEvidence.page.imageinfo[0].extmetadata.Categories.value = 'PD-Art'; }, /Expired copyright basis/],
    [record => { record._commonsEvidence.page.imageinfo[0].url = record.moma.ImageURL; }, /independently sourced from Commons/],
    [record => { record._imageEvidence.sha1 = '0'.repeat(40); }, /hash mismatch/],
    [record => { record.moma.EndDate = [1954]; }, /more than 100 years/],
    [record => { record._commonsEvidence.requiredMetadataFields.Attribution = {value:'Invented credit'}; }, /differs from the response/],
  ]) {
    const altered = structuredClone(records[0]);
    modify(altered);
    assert.throws(() => validateMomaRecord(altered), message);
  }
});
