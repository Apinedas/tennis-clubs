-- Booking policy: one settings row per club (like club_module), covering
-- the scheduling rules a future booking engine will need to enforce.
--
-- No-show/late-cancellation penalties are deliberately left out: charging
-- them depends on a billing system (Payments, phase 2) that doesn't exist
-- yet, so storing a percentage/amount now would be a field nothing reads.

create table public.booking_policy (
  club_id uuid primary key references public.club (id) on delete cascade,
  slot_minutes integer not null default 60
    check (slot_minutes > 0 and slot_minutes <= 480),
  min_advance_hours integer not null default 1
    check (min_advance_hours >= 0 and min_advance_hours <= 720),
  max_advance_days integer not null default 14
    check (max_advance_days >= 1 and max_advance_days <= 365),
  cancellation_hours integer not null default 24
    check (cancellation_hours >= 0 and cancellation_hours <= 720),
  self_cancel_allowed boolean not null default true,
  accept_guests boolean not null default false,
  check (min_advance_hours < max_advance_days * 24)
);

-- Every new club gets its policy row with sane defaults, same as modules.
create function public.initialize_booking_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_policy (club_id) values (new.id);
  return new;
end;
$$;

create trigger club_initialize_booking_policy
  after insert on public.club
  for each row execute function public.initialize_booking_policy();

-- Backfill existing clubs (created before this migration).
insert into public.booking_policy (club_id)
select id from public.club
on conflict (club_id) do nothing;

alter table public.booking_policy enable row level security;

grant select, insert, update, delete on public.booking_policy to authenticated;

create policy booking_policy_select on public.booking_policy for select to authenticated
  using (internal.is_member(club_id) or internal.is_platform_admin());

create policy booking_policy_update on public.booking_policy for update to authenticated
  using (internal.has_role(club_id, 'admin') or internal.is_platform_admin())
  with check (internal.has_role(club_id, 'admin') or internal.is_platform_admin());
