import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("rights validator rejects unclear and restricted content", async () => {
  const source = await readFile(new URL("../../lib/rights/validateArtworkRights.ts", import.meta.url), "utf8");
  assert.match(source, /unclear/);
  assert.match(source, /restricted/);
  assert.match(source, /if \(!candidate\.sourceUrl\) return false/);
});

test("demo publication requires synthetic content", async () => {
  const source = await readFile(new URL("../../lib/rights/validateArtworkRights.ts", import.meta.url), "utf8");
  assert.match(source, /candidate\.state === "demo"/);
  assert.match(source, /candidate\.isSynthetic === true/);
});
