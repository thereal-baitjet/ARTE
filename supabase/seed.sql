-- Deterministic, rights-safe development data for the ARTE demo catalog.
-- Every artist and artwork below is synthetic and must remain visibly labeled as demo content.

create temporary table arte_seed_catalog (
  n integer primary key,
  artist_n integer not null,
  slug text not null,
  title text not null,
  medium text not null,
  dimensions text not null,
  description text not null,
  movement_n integer not null,
  tags text[] not null
) on commit drop;

insert into arte_seed_catalog (
  n, artist_n, slug, title, medium, dimensions, description, movement_n, tags
)
values
  (1, 1, 'quiet-red-study-demo', 'Quiet Red Study — Demo', 'Synthetic digital study', '1200 × 1600 px', 'A restrained field of oxblood, charcoal, and warm mineral light.', 1, array['oxblood', 'quiet', 'geometric']),
  (2, 1, 'night-window-demo', 'Night Window — Demo', 'Synthetic digital study', '1600 × 1200 px', 'A nocturnal architectural study held between violet and amber light.', 2, array['night', 'architecture', 'violet']),
  (3, 2, 'form-three-demo', 'Form III — Demo', 'Synthetic digital study', '1400 × 1400 px', 'A square study in proportion, tension, and antique-gold interruption.', 3, array['minimal', 'square', 'gold']),
  (4, 2, 'image-awaiting-clearance-demo', 'Image Awaiting Clearance — Demo', 'Metadata-only synthetic record', 'Dimensions unavailable', 'An intentional missing-image state used to verify graceful rights-first presentation.', 4, array['missing image', 'rights', 'fallback']),
  (5, 3, 'blue-interval-demo', 'Blue Interval — Demo', 'Synthetic digital study', '1800 × 1200 px', 'An open blue field interrupted by a soft, off-center horizon.', 5, array['blue', 'horizon', 'calm']),
  (6, 3, 'garden-after-rain-demo', 'Garden After Rain — Demo', 'Synthetic digital study', '1350 × 1800 px', 'Layered greens and washed rose tones suggest a garden without literal depiction.', 6, array['green', 'garden', 'texture']),
  (7, 4, 'electric-figure-demo', 'Electric Figure — Demo', 'Synthetic digital study', '1200 × 1600 px', 'A high-contrast vertical form staged against electric cobalt and ember tones.', 7, array['figure', 'cobalt', 'energy']),
  (8, 2, 'dust-and-gold-demo', 'Dust and Gold — Demo', 'Synthetic digital study', '1600 × 1200 px', 'Muted earth tones hold a narrow line of reflective warmth.', 8, array['earth', 'gold', 'material']),
  (9, 2, 'meridian-demo', 'Meridian — Demo', 'Synthetic digital study', '1500 × 1500 px', 'A centered axis divides cool depth from mineral light.', 3, array['axis', 'blue', 'minimal']),
  (10, 1, 'violet-assembly-demo', 'Violet Assembly — Demo', 'Synthetic digital study', '1200 × 1600 px', 'Overlapping violet structures gather around a muted interior light.', 1, array['violet', 'layered', 'structure']),
  (11, 3, 'tidal-memory-demo', 'Tidal Memory — Demo', 'Synthetic digital study', '1800 × 1200 px', 'A low, tidal sweep moves through deep teal and weathered ivory.', 6, array['teal', 'water', 'memory']),
  (12, 4, 'small-monument-demo', 'Small Monument — Demo', 'Synthetic digital study', '1400 × 1400 px', 'A compact dark form stands against a luminous, nearly architectural ground.', 9, array['monument', 'form', 'light']);

-- Avoid temporary unique-slug collisions when upgrading an earlier seed revision.
update public.artists
set slug = 'legacy-seed-' || replace(id::text, '-', '')
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);

insert into public.artists (id, slug, name, biography, biography_source_url)
values
  ('10000000-0000-0000-0000-000000000001', 'atelier-nocturne-demo', 'Atelier Nocturne — Demo', 'A fictional studio identity created exclusively for ARTE development, testing, and interface validation. No real artist or representation is implied.', '/sources/demo'),
  ('10000000-0000-0000-0000-000000000002', 'forma-lumen-demo', 'Forma Lumen — Demo', 'A fictional studio identity used to test geometric, minimal, and light-driven presentation inside ARTE. All associated works are synthetic demo records.', '/sources/demo'),
  ('10000000-0000-0000-0000-000000000003', 'maris-vale-demo', 'Maris Vale — Demo', 'A fictional studio identity created to exercise ARTE''s landscape, color, and atmospheric discovery flows without making rights claims about real artwork.', '/sources/demo'),
  ('10000000-0000-0000-0000-000000000004', 'studio-anima-demo', 'Studio Anima — Demo', 'A fictional studio identity created for figurative and expressive demo material. It exists only inside the ARTE development dataset.', '/sources/demo')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  biography = excluded.biography,
  biography_source_url = excluded.biography_source_url;

