# Shared Corridor

Private, anonymous notes on published, non-synthetic public-domain works. The artwork page remains static. A client-only gate verifies the current session and membership; the note bundle and six-note page load only when the member opens the corridor.

## Enable

1. Apply `supabase/migrations/20260929140000_shared_corridor.sql` to the same Supabase project used by ARTE.
2. Deploy the application with its existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Provision selected, existing account UUIDs through the Supabase SQL editor or a trusted service-role operation:

```sql
insert into public.early_access_members (user_id)
values ('REPLACE_WITH_EXISTING_ACCOUNT_UUID'::uuid)
on conflict (user_id) do update set revoked_at = null, expires_at = null;
```

No accounts are enrolled by the migration. Signup metadata and profile roles do not grant access. Never expose a service-role key in the browser or use it for corridor API requests.

To revoke a membership:

```sql
update public.early_access_members
set revoked_at = now()
where user_id = 'REPLACE_WITH_EXISTING_ACCOUNT_UUID'::uuid;
```

Every subsequent database request is denied immediately. An open client rechecks access on focus, visibility changes, and every minute; content already delivered to a browser cannot be remotely recalled. Revocation does not delete the member's existing anonymous notes. Trusted maintenance can remove them directly if needed. Set `expires_at` to impose an optional membership expiry.

## Privacy and behavior

- All three tables have RLS and no anonymous/authenticated table privileges. Only narrow security-definer RPCs can serve members; they use an empty search path and derive ownership from `auth.uid()`.
- Page output contains note IDs, text, timestamps, and an `isOwn` flag. It never contains account UUIDs, names, or profile metadata.
- The API verifies bearer tokens with Supabase Auth and sends the same caller JWT to PostgreSQL. Responses are private, uncached, and marked noindex.
- Notes are not server-rendered, indexed, persisted in browser storage, or sent to analytics. Sign-out/account changes unmount private content and abort requests.
- One note per member/artwork is enforced by a unique constraint. Creation order stays stable after edits; keyset cursors preserve PostgreSQL microseconds.
- Each member can create ten notes and edit thirty notes per UTC day. Successful writes atomically increment a separate ledger; deletion never restores the allowance. Deletion is not rate-limited.
- Text is normalized with NFKC, whitespace collapsed, and limited to 140 Unicode code points. Database moderation blocks basic profanity, links and common promotional phrases. This intentionally small English-language filter is not comprehensive moderation.
- The feature is opt-in by opening the panel. No public routes, profiles, counts, reactions, notifications or replies are introduced.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- `supabase test db`: corridor permission, lifecycle, moderation, quota and pagination assertions alongside existing suites.
- `tests/integration/auth-local.mjs`: real Supabase sessions, REST isolation and simultaneous writes against the quota.
- `tests/integration/corridor-api-local.mjs`: production Next HTTP routes with real local Supabase Auth. Requires a build using local Supabase public credentials. Both integration scripts reject non-local Supabase URLs.
- `playwright.corridor.config.ts`: deterministic browser-only auth/API fixtures; these test UI behavior, not the security boundary. Build with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=corridor-test-public-key`, then run `npx playwright test --config playwright.corridor.config.ts`. CI runs this separately from the normal production build and public-page tests.
