import assert from "node:assert/strict";
import test from "node:test";
import { museumProviderForSourceUrl, museumSourceLabel } from "../../lib/artworks/providers.ts";

test("museum source guides follow the actual object URL rather than assuming The Met", () => {
  assert.equal(museumProviderForSourceUrl("https://www.metmuseum.org/art/collection/search/336327")?.id, "met");
  assert.equal(museumProviderForSourceUrl("https://clevelandart.org/art/1940.76")?.id, "cleveland");
  assert.equal(museumProviderForSourceUrl("https://www.clevelandart.org/art/1940.76")?.guideUrl, "/sources/cleveland");
  assert.equal(museumProviderForSourceUrl("https://openaccess-api.clevelandart.org/api/artworks/123")?.name, "Cleveland Museum of Art");
  assert.equal(museumProviderForSourceUrl("https://www.nga.gov/collection/art-object-page.61379.html")?.id, "nga");
  assert.equal(museumProviderForSourceUrl("https://www.moma.org/collection/works/79802")?.guideUrl, "/sources/moma");
  assert.equal(museumSourceLabel("https://www.moma.org/collection/works/79802"), "MoMA · Public-domain image");
});

test("unknown, insecure, lookalike and synthetic sources cannot acquire a museum badge", () => {
  for (const url of ["/sources/demo", "not-a-url", "http://www.clevelandart.org/art/1940.76", "https://www.clevelandart.org.example.com/art/1940.76", "https://example.com/?source=metmuseum.org", "javascript:alert(1)"]) assert.equal(museumProviderForSourceUrl(url), null);
});
