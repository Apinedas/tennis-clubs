-- review_entry's CASE WHEN ... THEN 'active' ELSE 'cancelled' END came back
-- untyped (same bug already hit once in generate_bracket/generate_knockout_phase
-- for match_status) and was rejected assigning into the entry_status column.
-- Explicit cast, fixed via create or replace since the signature is unchanged.

create or replace function public.review_entry(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_entry public.tournament_entry%rowtype;
begin
  select * into v_entry from public.tournament_entry where id = p_id for update;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  if not (internal.has_role(v_entry.club_id, 'admin') or internal.is_platform_admin()) then
    raise exception 'You cannot review entries for this club' using errcode = '42501';
  end if;
  if v_entry.status <> 'pending' then
    raise exception 'This entry has nothing pending review' using errcode = '22023';
  end if;

  update public.tournament_entry
  set status = (case when p_approve then 'active' else 'cancelled' end)::public.entry_status,
      payment_rejection_note = p_note,
      reviewed_by = v_uid,
      reviewed_at = now()
  where id = p_id;
end;
$$;
