# Deploy ARTE to Vercel

## Current status

The prepared release contains 1,000 real artworks across Met 339, Cleveland 350, NGA 299, and MoMA 12, plus twelve legacy fixtures outside public browsing. Combined source/manifest validation has passed; consolidated application checks pass (87 unit and 65 browser tests); database/deployment gates remain pending at this pre-push checkpoint. Earlier GitHub-published revisions have successful application CI and a successful GitHub Vercel commit status, but observed deployment URLs and aliases redirect unauthenticated requests to Vercel login. A status success is not a public application smoke pass. See [GAUNTLET](GAUNTLET.md#1000-work-four-source-expansion--current-gate) for revision-specific evidence.

Image delivery combines 512 local files and 488 official remote images. The new Cleveland/NGA images are verified during import but served by museum CDNs at runtime; deployment checks must verify real remote-image decoding and source attribution. Their cache files are excluded from Git. Vercel installs/builds the checked-in catalog and does not run museum imports or require the large raw import caches.

## Guest release

1. Import https://github.com/thereal-baitjet/ARTE into the intended Vercel team.
2. Choose repository root `.` and the detected Next.js preset.
3. Use Node.js 22, `npm ci`, and `npm run build` (`vercel.json` supplies the commands).
4. Deploy without Supabase variables to make the guest gallery available. The UI must continue to disclose unavailable account services and demo commerce.
5. Check that the actual intended public URL returns application JSON from `/api/health`, with `catalog: "public-domain"` and integer `artworkCount >= 1000`. A redirect to login or HTML 200 is not healthy API output. Check home, search, discovery, real artwork/image/rights records from all four museums, collections, onboarding, taste, attention, market, and the fail-closed admin state. Repeat a save/reload and an inquiry-draft/reload test on the actual URL.
6. Record deployment URL, Vercel READY state, commit SHA, browser evidence, and runtime errors in GAUNTLET.md. A successful local build is not proof of deployment.

CLI alternative after authorized Vercel login:

```sh
npm run deploy:vercel
```

The helper opens local Vercel login, then deploys to `thereal-baitjets-projects`. On first use select/create project `arte` and keep root directory `./`. Run it from the updated ARTE checkout after the release changes have been applied. It does not provision Supabase or a paid integration.

For the packaged release, download `arte-release.zip`, then run these commands from the folder containing the download (Node.js 22 and npm required):

```sh
unzip arte-release.zip
cd ARTE
npm run deploy:vercel
```

Vercel installs the locked application dependencies and builds remotely. Complete login in your own browser; no successful passkey sign-in is assumed. The previously supplied ZIP describes the earlier release. Use a checkout or package of the final verified 1,000-work commit for this expansion; do not assume an older archive contains the new catalog.

## Hosted Supabase accounts

Create or choose an authorized Supabase project. Apply migrations and the reviewed seed, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the correct Vercel environment. They are public client configuration; never substitute the service-role key.

Set Supabase Auth Site URL to the production URL and allow only the specific intended callback URLs. Test a real magic link, session restore, sign-out, ownership isolation, collections, likes, and saves. Review RLS and the admin role provisioning process. Redeploy after changing NEXT_PUBLIC variables because they are embedded at build time.

Authenticated history hydration, global trends, live public catalog publication, real seller inventory, and message delivery require additional integration. They are not enabled merely by setting keys.

## Rollback

Keep the prior healthy deployment. In Vercel select it for instant rollback, or use `vercel rollback <deployment-url>`. Do not roll database migrations back blindly; preserve backups and prefer forward corrective migrations.

## Access observed in this session

The connected Vercel deployment endpoint returned `Tool deploy_to_vercel not found`, and reading ARTE under team `thereal-baitjets-projects` returned HTTP 403 with re-authentication required. No authenticated CLI or successful interactive session was available. These connector limitations did not prevent a GitHub-triggered deployment: the earlier release received a successful Vercel commit status.

For `403a2ee9bdb793adbaa2f9ded1d1b683b760da9f`, the unique URL was `https://arte-5p6vimxwu-thereal-baitjets-projects.vercel.app`. Its `/api/health` request redirected to `vercel.com/login` and ultimately returned HTML. Project/branch aliases also redirected to login. The application was therefore not verified as publicly reachable. The final deployment needs an accessible intended production URL or authorized access for verification; no login challenge was bypassed.

## Repository delivery status

The user explicitly authorized committing and publishing this release to `thereal-baitjet/ARTE` on September 27, 2026. The release integrates the newer Supabase setup and Vercel configuration commits from main. The earlier release was published as `a06a1a039e93bc44a403d3cb68ce80bdf2bee0c9`; the museum-only Discover correction followed as `403a2ee9bdb793adbaa2f9ded1d1b683b760da9f`. Their application CI passed. The new 1,000-work revision is still pending final validation/publication. Use its exact recorded SHA for subsequent deployment. GitHub publication does not establish a passing hosted database gate or a successful production smoke test.
