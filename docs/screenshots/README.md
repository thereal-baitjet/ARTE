# Browser screenshot evidence

`contact-sheet.jpg` preserves five actual Playwright screenshots as a 1200-pixel-wide contact sheet. Captures are proportionally resized, without cropping or content retouching. Panel labels identify mobile, tablet, desktop, large-desktop, and the museum artwork view. No generated imagery is used.

## Verification run

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
