-- Listing freshness, verified inquiries, atomic demo ingestion and append-only audit.
-- Guest analytics remain on the device. Public database keys cannot ingest anonymous spam.
drop policy events_anon_insert on public.events;
drop policy impressions_anon_insert on public.impressions;
drop policy feed_sessions_anon_insert on public.feed_sessions;
revoke insert on public.events, public.impressions, public.feed_sessions from anon;

alter table public.events add constraint event_payload_is_bounded
check (octet_length(payload::text) <= 8192
  and (viewport is null or octet_length(viewport::text) <= 1024)
  and (source is null or length(source) <= 128)
  and (recommendation_reason is null or length(recommendation_reason) <= 1000)
  and (anonymous_session_id is null or length(anonymous_session_id) <= 128));

alter table public.artworks add constraint published_artwork_requires_rights_evidence
check (not is_published or (
  coalesce(length(trim(source_url)), 0) > 0
  and coalesce(length(trim(image_source)), 0) > 0
  and coalesce(length(trim(image_license)), 0) > 0
  and coalesce(length(trim(image_creator)), 0) > 0
  and ((image_rights_state = 'demo' and is_synthetic)
    or (image_rights_state in ('public_domain', 'licensed', 'owned') and not is_synthetic))
));
-- Existing unverified commercial inventory is unpublished rather than legitimized.
update public.listings set status = 'inactive'
where not is_demo and status = 'active'
  and (last_verified_at is null or expires_at is null or expires_at <= last_verified_at);

alter table public.listings add constraint active_real_listing_requires_verification
check (is_demo or status <> 'active' or (
  last_verified_at is not null and expires_at is not null and expires_at > last_verified_at
));

create or replace function public.enforce_listing_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not new.is_demo and exists (select 1 from public.artworks where id = new.artwork_id and is_synthetic) then
    raise exception 'Synthetic artworks require demo listing labels' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_listing_identity() from public;
create trigger enforce_listing_identity before insert or update on public.listings
for each row execute function public.enforce_listing_identity();

create or replace function public.listing_is_fresh(
  p_status public.listing_status, p_is_demo boolean,
  p_verified timestamptz, p_expires timestamptz
) returns boolean language sql stable set search_path = '' as $$
  select p_status = 'active'
    and (p_expires is null or p_expires > now())
    and (p_is_demo or (
      p_verified is not null and p_expires is not null
      and p_verified <= now() and p_verified >= now() - interval '30 days'
    ));
$$;
revoke all on function public.listing_is_fresh(public.listing_status, boolean, timestamptz, timestamptz) from public;
grant execute on function public.listing_is_fresh(public.listing_status, boolean, timestamptz, timestamptz) to anon, authenticated;

drop policy public_read_active_listings on public.listings;
create policy public_read_active_listings on public.listings for select to anon, authenticated
using (
  public.listing_is_fresh(status, is_demo, last_verified_at, expires_at)
  and exists (select 1 from public.artworks a where a.id = artwork_id
    and a.is_published and (is_demo or not a.is_synthetic)
    and a.image_rights_state in ('public_domain', 'licensed', 'owned', 'demo'))
);

