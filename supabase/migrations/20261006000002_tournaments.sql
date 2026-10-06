-- Torneos: eliminación directa, round robin por grupos, o grupos +
-- eliminatoria (híbrido). La combinatoria del cuadro (byes, sembrado,
-- reparto de grupos) se calcula en TypeScript (lib/bracket.ts) y llega acá
-- ya resuelta — esta migración solo persiste el resultado y resuelve el
-- avance de ganador en vivo cuando se carga un resultado, que sí depende
-- de datos en el momento.

create type public.tournament_format as enum ('single_elimination', 'round_robin', 'group_knockout');
create type public.tournament_match_phase as enum ('group', 'knockout');
create type public.match_status as enum ('pending', 'scheduled', 'completed');

create table public.tournament (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club (id) on delete cascade,
  name text not null,
  category text,
  format public.tournament_format not null,
  group_size integer,
  advance_per_group integer,
  registration_open boolean not null default true,
  bracket_generated boolean not null default false,
  knockout_generated boolean not null default false,
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (id, club_id),
  check (format = 'single_elimination' or (group_size is not null and group_size >= 2)),
  check (format <> 'group_knockout' or (advance_per_group is not null and advance_per_group >= 1))
);

create index tournament_club_idx on public.tournament (club_id);

create table public.tournament_entry (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  club_id uuid not null references public.club (id) on delete cascade,
  person_id uuid not null,
  seed integer,
  group_label text,
  created_at timestamptz not null default now(),

  unique (tournament_id, person_id),
  constraint tournament_entry_tournament_fk foreign key (tournament_id, club_id)
    references public.tournament (id, club_id),
  constraint tournament_entry_person_fk foreign key (person_id, club_id)
    references public.membership (person_id, club_id)
);

create table public.tournament_match (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  club_id uuid not null references public.club (id) on delete cascade,
  phase public.tournament_match_phase not null default 'group',
  round integer not null default 1,
  slot integer not null,
  entry1_id uuid,
  entry2_id uuid,
  winner_entry_id uuid,
  score text,
  status public.match_status not null default 'pending',
  court_id uuid,
  booking_id uuid,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),

  unique (tournament_id, phase, round, slot),
  constraint tournament_match_tournament_fk foreign key (tournament_id, club_id)
    references public.tournament (id, club_id),
  constraint tournament_match_entry1_fk foreign key (entry1_id) references public.tournament_entry (id),
  constraint tournament_match_entry2_fk foreign key (entry2_id) references public.tournament_entry (id),
  constraint tournament_match_winner_fk foreign key (winner_entry_id) references public.tournament_entry (id),
  constraint tournament_match_court_fk foreign key (court_id, club_id)
    references public.court (id, club_id),
  constraint tournament_match_booking_fk foreign key (booking_id) references public.booking (id),

  check (winner_entry_id is null or winner_entry_id = entry1_id or winner_entry_id = entry2_id),
  check (status <> 'completed' or winner_entry_id is not null),
  -- Only a *scheduled* match requires both players — a bye auto-completes
  -- with just one (the real player wins without playing), and a future
  -- knockout-round match starts 'pending' with neither known yet.
  check (status <> 'scheduled' or (entry1_id is not null and entry2_id is not null))
);

create index tournament_match_tournament_idx on public.tournament_match (tournament_id);

-- booking gains a link to the match whose court/time it reserves. A match
-- (like a course session) isn't "booked by" one person — the real
-- participants live on tournament_match, not on booking — so the existing
-- check needs to allow this third case too (it already allows 'course').

alter table public.booking add column tournament_match_id uuid;
alter table public.booking add constraint booking_tournament_match_fk
  foreign key (tournament_match_id) references public.tournament_match (id);

alter table public.booking drop constraint booking_check2;
alter table public.booking add constraint booking_check2
  check (
    status = 'blocked'
    or type in ('course', 'tournament')
    or person_id is not null
    or guest_name is not null
  );

-- ---------------------------------------------------------------------------
-- Grants and RLS — brackets are public within the club (anyone can see the
-- draw), same spirit as a real tournament board at the club.
-- ---------------------------------------------------------------------------

