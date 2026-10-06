-- generate_bracket / generate_knockout_phase computed the initial match
-- status as a plain text literal ('completed'/'pending') instead of
-- casting it to match_status, which Postgres won't infer on its own inside
-- a CASE expression feeding an enum column.

create or replace function public.generate_bracket(
  p_tournament_id uuid,
  p_entries jsonb,
  p_matches jsonb
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
      (case when v_match->>'winner_entry_id' is not null and v_match->>'winner_entry_id' <> ''
            then 'completed' else 'pending' end)::public.match_status
    );
  end loop;

  update public.tournament set registration_open = false, bracket_generated = true where id = p_tournament_id;
end;
$$;

create or replace function public.generate_knockout_phase(p_tournament_id uuid, p_matches jsonb)
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
      (case when v_match->>'winner_entry_id' is not null and v_match->>'winner_entry_id' <> ''
            then 'completed' else 'pending' end)::public.match_status
    );
  end loop;

  update public.tournament set knockout_generated = true where id = p_tournament_id;
end;
$$;