alter table public.inquiries add constraint inquiry_message_length check (message is null or length(message) between 1 and 4000);
drop policy inquiries_owner_all on public.inquiries;
create policy inquiries_owner_select on public.inquiries for select to authenticated
using ((select auth.uid()) = user_id);
create policy inquiries_owner_insert on public.inquiries for insert to authenticated
with check (
  (select auth.uid()) = user_id and status in ('started', 'submitted')
  and exists (select 1 from public.listings l where l.id = listing_id and not l.is_demo
    and public.listing_is_fresh(l.status, l.is_demo, l.last_verified_at, l.expires_at))
);
create policy inquiries_admin_all on public.inquiries for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.limit_inquiry_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 72419));
    if (select count(*) from public.inquiries where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Inquiry limit reached. Try again later.' using errcode = '23514';
    end if;
    new.created_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.limit_inquiry_submission() from public;
create trigger limit_inquiry_submission before insert on public.inquiries
for each row execute function public.limit_inquiry_submission();

-- No user, including an application admin, can manually fabricate or erase audit rows.
drop policy admins_all_audit_logs on public.admin_audit_logs;
create policy admins_read_audit_logs on public.admin_audit_logs for select to authenticated
using ((select public.is_admin()));
revoke insert, update, delete on public.admin_audit_logs from authenticated;

create or replace function public.audit_catalog_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb;
begin
  if auth.uid() is not null then
    row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    insert into public.admin_audit_logs(actor_user_id, action, resource_type, resource_id, metadata)
    values (auth.uid(), lower(tg_op), tg_table_name, (row_data->>'id')::uuid,
      jsonb_strip_nulls(jsonb_build_object('status', row_data->>'status',
        'is_published', row_data->'is_published', 'image_rights_state', row_data->>'image_rights_state',
        'source_name', row_data->>'source_name')));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_catalog_change() from public;

create trigger audit_artists after insert or update or delete on public.artists for each row execute function public.audit_catalog_change();
create trigger audit_galleries after insert or update or delete on public.galleries for each row execute function public.audit_catalog_change();
create trigger audit_artworks after insert or update or delete on public.artworks for each row execute function public.audit_catalog_change();
create trigger audit_artwork_sources after insert or update or delete on public.artwork_sources for each row execute function public.audit_catalog_change();
create trigger audit_listings after insert or update or delete on public.listings for each row execute function public.audit_catalog_change();
create trigger audit_source_sync_runs after insert or update or delete on public.source_sync_runs for each row execute function public.audit_catalog_change();

-- Each demo import is atomic, uses the caller's RLS role, and preserves an existing archive.
create or replace function public.admin_upsert_demo_artwork(record jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  artwork_id uuid := (record->>'id')::uuid;
  artist_id uuid := (record->'artist'->>'id')::uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if record->>'image_rights_state' is distinct from 'demo'
    or record->>'is_synthetic' is distinct from 'true'
    or record->>'source_url' is distinct from '/sources/demo'
    or coalesce(record->>'image_license', '') = ''
    or coalesce(record->>'source_artwork_id', '') = ''
    or coalesce(record->>'source_name', '') = ''
    or coalesce(record->>'title', '') = '' then
    raise exception 'Only attributed synthetic demo records are accepted' using errcode = '23514';
  end if;
  -- Prevent an adapter from overwriting a real record through an identifier collision.
  if exists (select 1 from public.artworks where id = artwork_id and not is_synthetic) then
    raise exception 'A demo cannot replace a real artwork' using errcode = '23514';
  end if;
  insert into public.artists(id, slug, name, biography, nationality, biography_source_url)
  values (artist_id, record->'artist'->>'slug', record->'artist'->>'name',
    record->'artist'->>'biography', record->'artist'->>'nationality', '/sources/demo')
  on conflict (id) do nothing;
  insert into public.artworks(id, artist_id, slug, title, year_display, medium, dimensions, description,
    source_name, source_url, source_artwork_id, metadata_source, image_source, image_license, image_creator,
    image_rights_state, is_synthetic, is_published, commercial_usage_allowed,
    data_verified_at, last_synced_at, source_adapter_version)
  values (artwork_id, artist_id, record->>'slug', record->>'title', record->>'year_display',
    record->>'medium', record->>'dimensions', record->>'description', record->>'source_name',
    record->>'source_url', record->>'source_artwork_id', record->>'metadata_source',
    record->>'image_source', record->>'image_license', 'ARTE development dataset', 'demo', true, true, false,
    now(), now(), record->>'source_adapter_version')
  on conflict (id) do update set title = excluded.title, medium = excluded.medium,
    dimensions = excluded.dimensions, description = excluded.description,
    last_synced_at = now(), updated_at = now(), source_adapter_version = excluded.source_adapter_version;
  insert into public.artwork_sources(artwork_id, source_name, source_url, source_artwork_id,
    metadata_source, data_verified_at, last_synced_at, source_adapter_version)
  values (artwork_id, record->>'source_name', record->>'source_url', record->>'source_artwork_id',
    record->>'metadata_source', now(), now(), record->>'source_adapter_version')
  on conflict (source_name, source_artwork_id) do update set
    last_synced_at = now(), data_verified_at = now(), source_adapter_version = excluded.source_adapter_version;
  return artwork_id;
end;
$$;
revoke all on function public.admin_upsert_demo_artwork(jsonb) from public;
grant execute on function public.admin_upsert_demo_artwork(jsonb) to authenticated;

create policy events_owner_delete on public.events for delete to authenticated
using ((select auth.uid()) = user_id);
create policy impressions_owner_delete on public.impressions for delete to authenticated
using ((select auth.uid()) = user_id);
create policy feed_sessions_owner_delete on public.feed_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

drop function if exists public.reset_my_personalization();
create or replace function public.reset_my_personalization(expected_user_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user_id then
    raise exception 'The signed-in account changed. Try again.' using errcode = '42501';
  end if;
  delete from public.events where user_id = auth.uid();
  delete from public.impressions where user_id = auth.uid();
  delete from public.recommendation_events where user_id = auth.uid();
  delete from public.recommendation_profiles where user_id = auth.uid();
  delete from public.feed_sessions where user_id = auth.uid();
end;
$$;
revoke all on function public.reset_my_personalization(uuid) from public;
grant execute on function public.reset_my_personalization(uuid) to authenticated;