grant select on public.tournament, public.tournament_entry, public.tournament_match to authenticated;
-- Scheduling/results/bracket generation all go through RPCs below; the
-- editable-by-admin fields here are the ones that stay meaningful no
-- matter what stage the tournament is in.
grant update (name, category, start_date, active, registration_open)
  on public.tournament to authenticated;

alter table public.tournament enable row level security;
alter table public.tournament_entry enable row level security;
alter table public.tournament_match enable row level security;

create policy tournament_select on public.tournament for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy tournament_update on public.tournament for update to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());

create policy tournament_entry_select on public.tournament_entry for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy tournament_match_select on public.tournament_match for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

-- ---------------------------------------------------------------------------
-- create_tournament
-- ---------------------------------------------------------------------------

create function public.create_tournament(
  p_club uuid,
  p_name text,
  p_category text,
  p_format public.tournament_format,
  p_group_size integer,
  p_advance_per_group integer,
  p_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (internal.has_role(p_club, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot create tournaments for this club' using errcode = '42501';
  end if;

  insert into public.tournament (club_id, name, category, format, group_size, advance_per_group, start_date)
  values (p_club, p_name, p_category, p_format, p_group_size, p_advance_per_group, p_start_date)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------------

create function public.request_tournament_entry(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament public.tournament%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_tournament from public.tournament where id = p_tournament_id;
  if not found then
    raise exception 'Tournament not found' using errcode = 'P0002';
  end if;
  if not v_tournament.registration_open or not v_tournament.active then
    raise exception 'Registration is closed for this tournament' using errcode = '22023';
  end if;
  if not (
    internal.has_role(v_tournament.club_id, 'student')
    and internal.module_enabled(v_tournament.club_id, 'tournaments')
  ) then
    raise exception 'You cannot register for this tournament' using errcode = '42501';
  end if;

  insert into public.tournament_entry (tournament_id, club_id, person_id)
  values (p_tournament_id, v_tournament.club_id, v_uid);
end;
$$;

create function public.register_entry(p_tournament_id uuid, p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournament%rowtype;
begin
  select * into v_tournament from public.tournament where id = p_tournament_id;
  if not found then
    raise exception 'Tournament not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_tournament.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot manage entries for this tournament' using errcode = '42501';
  end if;

  insert into public.tournament_entry (tournament_id, club_id, person_id)
  values (p_tournament_id, v_tournament.club_id, p_person_id);
end;
$$;

create function public.withdraw_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.tournament_entry%rowtype;
  v_tournament public.tournament%rowtype;
begin
  select * into v_entry from public.tournament_entry where id = p_entry_id;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  select * into v_tournament from public.tournament where id = v_entry.tournament_id;
  if not (internal.has_role(v_tournament.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot manage entries for this tournament' using errcode = '42501';
  end if;
  if v_tournament.bracket_generated then
    raise exception 'The bracket is already generated — deactivate the tournament instead' using errcode = '22023';
  end if;

  delete from public.tournament_entry where id = p_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_bracket / generate_knockout_phase — the caller (server action)
-- computes the full match list with lib/bracket.ts and passes it as jsonb;
-- this just validates authorization/state and writes it atomically.
-- ---------------------------------------------------------------------------

create function public.generate_bracket(
  p_tournament_id uuid,
  p_entries jsonb, -- [{entry_id, group_label}]
  p_matches jsonb  -- [{phase, round, slot, entry1_id, entry2_id, winner_entry_id}]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournament%rowtype;
  v_entry jsonb;
  v_match jsonb;
begin
  select * into v_tournament from public.tournament where id = p_tournament_id for update;
  if not found then
    raise exception 'Tournament not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_tournament.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot manage this tournament' using errcode = '42501';
  end if;
  if v_tournament.bracket_generated then
    raise exception 'The bracket was already generated' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries) loop
    update public.tournament_entry
    set group_label = v_entry->>'group_label'
    where id = (v_entry->>'entry_id')::uuid and tournament_id = p_tournament_id;
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_match
      (tournament_id, club_id, phase, round, slot, entry1_id, entry2_id, winner_entry_id, status)
    values (
      p_tournament_id,
      v_tournament.club_id,
      (v_match->>'phase')::public.tournament_match_phase,
      (v_match->>'round')::integer,
      (v_match->>'slot')::integer,
      nullif(v_match->>'entry1_id', '')::uuid,
      nullif(v_match->>'entry2_id', '')::uuid,
      nullif(v_match->>'winner_entry_id', '')::uuid,
      case when v_match->>'winner_entry_id' is not null and v_match->>'winner_entry_id' <> ''
           then 'completed' else 'pending' end
    );
  end loop;

  update public.tournament set registration_open = false, bracket_generated = true where id = p_tournament_id;
end;
$$;

create function public.generate_knockout_phase(p_tournament_id uuid, p_matches jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournament%rowtype;
  v_match jsonb;
  v_pending_groups integer;
begin
  select * into v_tournament from public.tournament where id = p_tournament_id for update;
  if not found then
    raise exception 'Tournament not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_tournament.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot manage this tournament' using errcode = '42501';
  end if;
  if v_tournament.format <> 'group_knockout' then
    raise exception 'This tournament has no knockout phase' using errcode = '22023';
  end if;
  if not v_tournament.bracket_generated then
    raise exception 'Generate the group stage first' using errcode = '22023';
  end if;
  if v_tournament.knockout_generated then
    raise exception 'The knockout phase was already generated' using errcode = '22023';
  end if;

  select count(*) into v_pending_groups
  from public.tournament_match
  where tournament_id = p_tournament_id and phase = 'group' and status <> 'completed';
  if v_pending_groups > 0 then
    raise exception 'All group matches must have a result first' using errcode = '22023';
  end if;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_match
      (tournament_id, club_id, phase, round, slot, entry1_id, entry2_id, winner_entry_id, status)
    values (
      p_tournament_id,
      v_tournament.club_id,
      'knockout',
      (v_match->>'round')::integer,
      (v_match->>'slot')::integer,
      nullif(v_match->>'entry1_id', '')::uuid,
      nullif(v_match->>'entry2_id', '')::uuid,
      nullif(v_match->>'winner_entry_id', '')::uuid,
      case when v_match->>'winner_entry_id' is not null and v_match->>'winner_entry_id' <> ''
           then 'completed' else 'pending' end
    );
  end loop;

  update public.tournament set knockout_generated = true where id = p_tournament_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- schedule_match — books the court for a match whose two players are known.
-- Rescheduling cancels the previous booking first.
-- ---------------------------------------------------------------------------

create function public.schedule_match(
  p_match_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.tournament_match%rowtype;
  v_booking_id uuid;
begin
  select * into v_match from public.tournament_match where id = p_match_id for update;
  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_match.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot schedule this match' using errcode = '42501';
  end if;
  if v_match.entry1_id is null or v_match.entry2_id is null then
    raise exception 'Both players must be known before scheduling' using errcode = '22023';
  end if;
  if v_match.status = 'completed' then
    raise exception 'This match already has a result' using errcode = '22023';
  end if;

  if v_match.booking_id is not null then
    update public.booking set status = 'cancelled' where id = v_match.booking_id;
  end if;

  insert into public.booking (club_id, court_id, type, status, starts_at, ends_at, tournament_match_id)
  values (v_match.club_id, p_court_id, 'tournament', 'confirmed', p_starts_at, p_ends_at, p_match_id)
  returning id into v_booking_id;

  update public.tournament_match
  set status = 'scheduled', court_id = p_court_id, scheduled_at = p_starts_at, booking_id = v_booking_id
  where id = p_match_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_match_result — admin-only. Advances the winner into the next
-- knockout-round slot when applicable; group-phase matches never
-- propagate (they don't feed into anything by themselves).
-- ---------------------------------------------------------------------------

create function public.report_match_result(p_match_id uuid, p_winner_entry_id uuid, p_score text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.tournament_match%rowtype;
begin
  select * into v_match from public.tournament_match where id = p_match_id for update;
  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_match.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot report this result' using errcode = '42501';
  end if;
  if v_match.entry1_id is null or v_match.entry2_id is null then
    raise exception 'Both players must be known first' using errcode = '22023';
  end if;
  if p_winner_entry_id <> v_match.entry1_id and p_winner_entry_id <> v_match.entry2_id then
    raise exception 'The winner must be one of the two players' using errcode = '22023';
  end if;

  update public.tournament_match
  set status = 'completed', winner_entry_id = p_winner_entry_id, score = p_score
  where id = p_match_id;

  if v_match.phase = 'knockout' then
    update public.tournament_match
    set entry1_id = case when v_match.slot % 2 = 0 then p_winner_entry_id else entry1_id end,
        entry2_id = case when v_match.slot % 2 = 1 then p_winner_entry_id else entry2_id end
    where tournament_id = v_match.tournament_id
      and phase = 'knockout'
      and round = v_match.round + 1
      and slot = v_match.slot / 2;
  end if;
end;
$$;

revoke all on function
  public.create_tournament(uuid, text, text, public.tournament_format, integer, integer, date),
  public.request_tournament_entry(uuid),
  public.register_entry(uuid, uuid),
  public.withdraw_entry(uuid),
  public.generate_bracket(uuid, jsonb, jsonb),
  public.generate_knockout_phase(uuid, jsonb),
  public.schedule_match(uuid, uuid, timestamptz, timestamptz),
  public.report_match_result(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function
  public.create_tournament(uuid, text, text, public.tournament_format, integer, integer, date),
  public.request_tournament_entry(uuid),
  public.register_entry(uuid, uuid),
  public.withdraw_entry(uuid),
  public.generate_bracket(uuid, jsonb, jsonb),
  public.generate_knockout_phase(uuid, jsonb),
  public.schedule_match(uuid, uuid, timestamptz, timestamptz),
  public.report_match_result(uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Read-side RPCs — join in person/court names, same "empty instead of
-- erroring" pattern as list_club_members / list_pending_payments.
-- ---------------------------------------------------------------------------

create function public.list_club_tournaments(p_club uuid)
returns table (
  id uuid,
  name text,
  category text,
  format public.tournament_format,
  group_size integer,
  advance_per_group integer,
  registration_open boolean,
  bracket_generated boolean,
  knockout_generated boolean,
  start_date date,
  active boolean,
  entry_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.name, t.category, t.format, t.group_size, t.advance_per_group,
    t.registration_open, t.bracket_generated, t.knockout_generated, t.start_date, t.active,
    (select count(*) from public.tournament_entry te where te.tournament_id = t.id)
  from public.tournament t
  where t.club_id = p_club and internal.is_member(p_club)
  order by t.created_at desc;
$$;

create function public.list_tournament_entries(p_tournament_id uuid)
returns table (id uuid, person_id uuid, full_name text, seed integer, group_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select te.id, te.person_id, p.full_name, te.seed, te.group_label
  from public.tournament_entry te
  join public.person p on p.id = te.person_id
  join public.tournament t on t.id = te.tournament_id
  where te.tournament_id = p_tournament_id and internal.is_member(t.club_id)
  order by coalesce(te.seed, 999999), p.full_name;
$$;

create function public.list_tournament_matches(p_tournament_id uuid)
returns table (
  id uuid,
  phase public.tournament_match_phase,
  round integer,
  slot integer,
  entry1_id uuid,
  entry1_name text,
  entry2_id uuid,
  entry2_name text,
  winner_entry_id uuid,
  score text,
  status public.match_status,
  court_id uuid,
  court_name text,
  scheduled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id, m.phase, m.round, m.slot,
    m.entry1_id, p1.full_name, m.entry2_id, p2.full_name,
    m.winner_entry_id, m.score, m.status, m.court_id, c.name, m.scheduled_at
  from public.tournament_match m
  join public.tournament t on t.id = m.tournament_id
  left join public.tournament_entry e1 on e1.id = m.entry1_id
  left join public.person p1 on p1.id = e1.person_id
  left join public.tournament_entry e2 on e2.id = m.entry2_id
  left join public.person p2 on p2.id = e2.person_id
  left join public.court c on c.id = m.court_id
  where m.tournament_id = p_tournament_id and internal.is_member(t.club_id)
  order by m.phase, m.round, m.slot;
$$;

revoke all on function
  public.list_club_tournaments(uuid), public.list_tournament_entries(uuid), public.list_tournament_matches(uuid)
  from public, anon, authenticated;

grant execute on function
  public.list_club_tournaments(uuid), public.list_tournament_entries(uuid), public.list_tournament_matches(uuid)
  to authenticated;
