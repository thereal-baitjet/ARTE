begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email, raw_user_meta_data) values
  ('71000000-0000-0000-0000-000000000001', 'release-admin@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000002', 'release-member@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000003', 'release-other@example.com', '{}');
update public.profiles set role = 'admin' where id = '71000000-0000-0000-0000-000000000001';

select throws_ok($$update public.artworks set is_synthetic = false
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null,
  'published demo cannot claim to be a real artwork');
select throws_ok($$update public.artworks set image_license = ''
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null,
  'published artwork requires license evidence');

insert into public.artworks(id, artist_id, slug, title, source_name, source_url, metadata_source,
  image_source, image_creator, image_rights_state, image_license, is_synthetic, is_published)
values ('73000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'release-rights-policy-fixture', 'Policy fixture', 'Policy test', 'https://example.com/source',
  'Policy test only', 'Policy test', 'Policy test', 'public_domain', 'CC0 test fixture', false, true);

insert into public.listings(id, artwork_id, status, is_demo, price_cents, source_url, last_verified_at, expires_at) values
  ('72000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'active', true, 10000, '/sources/demo', now(), now() + interval '7 days'),
  ('72000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', 'active', false, 10000, 'https://example.com/verified', now(), now() + interval '7 days'),
  ('72000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000001', 'active', false, 10000, 'https://example.com/stale', now() - interval '31 days', now() + interval '7 days'),
  ('72000000-0000-0000-0000-000000000004', '73000000-0000-0000-0000-000000000001', 'active', false, 10000, 'https://example.com/expired', now() - interval '2 days', now() - interval '1 day');
select throws_ok($$insert into public.listings(artwork_id, status, is_demo, price_cents, source_url)
  values ('73000000-0000-0000-0000-000000000001', 'active', false, 100, 'https://example.com')$$,
  '23514', null, 'real active listing cannot omit verification and expiry');
select throws_ok($$insert into public.listings(artwork_id, status, is_demo, price_cents, source_url, last_verified_at, expires_at)
  values ('30000000-0000-0000-0000-000000000001', 'active', false, 100, 'https://example.com', now(), now() + interval '1 day')$$,
  '23514', null, 'synthetic artwork cannot masquerade as a real listing');

set local role anon;
select throws_ok($$insert into public.events(anonymous_session_id,event_type) values ('spam','feed_refresh')$$,
  '42501', null, 'anonymous clients cannot write hosted analytics');
select throws_ok($$insert into public.feed_sessions(anonymous_session_id) values ('spam')$$,
  '42501', null, 'anonymous clients cannot create hosted feed sessions');
select throws_ok($$insert into public.impressions(anonymous_session_id,artwork_id) values ('spam','30000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anonymous clients cannot write hosted impressions');
select results_eq($$select count(*)::bigint from public.listings where id::text like '72000000-%'$$,
  $$values (2::bigint)$$, 'public sees only fresh and unexpired listings');
select throws_ok($$select public.admin_upsert_demo_artwork('{}'::jsonb)$$,
  '42501', null, 'anonymous user cannot execute ingestion');
select throws_ok($$select public.reset_my_personalization('71000000-0000-0000-0000-000000000002'::uuid)$$,
  '42501', null, 'anonymous user cannot reset hosted profiles');

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000002';
select throws_ok($$insert into public.events(user_id,event_type,payload) values
  ('71000000-0000-0000-0000-000000000002','feed_refresh',jsonb_build_object('oversized', repeat('x', 10000)))$$,
  '23514', null, 'authenticated analytics payloads have a bounded size');
select results_eq($$select count(*)::bigint from public.admin_audit_logs$$,
  $$values (0::bigint)$$, 'normal user cannot read audit records');
select throws_ok($$select public.admin_upsert_demo_artwork('{}'::jsonb)$$,
  '42501', null, 'normal user cannot call ingestion RPC');
select throws_ok($$insert into public.source_sync_runs(source_name,status) values ('attack','running')$$,
  '42501', null, 'normal user cannot start synchronization');
select throws_ok($$insert into public.inquiries(user_id,listing_id,message) values
  ('71000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000001','Demo inquiry')$$,
  '42501', null, 'real inquiries cannot be sent for synthetic inventory');
select throws_ok($$insert into public.inquiries(user_id,listing_id,message) values
  ('71000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000003','Stale inquiry')$$,
  '42501', null, 'stale listing rejects inquiry');
select lives_ok($$insert into public.inquiries(user_id,listing_id,message) values
  ('71000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','Verified inquiry')$$,
  'fresh listing accepts owner inquiry');
select throws_ok($$insert into public.inquiries(user_id,listing_id,message) values
  ('71000000-0000-0000-0000-000000000003','72000000-0000-0000-0000-000000000002','Impersonation')$$,
  '42501', null, 'caller cannot start another users inquiry');

set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000001';
select lives_ok($$update public.artworks set is_published = false
  where id = '30000000-0000-0000-0000-000000000002'$$, 'admin can archive artwork');
select results_eq($$select count(*)::bigint from public.admin_audit_logs
  where actor_user_id = '71000000-0000-0000-0000-000000000001'
    and resource_type = 'artworks' and resource_id = '30000000-0000-0000-0000-000000000002'$$,
  $$values (1::bigint)$$, 'admin write creates a transactional audit row');
select throws_ok($$delete from public.admin_audit_logs$$, '42501', null, 'admin cannot erase audit rows');
select throws_ok($$insert into public.admin_audit_logs(action,resource_type) values ('fabricated','artworks')$$,
  '42501', null, 'admin cannot fabricate audit rows');
select throws_ok($$update public.admin_audit_logs set action = 'rewritten'$$,
  '42501', null, 'admin cannot edit audit rows');

select lives_ok($$select public.admin_upsert_demo_artwork(jsonb_build_object(
  'id','30000000-0000-0000-0000-000000000002','slug','night-window-demo','title','Night Window — Demo',
  'artist',jsonb_build_object('id','10000000-0000-0000-0000-000000000001','slug','atelier-nocturne-demo','name','Atelier Nocturne — Demo'),
  'source_name','ARTE deterministic seed','source_url','/sources/demo',
  'source_artwork_id','demo-002','metadata_source','ARTE deterministic synthetic dataset',
  'image_source','ARTE deterministic demo renderer','image_license','Development-only synthetic content',
  'image_rights_state','demo','is_synthetic',true,'source_adapter_version','demo-v1'
))$$, 'administrator ingestion atomically upserts a rights-validated demo');
select results_eq($$select is_published from public.artworks where id = '30000000-0000-0000-0000-000000000002'$$,
  $$values (false)$$, 'synchronization preserves manually archived artwork');
select results_eq($$select count(*)::bigint from public.artwork_sources
  where source_name = 'ARTE deterministic seed' and source_artwork_id = 'demo-002'$$,
  $$values (1::bigint)$$, 'synchronization preserves unique source identity');

reset role;
insert into public.events(user_id,event_type) values
  ('71000000-0000-0000-0000-000000000002','feed_refresh'),
  ('71000000-0000-0000-0000-000000000003','feed_refresh');
insert into public.recommendation_profiles(user_id) values
  ('71000000-0000-0000-0000-000000000002'),
  ('71000000-0000-0000-0000-000000000003');
insert into public.saves(user_id,artwork_id) values
  ('71000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000002';
select throws_ok($$select public.reset_my_personalization('71000000-0000-0000-0000-000000000003'::uuid)$$,
  '42501', null, 'account-switch reset cannot target a different user');
select lives_ok($$select public.reset_my_personalization('71000000-0000-0000-0000-000000000002'::uuid)$$, 'user can atomically reset their hosted personalization');
select results_eq($$select count(*)::bigint from public.events where user_id = '71000000-0000-0000-0000-000000000002'$$,
  $$values (0::bigint)$$, 'reset removes callers event history');
select results_eq($$select count(*)::bigint from public.saves where user_id = '71000000-0000-0000-0000-000000000002'$$,
  $$values (1::bigint)$$, 'reset preserves intentional saves');
reset role;
select results_eq($$select count(*)::bigint from public.events where user_id = '71000000-0000-0000-0000-000000000003'$$,
  $$values (1::bigint)$$, 'reset cannot erase another users events');
select results_eq($$select count(*)::bigint from public.recommendation_profiles where user_id = '71000000-0000-0000-0000-000000000003'$$,
  $$values (1::bigint)$$, 'reset cannot erase another users taste profile');

select * from finish();
rollback;
