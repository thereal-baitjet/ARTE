-- Membership is provisioned by trusted server operations, never signup metadata.
create table public.early_access_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
create table public.shared_corridor_notes (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_text text not null check (char_length(btrim(note_text)) between 1 and 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, artwork_id)
);
create index shared_corridor_artwork_order on public.shared_corridor_notes (artwork_id, created_at desc, id desc);
-- A separate ledger prevents deleting a note from resetting the creation allowance.
create table public.shared_corridor_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  creations integer not null default 0,
  edits integer not null default 0,
  primary key (user_id, day)
);
alter table public.early_access_members enable row level security;
alter table public.shared_corridor_notes enable row level security;
alter table public.shared_corridor_daily_usage enable row level security;
revoke all on public.early_access_members, public.shared_corridor_notes, public.shared_corridor_daily_usage from public, anon, authenticated;
grant all on public.early_access_members, public.shared_corridor_notes, public.shared_corridor_daily_usage to service_role;

create function public.shared_corridor_access(p_artwork_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from public.early_access_members m where m.user_id = auth.uid()
      and m.revoked_at is null and (m.expires_at is null or m.expires_at > now()))
    and exists (select 1 from public.artworks a where a.id = p_artwork_id
      and a.is_published and not a.is_synthetic and a.image_rights_state = 'public_domain');
$$;

-- RPC output deliberately excludes user identifiers and profile data.
create function public.shared_corridor_page(p_artwork_id uuid, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; own_note jsonb; next_cursor jsonb;
begin
  if not public.shared_corridor_access(p_artwork_id) then raise exception 'Access unavailable' using errcode = '42501'; end if;
  if (p_before is null) <> (p_before_id is null) then raise exception 'Invalid cursor' using errcode = '22023'; end if;
  select jsonb_agg(jsonb_build_object('id', n.id, 'noteText', n.note_text,
    'createdAt', n.created_at, 'updatedAt', n.updated_at, 'isOwn', n.user_id = auth.uid())
    order by n.created_at desc, n.id desc) into result
  from (select * from public.shared_corridor_notes where artwork_id = p_artwork_id
    and (p_before is null or (created_at, id) < (p_before, p_before_id))
    order by created_at desc, id desc limit 7) n;
  if jsonb_array_length(result) > 6 then
    next_cursor := jsonb_build_object('createdAt', result->5->>'createdAt', 'id', result->5->>'id');
    result := result - 6;
  end if;
  select jsonb_build_object('id', id, 'noteText', note_text, 'createdAt', created_at,
    'updatedAt', updated_at, 'isOwn', true) into own_note
    from public.shared_corridor_notes where artwork_id = p_artwork_id and user_id = auth.uid();
  return jsonb_build_object('notes', coalesce(result, '[]'::jsonb), 'ownNote', own_note, 'nextCursor', next_cursor);
end;
$$;

create function public.shared_corridor_write(p_artwork_id uuid, p_operation text, p_note_text text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n public.shared_corridor_notes; clean_text text; allowance integer;
begin
  if not public.shared_corridor_access(p_artwork_id) then raise exception 'Access unavailable' using errcode = '42501'; end if;
  if p_operation = 'delete' then
    delete from public.shared_corridor_notes where artwork_id = p_artwork_id and user_id = auth.uid() returning * into n;
    if not found then raise exception 'Note unavailable' using errcode = 'P0404'; end if;
    return null;
  end if;
  if p_operation not in ('create', 'update') or p_operation is null then raise exception 'Invalid operation' using errcode = '22023'; end if;
  clean_text := btrim(regexp_replace(normalize(p_note_text, NFKC), '[[:space:]]+', ' ', 'g'));
  if clean_text is null or char_length(clean_text) not between 1 and 140 then
    raise exception 'Note must contain 1–140 characters' using errcode = 'P0414';
  end if;
  if clean_text ~* '(https?://|www\.|\m(fuck|fucking|shit|bitch|cunt|nigger|faggot)\M|\m(buy now|free money|click here)\M)'
    or clean_text ~ '[[:cntrl:]]' then
    raise exception 'Please revise this note' using errcode = 'P0422';
  end if;
  if p_operation = 'create' then
    insert into public.shared_corridor_daily_usage (user_id, day, creations)
      values (auth.uid(), (now() at time zone 'UTC')::date, 1)
      on conflict (user_id, day) do update set creations = public.shared_corridor_daily_usage.creations + 1
      where public.shared_corridor_daily_usage.creations < 10 returning creations into allowance;
    if not found then raise exception 'Daily allowance reached' using errcode = 'P0429'; end if;
    insert into public.shared_corridor_notes (artwork_id, user_id, note_text)
      values (p_artwork_id, auth.uid(), clean_text) returning * into n;
  else
    insert into public.shared_corridor_daily_usage (user_id, day, edits)
      values (auth.uid(), (now() at time zone 'UTC')::date, 1)
      on conflict (user_id, day) do update set edits = public.shared_corridor_daily_usage.edits + 1
      where public.shared_corridor_daily_usage.edits < 30 returning edits into allowance;
    if not found then raise exception 'Daily allowance reached' using errcode = 'P0429'; end if;
    update public.shared_corridor_notes set note_text = clean_text, updated_at = clock_timestamp()
      where artwork_id = p_artwork_id and user_id = auth.uid() returning * into n;
    if not found then raise exception 'Note unavailable' using errcode = 'P0404'; end if;
  end if;
  return jsonb_build_object('id', n.id, 'noteText', n.note_text, 'createdAt', n.created_at, 'updatedAt', n.updated_at, 'isOwn', true);
end;
$$;
revoke all on function public.shared_corridor_access(uuid), public.shared_corridor_page(uuid,timestamptz,uuid), public.shared_corridor_write(uuid,text,text) from public, anon, authenticated;
grant execute on function public.shared_corridor_access(uuid), public.shared_corridor_page(uuid,timestamptz,uuid), public.shared_corridor_write(uuid,text,text) to authenticated;
