# Deploy ARTE to Vercel

## Guest release

1. Import https://github.com/thereal-baitjet/ARTE into the intended Vercel team.
2. Choose repository root `.` and the detected Next.js preset.
3. Use Node.js 22, `npm ci`, and `npm run build` (`vercel.json` supplies the commands).
4. Deploy without Supabase variables to make the guest gallery available. The UI must continue to disclose unavailable account services and demo commerce.
5. Check `/api/health`, home, search, discovery, a museum artwork, collections, onboarding, taste, market, and the fail-closed admin state. Repeat a save/reload and an inquiry-draft/reload test on the actual URL.
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

Vercel installs the locked application dependencies and builds remotely. Complete login in your own browser; no successful passkey sign-in is assumed. This package includes the prepared release even while GitHub delivery is pending.

## Hosted Supabase accounts

Create or choose an authorized Supabase project. Apply migrations and the reviewed seed, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the correct Vercel environment. They are public client configuration; never substitute the service-role key.

Set Supabase Auth Site URL to the production URL and allow only the specific intended callback URLs. Test a real magic link, session restore, sign-out, ownership isolation, collections, likes, and saves. Review RLS and the admin role provisioning process. Redeploy after changing NEXT_PUBLIC variables because they are embedded at build time.

Authenticated history hydration, global trends, live public catalog publication, real seller inventory, and message delivery require additional integration. They are not enabled merely by setting keys.

## Rollback

Keep the prior healthy deployment. In Vercel select it for instant rollback, or use `vercel rollback <deployment-url>`. Do not roll database migrations back blindly; preserve backups and prefer forward corrective migrations.

## Access observed in this session

The connected Vercel deployment endpoint returned `Tool deploy_to_vercel not found`. Reading ARTE under team `thereal-baitjets-projects` returned HTTP 403 with a re-authentication requirement. No local CLI credential was available. No production deployment is claimed until this access is resolved and a READY deployment is verified.

## Repository delivery status

The user explicitly authorized committing and publishing this release to `thereal-baitjet/ARTE` on September 27, 2026. The release integrates the newer Supabase setup and Vercel configuration commits from main. Once this revision is present on main, use that updated checkout with `npm run deploy:vercel`. GitHub publication does not establish a passing hosted database gate or a verified production deployment.
