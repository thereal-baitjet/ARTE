# Browser screenshot evidence

`contact-sheet.jpg` preserves five actual Playwright screenshots as a 1200-pixel-wide contact sheet. Captures are proportionally resized, without cropping or content retouching. Panel labels identify mobile, tablet, desktop, large-desktop, and the museum artwork view. No generated imagery is used.

## Historical 90-record release verification run

On September 27, 2026, the complete release validation passed lint, typecheck, 43 unit tests, the production build, and all 48 browser tests with no failed, flaky, or skipped tests. Visual inspection then found an invisible primary CTA caused by an unlayered anchor color reset. The reset was moved into the CSS base layer and an actual computed-luminance contrast assertion (at least 4.5:1) was added.

The final follow-up passed lint, build, and all 10 foundation/release browser tests. These include four viewport sizes, the CTA contrast regression, WCAG 2 A/AA and WCAG 2.1 A/AA axe checks across six routes, overflow/console checks, and health/security headers. The four landing panels come from this final follow-up. The museum artwork panel comes from the successful full run before the anchor-only CSS correction; it verifies the local image, artist attribution, source, and rights presentation.

Both sets of screenshots were visually inspected. This evidence does not claim hosted Supabase or production Vercel verification.

## Original capture provenance

| Panel | Original pixels | Playwright attachment | Run | Original PNG SHA-256 |
| --- | --- | --- | --- | --- |
| mobile | 375 × 812 | `mobile-_` | Final contrast follow-up | `ecf08fed9d4aac5d00befd928c43acb28f87a004e4b4e7f0f914256e7f192498` |
| tablet | 768 × 1024 | `tablet-_` | Final contrast follow-up | `50ec22f379d8182bd5e70dc31254dd374d8cae1746aa8b8e4f388f855b97fabd` |
| desktop | 1440 × 900 | `desktop-_` | Final contrast follow-up | `cb9d251f363e482993ae3a06c0b3e5e0b85c34dd9ae0e14ebb8e4eb528d784b8` |
| large-desktop | 1920 × 1080 | `large-desktop-_` | Final contrast follow-up | `e613ccabe46fc4bee210f6b2c342eb807227a2a25e6bc03d9219ac11edb1f969` |
| museum artwork | 1280 × 2113 | `museum-artwork` | Full 48-test run | `d29a39fc580c06f218925f278aa3ea987da76812473f32d184c899dba7efe3a9` |

Local execution logs: `/tmp/arte-final-validation.log` and `/tmp/arte-contrast-validation.log`. Logs and original report directories are transient execution evidence; the contact sheet is retained here for version control.


## Historical 500-work asset sample

An intermediate forty-image sample (twenty Met, twenty Cleveland) decoded and was visually inspected. The earlier 1600×4993 PNG had SHA-256 `b433ac763bdacc623318360d266bf4acb623c6798e29c28962eb2ab97e158686`. The current four-source JPEG below supersedes that unpublished intermediate artifact; the old source-count claim is not current release evidence.

## Current 1,000-work catalog asset sample

[`catalog-1000-contactsheet.jpg`](catalog-1000-contactsheet.jpg) is a direct Chromium JPEG screenshot of 48 actual imported images, 12 per source, including every MoMA selection. Columns run Met, Cleveland, NGA, and MoMA. Captions come from the generated catalog; full source IDs are recorded below. The sample includes two preserved local Cleveland works and ten newer remote Cleveland records, all ten NGA classifications, and varied Met categories. Three separate sixteen-image views were visually inspected at readable resolution.

Local image panels read checked-in WebP files. Remote panels read the original verified JPEG bytes in ignored Cleveland/NGA import caches; their SHA-256 hashes matched the source manifests before rendering. All 48 decoded with dimensions matching the catalog, with zero page/request errors. No broken/error-page image, display cropping, or obvious title/subject mismatch was found. Source photographs may include frames, object details, or original framing. No image was retouched, cropped, or generated; the renderer uses `object-fit: contain`.

This is a verification-only local HTML page rendered using Playwright and `/tmp/arte-chromium`, not the production app. It verifies sampled image bytes, not expert attribution authenticity, all 1,000 images, current remote-CDN availability, the final product interface, database execution, or Vercel deployment. Product/browser/deployment gates remain separately recorded in [GAUNTLET](../GAUNTLET.md).

Captured JPEG: **1600×5455 pixels**, **1,387,479 bytes**, SHA-256 `3303ede95f6e845d713011fc112fb720ad64c4599b43a37dbb75740158cc9a51`. The combined manifest records 1,000 real works, 696 source-qualified artist identities, 71 category labels, 512 local images, 488 remote images, and twelve separate legacy fixtures.

