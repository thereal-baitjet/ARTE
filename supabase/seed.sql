insert into public.artists (id, slug, name, biography, biography_source_url)
values
  ('10000000-0000-0000-0000-000000000001', 'arte-demo-studio', 'ARTE Demo Studio', 'Synthetic development identity used only for deterministic seed data.', '/seed/artists/arte-demo-studio'),
  ('10000000-0000-0000-0000-000000000002', 'atelier-nocturne-demo', 'Atelier Nocturne — Demo', 'Synthetic development identity used only for deterministic seed data.', '/seed/artists/atelier-nocturne-demo'),
  ('10000000-0000-0000-0000-000000000003', 'forma-lumen-demo', 'Forma Lumen — Demo', 'Synthetic development identity used only for deterministic seed data.', '/seed/artists/forma-lumen-demo')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  biography = excluded.biography,
  biography_source_url = excluded.biography_source_url;

insert into public.art_movements (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Demo Abstraction', 'demo-abstraction'),
  ('20000000-0000-0000-0000-000000000002', 'Demo Figurative', 'demo-figurative'),
  ('20000000-0000-0000-0000-000000000003', 'Demo Minimalism', 'demo-minimalism')
on conflict (id) do update set name = excluded.name, slug = excluded.slug;

insert into public.artworks (
  id, artist_id, slug, title, year_display, medium, dimensions, description,
  source_name, source_url, source_artwork_id, metadata_source, image_source,
  image_rights_state, image_license, commercial_usage_allowed,
  is_published, is_synthetic, data_verified_at, source_adapter_version
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'quiet-red-study-demo',
    'Quiet Red Study — Demo',
    '2026',
    'Digital study',
    '1200 × 1600 px',
    'Synthetic development record used to test ARTE rights and presentation rules.',
    'ARTE deterministic seed',
    '/seed/artworks/quiet-red-study-demo',
    'demo-001',
    'ARTE deterministic seed',
    'Generated development placeholder',
    'demo',
    'Development-only synthetic content',
    false,
    true,
    true,
    now(),
    'internal-demo-v1'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'night-window-demo',
    'Night Window — Demo',
    '2026',
    'Digital study',
    '1600 × 1200 px',
    'Synthetic development record used to test ARTE rights and presentation rules.',
    'ARTE deterministic seed',
    '/seed/artworks/night-window-demo',
    'demo-002',
    'ARTE deterministic seed',
    'Generated development placeholder',
    'demo',
    'Development-only synthetic content',
    false,
    true,
    true,
    now(),
    'internal-demo-v1'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'form-iii-demo',
    'Form III — Demo',
    '2026',
    'Digital study',
    '1400 × 1400 px',
    'Synthetic development record used to test ARTE rights and presentation rules.',
    'ARTE deterministic seed',
    '/seed/artworks/form-iii-demo',
    'demo-003',
    'ARTE deterministic seed',
    'Generated development placeholder',
    'demo',
    'Development-only synthetic content',
    false,
    true,
    true,
    now(),
    'internal-demo-v1'
  )
on conflict (id) do update set
  title = excluded.title,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  metadata_source = excluded.metadata_source,
  image_rights_state = excluded.image_rights_state,
  image_license = excluded.image_license,
  is_published = excluded.is_published,
  is_synthetic = excluded.is_synthetic,
  data_verified_at = excluded.data_verified_at,
  source_adapter_version = excluded.source_adapter_version;

insert into public.artwork_sources (
  id, artwork_id, source_name, source_url, source_artwork_id,
  metadata_source, data_verified_at, source_adapter_version
)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ARTE deterministic seed', '/seed/artworks/quiet-red-study-demo', 'demo-001', 'ARTE deterministic seed', now(), 'internal-demo-v1'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'ARTE deterministic seed', '/seed/artworks/night-window-demo', 'demo-002', 'ARTE deterministic seed', now(), 'internal-demo-v1'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'ARTE deterministic seed', '/seed/artworks/form-iii-demo', 'demo-003', 'ARTE deterministic seed', now(), 'internal-demo-v1')
on conflict (id) do update set
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  data_verified_at = excluded.data_verified_at,
  source_adapter_version = excluded.source_adapter_version;

insert into public.artwork_movements (artwork_id, movement_id)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003')
on conflict do nothing;
