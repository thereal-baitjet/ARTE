create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.museums enable row level security;
alter table public.galleries enable row level security;
alter table public.art_movements enable row level security;
alter table public.artworks enable row level security;
alter table public.artwork_images enable row level security;
alter table public.artwork_sources enable row level security;
alter table public.artwork_embeddings enable row level security;
alter table public.artwork_tags enable row level security;
alter table public.artwork_movements enable row level security;
alter table public.gallery_artists enable row level security;
alter table public.listings enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.feed_sessions enable row level security;
alter table public.impressions enable row level security;
alter table public.events enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.recommendation_profiles enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.source_sync_runs enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or (select public.is_admin()))
with check (
  ((select auth.uid()) = id and role = (select p.role from public.profiles p where p.id = (select auth.uid())))
  or (select public.is_admin())
);

create policy public_read_artists
on public.artists for select
to anon, authenticated
using (true);

create policy public_read_museums
on public.museums for select
to anon, authenticated
using (true);

create policy public_read_galleries
on public.galleries for select
to anon, authenticated
using (true);

create policy public_read_movements
on public.art_movements for select
to anon, authenticated
using (true);

create policy public_read_artworks
on public.artworks for select
to anon, authenticated
using (
  is_published
  and image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
);

create policy public_read_artwork_images
on public.artwork_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.artworks a
    where a.id = artwork_id
      and a.is_published
      and a.image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
  )
);

create policy public_read_artwork_sources
on public.artwork_sources for select
to anon, authenticated
using (
  exists (
    select 1 from public.artworks a
    where a.id = artwork_id
      and a.is_published
      and a.image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
  )
);

create policy public_read_artwork_tags
on public.artwork_tags for select
to anon, authenticated
using (
  exists (
    select 1 from public.artworks a
    where a.id = artwork_id
      and a.is_published
      and a.image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
  )
);

create policy public_read_artwork_movements
on public.artwork_movements for select
to anon, authenticated
using (
  exists (
    select 1 from public.artworks a
    where a.id = artwork_id
      and a.is_published
      and a.image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
  )
);

create policy public_read_gallery_artists
on public.gallery_artists for select
to anon, authenticated
using (true);

create policy public_read_active_listings
on public.listings for select
to anon, authenticated
using (
  status = 'active'
  and (expires_at is null or expires_at > now())
  and exists (
    select 1 from public.artworks a
    where a.id = artwork_id
      and a.is_published
      and a.image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
  )
);

create policy likes_owner_all
on public.likes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy saves_owner_all
on public.saves for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy follows_owner_all
on public.follows for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy feed_sessions_owner_select
on public.feed_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy feed_sessions_owner_insert
on public.feed_sessions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy feed_sessions_anon_insert
on public.feed_sessions for insert
to anon
with check (user_id is null and anonymous_session_id is not null);

create policy impressions_owner_select
on public.impressions for select
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy impressions_owner_insert
on public.impressions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy impressions_anon_insert
on public.impressions for insert
to anon
with check (user_id is null and anonymous_session_id is not null);

create policy events_owner_select
on public.events for select
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy events_owner_insert
on public.events for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy events_anon_insert
on public.events for insert
to anon
with check (user_id is null and anonymous_session_id is not null);

create policy collections_owner_all
on public.collections for all
to authenticated
using ((select auth.uid()) = owner_id or (select public.is_admin()))
with check ((select auth.uid()) = owner_id or (select public.is_admin()));

create policy collections_public_read
on public.collections for select
to anon, authenticated
using (visibility = 'public');

create policy collection_items_owner_all
on public.collection_items for all
to authenticated
using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id
      and (c.owner_id = (select auth.uid()) or (select public.is_admin()))
  )
)
with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_id
      and (c.owner_id = (select auth.uid()) or (select public.is_admin()))
  )
);

create policy collection_items_public_read
on public.collection_items for select
to anon, authenticated
using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id
      and c.visibility = 'public'
  )
);

create policy recommendation_profiles_owner_all
on public.recommendation_profiles for all
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));

create policy recommendation_events_owner_all
on public.recommendation_events for all
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));

create policy inquiries_owner_all
on public.inquiries for all
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));

create policy admins_read_embeddings
on public.artwork_embeddings for select
to authenticated
using ((select public.is_admin()));

create policy admins_all_artists
on public.artists for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_museums
on public.museums for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_galleries
on public.galleries for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_movements
on public.art_movements for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_artworks
on public.artworks for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_artwork_images
on public.artwork_images for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_artwork_sources
on public.artwork_sources for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_artwork_embeddings
on public.artwork_embeddings for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_artwork_tags
on public.artwork_tags for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_artwork_movements
on public.artwork_movements for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_gallery_artists
on public.gallery_artists for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_listings
on public.listings for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_source_sync_runs
on public.source_sync_runs for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admins_all_audit_logs
on public.admin_audit_logs for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant usage on schema public to anon, authenticated;

grant select on public.artists, public.museums, public.galleries, public.art_movements,
  public.artworks, public.artwork_images, public.artwork_sources, public.artwork_tags,
  public.artwork_movements, public.gallery_artists, public.listings
to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.likes, public.saves, public.follows,
  public.feed_sessions, public.impressions, public.events, public.collections,
  public.collection_items, public.recommendation_profiles, public.recommendation_events,
  public.inquiries
to authenticated;

grant insert on public.feed_sessions, public.impressions, public.events to anon;

grant select, insert, update, delete on public.artists, public.museums, public.galleries,
  public.art_movements, public.artworks, public.artwork_images, public.artwork_sources,
  public.artwork_embeddings, public.artwork_tags, public.artwork_movements,
  public.gallery_artists, public.listings, public.source_sync_runs, public.admin_audit_logs
to authenticated;