| Panel | Source | Object ID | Artwork | Image bytes used |
| --- | --- | ---: | --- | --- |
| 1 | MET | 336327 | Corridor in the Asylum | local WebP |
| 2 | CLEVELAND | 75763 | Procession or Pardon at Perros-Guirec | local WebP |
| 3 | NGA | 1436 | Inkwell in the Form of a Grotesque Head | cached verified remote JPEG |
| 4 | MOMA | 79802 | The Starry Night | local WebP |
| 5 | MET | 333813 | Édouard Manet, Seated, Holding His Hat | local WebP |
| 6 | CLEVELAND | 144303 | Adoration of the Magi | local WebP |
| 7 | NGA | 1437 | Chalice of the Abbot Suger of Saint-Denis | cached verified remote JPEG |
| 8 | MOMA | 79277 | The Dream | local WebP |
| 9 | MET | 437430 | By the Seashore | local WebP |
| 10 | CLEVELAND | 95327 | Small Sword | cached verified remote JPEG |
| 11 | NGA | 207 | Sir John Reade, Baronet | cached verified remote JPEG |
| 12 | MOMA | 80172 | The Sleeping Gypsy | local WebP |
| 13 | MET | 191803 | Adam | local WebP |
| 14 | CLEVELAND | 97847 | Jar-shaped Basket | cached verified remote JPEG |
| 15 | NGA | 12210 | Embroideries | cached verified remote JPEG |
| 16 | MOMA | 78296 | The Bather | local WebP |
| 17 | MET | 336386 | Goose | local WebP |
| 18 | CLEVELAND | 138885 | Hours of Queen Isabella the Catholic, Queen of Spain | cached verified remote JPEG |
| 19 | NGA | 1 | Saint Paul and a Group of Worshippers | cached verified remote JPEG |
| 20 | MOMA | 78486 | Still Life with Apples | local WebP |
| 21 | MET | 204758 | Perseus with the Head of Medusa | local WebP |
| 22 | CLEVELAND | 79577 | Single-column Calligraphy (Bright Moon and Fresh Breath as One . . . ) | cached verified remote JPEG |
| 23 | NGA | 71832 | The Lone Lagoon | cached verified remote JPEG |
| 24 | MOMA | 79333 | Evening, Honfleur | local WebP |
| 25 | MET | 9480 | Vase | local WebP |
| 26 | CLEVELAND | 128056 | Louis XV Savonnerie Carpet with Royal Arms | cached verified remote JPEG |
| 27 | NGA | 3920 | Saint Jerome | cached verified remote JPEG |
| 28 | MOMA | 79409 | Grandcamp, Evening | local WebP |
| 29 | MET | 337071 | Pink and Rose | local WebP |
| 30 | CLEVELAND | 74788 | Vase | cached verified remote JPEG |
| 31 | NGA | 579 | Virtus Combusta: An Allegory of Virtue | cached verified remote JPEG |
| 32 | MOMA | 80354 | The Channel at Gravelines, Evening | local WebP |
| 33 | MET | 14945 | Woven piece | local WebP |
| 34 | CLEVELAND | 119571 | Shilling | cached verified remote JPEG |
| 35 | NGA | 119 | Madonna and Child | cached verified remote JPEG |
| 36 | MOMA | 78616 | Still Life with Three Puppies | local WebP |
| 37 | MET | 11122 | The Gulf Stream | local WebP |
| 38 | CLEVELAND | 167689 | Cigarette Case | cached verified remote JPEG |
| 39 | NGA | 4876 | Mahana Atua (Day of the Gods) [recto] | cached verified remote JPEG |
| 40 | MOMA | 79792 | Hope, II | local WebP |
| 41 | MET | 12116 | In the Generalife | local WebP |
| 42 | CLEVELAND | 167457 | Scent Bottle and Box in the Form of a Woman | cached verified remote JPEG |
| 43 | NGA | 2432 | Les liasons dangereuses (volume I) | cached verified remote JPEG |
| 44 | MOMA | 80013 | The Olive Trees | local WebP |
| 45 | MET | 13206 | 40 and 50 (Man and Woman Seated) (from Sketchbook) | local WebP |
| 46 | CLEVELAND | 170221 | The Seed Received among the Thorns, from the Parable of the Sower | cached verified remote JPEG |
| 47 | NGA | 590 | Two Children Wearing Helmets | cached verified remote JPEG |
| 48 | MOMA | 79105 | Portrait of Joseph Roulin | local WebP |

Local review scripts/HTML and original sixteen-panel captures are transient verification files; the compact full contact sheet is retained in source control.
