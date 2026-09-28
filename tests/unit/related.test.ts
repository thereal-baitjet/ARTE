import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
import { getRelatedArtworkGroups } from "../../lib/recommendations/related.ts";
import { findSimilarArtworks } from "../../lib/recommendations/similarity.ts";
import type { SimilarityMode } from "../../lib/recommendations/types.ts";

const publicArtworks = DEMO_ARTWORKS.filter((artwork) => !artwork.isDemo);
const modes: SimilarityMode[] = ["visual", "mood", "movement", "palette", "unexpected"];

test("server related groups preserve each mode's ranked explanations and exclude the source", () => {
  const source = publicArtworks[0];
  assert.ok(source, "The release must have real museum artworks.");
  const groups = getRelatedArtworkGroups(source, DEMO_ARTWORKS);
  for (const mode of modes) {
    const expected = findSimilarArtworks(source, publicArtworks, mode, 4);
    assert.deepEqual(groups[mode].map((result) => result.artwork.id), expected.map((result) => result.artwork.id));
    assert.deepEqual(groups[mode].map((result) => result.connection), expected.map((result) => result.connection));
    assert.ok(groups[mode].length > 0 && groups[mode].length <= 4);
    assert.equal(new Set(groups[mode].map((result) => result.artwork.id)).size, groups[mode].length);
    assert.ok(groups[mode].every((result) => result.artwork.id !== source.id && publicArtworks.some((artwork) => artwork.id === result.artwork.id)));
    assert.ok(groups[mode].every((result) => result.connection.text.length > 0 && result.connection.signals.length > 0));
    assert.ok(groups[mode].every((result) => !("rights" in result.artwork) && !("description" in result.artwork) && !("features" in result.artwork)));
  }
});

test("legacy demo routes recommend only museum works, with a safe empty public catalog", () => {
  const source = DEMO_ARTWORKS.find((artwork) => artwork.isDemo);
  assert.ok(source);
  const groups = getRelatedArtworkGroups(source, DEMO_ARTWORKS);
  assert.ok(Object.values(groups).flat().every((result) => publicArtworks.some((artwork) => artwork.id === result.artwork.id)));
  assert.ok(Object.values(getRelatedArtworkGroups(source, [source])).every((results) => results.length === 0));
});

test("related payload stays bounded to 20 results for a 500-work catalog", () => {
  const catalog = Array.from({ length: 500 }, (_, index) => ({
    ...publicArtworks[index % publicArtworks.length],
    id: `museum-${index}`,
    slug: `museum-${index}`,
  }));
  const source = catalog[0];
  const groups = getRelatedArtworkGroups(source, catalog);
  const previousBytes = Buffer.byteLength(JSON.stringify({ source, candidates: catalog.filter((artwork) => artwork.id !== source.id) }));
  const currentBytes = Buffer.byteLength(JSON.stringify({ source, groups }));
  assert.equal(Object.values(groups).flat().length, 20);
  assert.ok(currentBytes < previousBytes * 0.08, `Expected at least 92% less serialized related data, got ${currentBytes}/${previousBytes} bytes.`);
});

test("missing palette, mood and composition metadata never implies a contrast", () => {
  const [source, candidate] = publicArtworks.slice(0, 2).map((artwork) => ({
    ...artwork,
    features: { ...artwork.features, palette: [], mood: [], composition: [], subjects: [] },
  }));
  for (const mode of ["palette", "mood", "unexpected", "visual"] as const) {
    const [result] = findSimilarArtworks(source, [candidate], mode);
    assert.match(result.connection.text, /metadata is unavailable/);
    assert.doesNotMatch(result.connection.text, /contrast|emotional register|visual rhythm/i);
    assert.ok(result.connection.signals.every((signal) => signal.key !== "contrast"));
    if (mode === "palette" || mode === "mood") assert.equal(result.score, 0);
    if (mode === "unexpected") assert.ok(result.score < 0.15, "Missing visual metadata must not earn the contrast bonus.");
  }
});

test("one-sided metadata gaps remain unknown while known differences remain contrast", () => {
  const first = publicArtworks[0];
  const source = { ...first, id: "known-source", features: { ...first.features, palette: ["red"], mood: ["calm"], composition: ["geometric"], subjects: [] } };
  const known = { ...source, id: "known-candidate", features: { ...source.features, palette: ["blue"], mood: ["energetic"], composition: ["organic"] } };
  const missing = { ...known, id: "unknown-candidate", features: { ...known.features, palette: [], mood: [], composition: [] } };
  for (const mode of ["palette", "mood", "unexpected"] as const) {
    const [knownResult] = findSimilarArtworks(source, [known], mode);
    assert.match(knownResult.connection.text, /contrast/);
    const [missingResult] = findSimilarArtworks(source, [missing], mode);
    assert.match(missingResult.connection.text, /metadata is unavailable/);
    assert.doesNotMatch(missingResult.connection.text, /contrast/);
  }
  const [knownUnexpected] = findSimilarArtworks(source, [known], "unexpected");
  assert.ok(knownUnexpected.score >= 0.7);
});

test("unexpected connections compare only available fields and do not call a full match contrast", () => {
  const first = publicArtworks[0];
  const source = { ...first, id: "source", features: { ...first.features, palette: ["red"], mood: [], composition: [], subjects: [] } };
  const candidate = { ...source, id: "candidate", features: { ...source.features, palette: ["blue"] } };
  const [partial] = findSimilarArtworks(source, [candidate], "unexpected");
  assert.match(partial.connection.text, /contrast in palette metadata/);
  assert.match(partial.connection.text, /Composition metadata is unavailable/);
  const [matching] = findSimilarArtworks(source, [{ ...source, id: "matching" }], "unexpected");
  assert.match(matching.connection.text, /shared palette metadata/);
  assert.doesNotMatch(matching.connection.text, /contrast/);
  assert.equal(matching.connection.signals[0].key, "discoveryScore");
});
