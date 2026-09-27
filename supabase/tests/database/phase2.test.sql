begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_table('public', 'artworks', 'artworks table exists');
select has_table('public', 'artwork_sources', 'artwork_sources table exists');
select has_table('public', 'collections', 'collections table exists');

select results_eq(
  $$select count(*)::bigint from public.artworks$$,
  $$values (3::bigint)$$,
  'deterministic seed loads exactly three Phase 2 demo artworks'
);

select results_eq(
  $$select count(*)::bigint
    from public.artworks a
    where not exists (
      select 1 from public.artwork_sources s where s.artwork_id = a.id
    )$$,
  $$values (0::bigint)$$,
  'every seeded artwork has source provenance'
);

select results_eq(
  $$select count(*)::bigint
    from public.artworks
    where is_published
      and image_rights_state not in ('public_domain', 'licensed', 'owned', 'demo')$$,
  $$values (0::bigint)$$,
  'no published artwork has an unsafe rights state'
);

select throws_ok(
  $$insert into public.artworks (
      artist_id, slug, title, source_name, source_url, metadata_source,
      image_rights_state, is_published
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'unsafe-rights-test',
      'Unsafe Rights Test',
      'test',
      '/test',
      'test',
      'unclear',
      true
    )$$,
  '23514',
  null,
  'database blocks publication when image rights are unclear'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('50000000-0000-0000-0000-000000000001', 'owner@example.com', '{}'),
  ('50000000-0000-0000-0000-000000000002', 'other@example.com', '{}');

insert into public.collections (id, owner_id, name)
values (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Private Test Collection'
);

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';

select results_eq(
  $$select count(*)::bigint
    from public.collections
    where id = '60000000-0000-0000-0000-000000000001'$$,
  $$values (0::bigint)$$,
  'another user cannot read a private collection'
);

select throws_ok(
  $$insert into public.likes (user_id, artwork_id)
    values (
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    )$$,
  '42501',
  null,
  'a user cannot create a like for another user'
);

set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';

select lives_ok(
  $$insert into public.likes (user_id, artwork_id)
    values (
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    )$$,
  'a user can create their own like'
);

select results_eq(
  $$select count(*)::bigint
    from public.collections
    where id = '60000000-0000-0000-0000-000000000001'$$,
  $$values (1::bigint)$$,
  'the owner can read their private collection'
);

select * from finish();
rollback;
