import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { DEMO_ARTISTS, DEMO_ARTWORKS } from "../../lib/artworks/demoArtworks.ts";
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
