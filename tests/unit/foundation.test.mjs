import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("landing page preserves the core product promise", async () => {
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Discover art that discovers you\./);
});

test("design tokens include the required primary palette", async () => {
  const css = await readFile(new URL("../../app/globals.css", import.meta.url), "utf8");
  for (const value of ["#f5f2eb", "#fafaf8", "#111111", "#292929", "#77736b", "#6a1f2b", "#a48b59"]) {
    assert.match(css, new RegExp(value));
  }
});

test("placeholder artwork copy does not make a rights claim", async () => {
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /no artwork or rights claim is implied/i);
});
