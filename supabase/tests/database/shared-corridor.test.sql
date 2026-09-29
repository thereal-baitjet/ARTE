begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
 ('81000000-0000-0000-0000-000000000001','corridor-one@example.com','{}'),
 ('81000000-0000-0000-0000-000000000002','corridor-two@example.com','{}'),
 ('81000000-0000-0000-0000-000000000003','corridor-regular@example.com','{"early_access":true}');
insert into public.early_access_members (user_id) values
 ('81000000-0000-0000-0000-000000000001'), ('81000000-0000-0000-0000-000000000002');
-- Use the release's verified public-domain catalog, independent of source ordering.
select set_config('corridor.artwork', (select id::text from public.artworks
 where is_published and not is_synthetic and image_rights_state = 'public_domain' order by id limit 1), true);

set local role anon;
select throws_ok($$select public.shared_corridor_page(current_setting('corridor.artwork')::uuid)$$, '42501', null, 'guests cannot read notes');
select throws_ok($$select * from public.shared_corridor_notes$$, '42501', null, 'guests cannot query the table');
set local role authenticated;
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000003';
select is(public.shared_corridor_access(current_setting('corridor.artwork')::uuid), false, 'signup metadata cannot grant membership');
select throws_ok($$select public.shared_corridor_page(current_setting('corridor.artwork')::uuid)$$, '42501', null, 'regular members cannot read');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','Quiet')$$, '42501', null, 'regular members cannot write');
select throws_ok($$insert into public.early_access_members(user_id) values(auth.uid())$$, '42501', null, 'members cannot self-enroll');

set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000001';
select is(public.shared_corridor_access(current_setting('corridor.artwork')::uuid), true, 'cohort member is eligible');
select throws_ok($$select * from public.shared_corridor_notes$$, '42501', null, 'even cohort members cannot extract user identities');
select throws_ok($$select * from public.shared_corridor_daily_usage$$, '42501', null, 'usage ledger is private');
select throws_ok($$select public.shared_corridor_write('30000000-0000-0000-0000-000000000001','create','Quiet')$$, '42501', null, 'demo artworks excluded');
select is(public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'notes','[]'::jsonb,'empty page');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','   ')$$, 'P0414', null, 'blank blocked');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create',repeat('🌿',141))$$, 'P0414', null, 'Unicode length enforced');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','visit https://spam.example')$$, 'P0422', null, 'link spam blocked in database');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','fucking beautiful')$$, 'P0422', null, 'profanity blocked in database');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','ｆｕｃｋ')$$, 'P0422', null, 'compatibility forms normalized before moderation');
select is(public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create', E'  Quiet\n light  ')->>'noteText', 'Quiet light', 'creation normalizes whitespace');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','Again')$$, '23505', null, 'one note per member and artwork');
select is(public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'ownNote'->>'isOwn','true','owner can find own note');
select ok(not ((public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'notes'->0) ? 'user_id'), 'no user identifiers in output');

set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000002';
select is(public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'notes'->0->>'isOwn','false','another member sees anonymous note');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'update','Stolen')$$, 'P0404', null, 'cannot edit another member note');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'delete')$$, 'P0404', null, 'cannot delete another member note');
select lives_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','A second reflection')$$,'another member may leave their own note');

set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000001';
select is(public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'update','Soft light')->>'noteText','Soft light','owner edit');
select lives_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'delete')$$,'owner delete');

reset role;
select is((select creations from public.shared_corridor_daily_usage where user_id='81000000-0000-0000-0000-000000000001'),1,'failed writes and deletion do not reset allowance');
update public.shared_corridor_daily_usage set creations=10 where user_id='81000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','One more')$$, 'P0429', null, 'daily creation limit enforced');
reset role;
update public.early_access_members set revoked_at=now() where user_id='81000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.shared_corridor_page(current_setting('corridor.artwork')::uuid)$$, '42501', null, 'revocation immediately blocks reads');
select throws_ok($$select public.shared_corridor_write(current_setting('corridor.artwork')::uuid,'create','Quiet')$$, '42501', null, 'revocation blocks writes');
reset role;
update public.early_access_members set revoked_at=null,expires_at=now()-interval '1 minute' where user_id='81000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(public.shared_corridor_access(current_setting('corridor.artwork')::uuid),false,'expired membership denied');

reset role;
update public.early_access_members set expires_at=null where user_id='81000000-0000-0000-0000-000000000001';
insert into auth.users(id,email,raw_user_meta_data)
 select ('82000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid, 'corridor-page-'||i||'@example.com','{}' from generate_series(1,8) i;
insert into public.shared_corridor_notes(id,artwork_id,user_id,note_text,created_at)
 select ('83000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid, current_setting('corridor.artwork')::uuid, ('82000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'Reflection '||i, now()+interval '1 minute' from generate_series(1,8) i;
set local role authenticated;
select is(jsonb_array_length(public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'notes'),6,'first page bounded at six');
select is(public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'notes'->0->>'noteText','Reflection 8','stable descending order with timestamp ties');
select set_config('corridor.cursor', (public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'nextCursor')::text,true);
select is(jsonb_array_length(public.shared_corridor_page(current_setting('corridor.artwork')::uuid,
 (current_setting('corridor.cursor')::jsonb->>'createdAt')::timestamptz,
 (current_setting('corridor.cursor')::jsonb->>'id')::uuid)->'notes'),3,'keyset pagination has no omissions');
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000002';
select is(public.shared_corridor_page(current_setting('corridor.artwork')::uuid)->'ownNote'->>'noteText','A second reflection','older own note remains editable outside page');
select * from finish();
rollback;
