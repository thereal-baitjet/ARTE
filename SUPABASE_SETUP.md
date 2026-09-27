# Supabase Setup for ARTE

> Release note: apply **all** migrations in `supabase/migrations/` in timestamp order, including the release security migration. The historical two-file manual example below is incomplete for the current release. See `docs/DEPLOYMENT.md` and `docs/RELEASE-CHECKLIST.md` for current requirements and unverified hosted flows.

## Quick Start

### 1. Create a Supabase Project
- Go to [app.supabase.com](https://app.supabase.com)
- Click "New project"
- Enter project name: `arte` (or similar)
- Choose a strong database password
- Select your region
- Click "Create new project"

### 2. Get Your Credentials
Once your project is created:
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable Key (anon)** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Paste them into `.env.local`

### 3. Apply Database Migrations
The schema and RLS policies are ready in `supabase/migrations/`:
- `20260927204000_core_schema.sql` — All tables, types, indices, and triggers
- `20260927204100_rls.sql` — Row-level security policies

**Option A: Using Supabase CLI (Recommended)**
```bash
npm install -g supabase  # if not already installed
supabase login
cd ~/ARTE
supabase link --project-ref your_project_ref  # Get this from Supabase project settings
supabase db push
```

**Option B: Manual SQL in Supabase Dashboard**
1. Go to **SQL Editor** in your project
2. Click **New query**
3. Copy the contents of `supabase/migrations/20260927204000_core_schema.sql`
4. Paste and execute
5. Repeat with `supabase/migrations/20260927204100_rls.sql`

### 4. Configure Authentication
1. Go to **Authentication** → **Providers**
2. Email provider should be enabled by default
3. Go to **Email Templates** → **Magic Link**
4. Verify the redirect URL matches your app (should work for localhost and production)

### 5. Install Dependencies & Run
```bash
cd ~/ARTE
npm install
npm run dev
```

Visit `http://localhost:3000` — the auth forms will now work!

## What's Already Set Up

✅ **Supabase Client** (`lib/supabase/client.ts`)
- Browser client with magic link support
- Session persistence and auto-refresh
- URL detection for redirects

✅ **Magic Link Auth** (`components/auth/AuthPanel.tsx`)
- Email-based sign-in
- Auto-creates user profiles
- Redirects to `/discover` after login

✅ **Database Schema**
- `profiles` — User accounts with roles (user/curator/gallery_partner/admin)
- `artworks`, `artwork_images`, `artwork_sources` — Artwork metadata & embeddings
- `artists`, `museums`, `galleries` — Art world entities
- `collections`, `collection_items` — User-created collections
- `likes`, `saves`, `follows` — User engagement
- `events`, `impressions` — Analytics tracking
- `listings`, `inquiries` — Gallery sales integration
- `recommendation_profiles`, `recommendation_events` — Personalization

✅ **Security (RLS)**
- Public read access to published artworks only
- Users can only read/modify their own data
- Admin role for curatorial access
- Automatic profile creation on signup

## Next Steps

1. **Test Magic Link Login**
   - Visit the auth page
   - Enter your email
   - Click the link in your inbox
   - You'll be redirected to `/discover`

2. **Verify Profile Creation**
   - In Supabase **SQL Editor**, run:
   ```sql
   SELECT id, display_name, role, created_at FROM public.profiles;
   ```

3. **Personalize Onboarding**
   - Check `app/(product)/onboarding/`
   - Customize taste preferences collection

4. **Set Up Admin Role** (optional)
   - Update your profile role to `admin` via SQL:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = 'your_user_id';
   ```

## Troubleshooting

**"Hosted authentication is not configured"**
- Check `.env.local` has both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Restart dev server: `npm run dev`

**Magic link not arriving**
- Check spam folder
- Verify email is correctly spelled
- Check Supabase project's email logs (Settings → Email)

**Can't insert artworks**
- Make sure migrations ran successfully
- Check `artworks` table exists: `SELECT COUNT(*) FROM public.artworks;`

**User profile not created**
- Check that the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Manually create profile if needed:
  ```sql
  INSERT INTO public.profiles (id, display_name, role)
  VALUES ('user_id', 'display_name', 'user');
  ```
