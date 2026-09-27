create extension if not exists pgcrypto;
create extension if not exists vector;

create type public.arte_user_role as enum ('user', 'curator', 'gallery_partner', 'admin');
create type public.artwork_rights_state as enum ('public_domain', 'licensed', 'owned', 'demo', 'unclear', 'restricted');
create type public.listing_status as enum ('draft', 'active', 'sold', 'inactive', 'expired');
create type public.collection_visibility as enum ('private', 'unlisted', 'public');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.arte_user_role not null default 'user',
  personalization_analytics_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  biography text,
  nationality text,
  birth_year int,
  death_year int,
  biography_source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.museums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  country text,
  source_url text,
  created_at timestamptz not null default now()
);

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  country text,
  source_url text,
  created_at timestamptz not null default now()
);

create table public.art_movements (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  museum_id uuid references public.museums(id) on delete set null,
  slug text not null unique,
  title text not null,
  year_display text,
  medium text,
  dimensions text,
  description text,
  source_name text not null,
  source_url text not null,
  source_artwork_id text,
  metadata_source text not null,
  image_source text,
  image_creator text,
  image_rights_state public.artwork_rights_state not null default 'unclear',
  image_license text,
  commercial_usage_allowed boolean not null default false,
  is_published boolean not null default false,
  is_synthetic boolean not null default false,
  data_verified_at timestamptz,
  last_synced_at timestamptz,
  source_adapter_version text not null default 'manual-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_artwork_requires_displayable_rights
    check (
      not is_published
      or image_rights_state in ('public_domain', 'licensed', 'owned', 'demo')
    )
);

create table public.artwork_images (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  url text not null,
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  alt_text text,
  image_source text not null,
  rights_holder text,
  license text,
  usage_notes text,
  source_url text not null,
  commercial_usage_allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.artwork_sources (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  source_artwork_id text,
  metadata_source text not null,
  last_synced_at timestamptz,
  data_verified_at timestamptz,
  source_adapter_version text not null,
  unique (source_name, source_artwork_id)
);

create table public.artwork_embeddings (
  artwork_id uuid primary key references public.artworks(id) on delete cascade,
  image_embedding vector(512),
  text_embedding vector(512),
  combined_embedding vector(512),
  provider text not null,
  model text not null,
  dimensions int not null check (dimensions > 0),
  source_hash text not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artwork_tags (
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  tag text not null,
  primary key (artwork_id, tag)
);

create table public.artwork_movements (
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  movement_id uuid not null references public.art_movements(id) on delete cascade,
  primary key (artwork_id, movement_id)
);

create table public.gallery_artists (
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  primary key (gallery_id, artist_id)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  gallery_id uuid references public.galleries(id) on delete set null,
  status public.listing_status not null default 'draft',
  is_demo boolean not null default true,
  price_cents bigint check (price_cents is null or price_cents >= 0),
  currency text not null default 'USD',
  price_on_request boolean not null default false,
  source_url text not null,
  last_verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_or_verified_listing_has_price_semantics
    check (price_on_request or price_cents is not null or status in ('draft', 'inactive', 'expired'))
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);

create table public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);

create table public.follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table public.feed_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id text,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  feed_session_id uuid references public.feed_sessions(id) on delete set null,
  position int check (position is null or position >= 0),
  visible_ms int check (visible_ms is null or visible_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id text,
  artwork_id uuid references public.artworks(id) on delete set null,
  artist_id uuid references public.artists(id) on delete set null,
  feed_session_id uuid references public.feed_sessions(id) on delete set null,
  event_type text not null check (event_type in (
    'artwork_impression','artwork_visible','artwork_dwell','artwork_like','artwork_unlike',
    'artwork_save','artwork_unsave','artwork_share','artwork_hide','artwork_detail_open',
    'artist_open','artist_follow','artist_unfollow','more_like_this_open','collection_add',
    'collection_remove','listing_open','gallery_open','inquiry_start','search_query',
    'search_result_open','feed_refresh','recommendation_explanation_open'
  )),
  source text,
  position int check (position is null or position >= 0),
  recommendation_reason text,
  viewport jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  visibility public.collection_visibility not null default 'private',
  share_token uuid not null default gen_random_uuid(),
  cover_artwork_id uuid references public.artworks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  note text,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (collection_id, artwork_id)
);

create table public.recommendation_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  taste_embedding vector(512),
  preferred_artists jsonb not null default '{}'::jsonb,
  preferred_movements jsonb not null default '{}'::jsonb,
  preferred_periods jsonb not null default '{}'::jsonb,
  preferred_media jsonb not null default '{}'::jsonb,
  preferred_palettes jsonb not null default '{}'::jsonb,
  preferred_subjects jsonb not null default '{}'::jsonb,
  collector_price_affinity jsonb not null default '{}'::jsonb,
  novelty_preference numeric not null default 0.5 check (novelty_preference between 0 and 1),
  exploration_tolerance numeric not null default 0.25 check (exploration_tolerance between 0 and 1),
  updated_at timestamptz not null default now()
);

create table public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  artwork_id uuid references public.artworks(id) on delete cascade,
  signal text not null,
  weight numeric not null,
  created_at timestamptz not null default now()
);

create table public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_seen int not null default 0 check (records_seen >= 0),
  records_upserted int not null default 0 check (records_upserted >= 0),
  records_rejected int not null default 0 check (records_rejected >= 0),
  error_summary jsonb not null default '{}'::jsonb
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  message text,
  status text not null default 'started' check (status in ('started', 'submitted', 'closed')),
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index artworks_artist_idx on public.artworks(artist_id);
create index artworks_publishable_idx on public.artworks(is_published, image_rights_state);
create index artwork_sources_artwork_idx on public.artwork_sources(artwork_id);
create index listings_status_idx on public.listings(status, expires_at);
create index likes_artwork_idx on public.likes(artwork_id);
create index saves_artwork_idx on public.saves(artwork_id);
create index events_user_created_idx on public.events(user_id, created_at desc);
create index events_artwork_created_idx on public.events(artwork_id, created_at desc);
create index collections_owner_idx on public.collections(owner_id);
create index recommendation_events_user_idx on public.recommendation_events(user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'member'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