insert into public.art_movements (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Demo Abstraction', 'demo-abstraction'),
  ('20000000-0000-0000-0000-000000000002', 'Demo Figurative', 'demo-figurative'),
  ('20000000-0000-0000-0000-000000000003', 'Demo Minimalism', 'demo-minimalism'),
  ('20000000-0000-0000-0000-000000000004', 'Demo Systems Study', 'demo-systems-study'),
  ('20000000-0000-0000-0000-000000000005', 'Demo Color Field', 'demo-color-field'),
  ('20000000-0000-0000-0000-000000000006', 'Demo Atmospheric', 'demo-atmospheric'),
  ('20000000-0000-0000-0000-000000000007', 'Demo Expressionism', 'demo-expressionism'),
  ('20000000-0000-0000-0000-000000000008', 'Demo Material Study', 'demo-material-study'),
  ('20000000-0000-0000-0000-000000000009', 'Demo Sculptural Study', 'demo-sculptural-study')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug;

insert into public.artworks (
  id, artist_id, slug, title, year_display, medium, dimensions, description,
  source_name, source_url, source_artwork_id, metadata_source, image_source,
  image_creator, image_rights_state, image_license, commercial_usage_allowed,
  is_published, is_synthetic, data_verified_at, last_synced_at, source_adapter_version
)
select
  ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('10000000-0000-0000-0000-' || lpad(artist_n::text, 12, '0'))::uuid,
  slug,
  title,
  '2026',
  medium,
  dimensions,
  description,
  'ARTE deterministic seed',
  '/sources/demo',
  'demo-' || lpad(n::text, 3, '0'),
  'ARTE deterministic seed',
  'ARTE deterministic demo renderer',
  'ARTE development dataset',
  'demo',
  'Development-only synthetic content',
  false,
  true,
  true,
  now(),
  now(),
  'internal-demo-v2'
from arte_seed_catalog
on conflict (id) do update set
  artist_id = excluded.artist_id,
  slug = excluded.slug,
  title = excluded.title,
  year_display = excluded.year_display,
  medium = excluded.medium,
  dimensions = excluded.dimensions,
  description = excluded.description,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  source_artwork_id = excluded.source_artwork_id,
  metadata_source = excluded.metadata_source,
  image_source = excluded.image_source,
  image_creator = excluded.image_creator,
  image_rights_state = excluded.image_rights_state,
  image_license = excluded.image_license,
  commercial_usage_allowed = excluded.commercial_usage_allowed,
  is_published = excluded.is_published,
  is_synthetic = excluded.is_synthetic,
  data_verified_at = excluded.data_verified_at,
  last_synced_at = excluded.last_synced_at,
  source_adapter_version = excluded.source_adapter_version;

insert into public.artwork_sources (
  id, artwork_id, source_name, source_url, source_artwork_id,
  metadata_source, last_synced_at, data_verified_at, source_adapter_version
)
select
  ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'ARTE deterministic seed',
  '/sources/demo',
  'demo-' || lpad(n::text, 3, '0'),
  'ARTE deterministic seed',
  now(),
  now(),
  'internal-demo-v2'
from arte_seed_catalog
on conflict (id) do update set
  artwork_id = excluded.artwork_id,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  source_artwork_id = excluded.source_artwork_id,
  metadata_source = excluded.metadata_source,
  last_synced_at = excluded.last_synced_at,
  data_verified_at = excluded.data_verified_at,
  source_adapter_version = excluded.source_adapter_version;

delete from public.artwork_movements
where artwork_id in (
  select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from arte_seed_catalog
);

insert into public.artwork_movements (artwork_id, movement_id)
select
  ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('20000000-0000-0000-0000-' || lpad(movement_n::text, 12, '0'))::uuid
from arte_seed_catalog
on conflict do nothing;

delete from public.artwork_tags
where artwork_id in (
  select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from arte_seed_catalog
);

insert into public.artwork_tags (artwork_id, tag)
select
  ('30000000-0000-0000-0000-' || lpad(catalog.n::text, 12, '0'))::uuid,
  tag
from arte_seed_catalog catalog
cross join lateral unnest(catalog.tags) as tag
on conflict do nothing;
