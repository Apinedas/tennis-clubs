-- Payment review: no payment gateway, just a status the admin can review
-- and approve, backed by an uploaded proof of payment (comprobante). Phase
-- 2 per CLAUDE.md, scoped down to review-only — no charges are ever
-- processed here.

create type public.payment_status as enum ('unpaid', 'pending_review', 'paid');

alter table public.booking
  add column payment_status public.payment_status not null default 'unpaid',
  add column payment_proof_path text,
  add column payment_rejection_note text,
  add column payment_reviewed_by uuid references public.person (id) on delete set null,
  add column payment_reviewed_at timestamptz,
  -- Maintenance/rain blocks aren't a transaction; never let them drift out
  -- of 'unpaid' (mirrors the existing "blocked has no person/type" checks).
  add constraint booking_blocked_stays_unpaid
    check (type is not null or payment_status = 'unpaid');

-- ---------------------------------------------------------------------------
-- Submit / review — security definer, no direct update grant (same as
-- cancel_booking / accept_lesson_request: the booking table has no UPDATE
-- grant to non-owners, everything goes through a function).
-- ---------------------------------------------------------------------------

create function public.submit_payment_proof(p_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.booking%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_booking from public.booking where id = p_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.person_id <> v_uid then
    raise exception 'You cannot submit proof for this booking' using errcode = '42501';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'This booking is cancelled' using errcode = '22023';
  end if;
  if v_booking.type is null then
    raise exception 'This booking has no payment to submit' using errcode = '22023';
  end if;

  update public.booking
  set payment_status = 'pending_review',
      payment_proof_path = p_path,
      payment_rejection_note = null
  where id = p_id;
end;
$$;

create function public.mark_booking_paid(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.booking%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_booking from public.booking where id = p_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.type is null then
    raise exception 'A block has no payment to mark' using errcode = '22023';
  end if;

  if not (
    internal.is_platform_admin()
    or internal.has_role(v_booking.club_id, 'admin')
  ) then
    raise exception 'You cannot review payments for this club' using errcode = '42501';
  end if;

  update public.booking
  set payment_status = 'paid',
      payment_rejection_note = null,
      payment_reviewed_by = v_uid,
      payment_reviewed_at = now()
  where id = p_id;
end;
$$;

create function public.reject_payment_proof(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.booking%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;

  select * into v_booking from public.booking where id = p_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if not (
    internal.is_platform_admin()
    or internal.has_role(v_booking.club_id, 'admin')
  ) then
    raise exception 'You cannot review payments for this club' using errcode = '42501';
  end if;
  if v_booking.payment_status <> 'pending_review' then
    raise exception 'This booking has no proof pending review' using errcode = '22023';
  end if;

  update public.booking
  set payment_status = 'unpaid',
      payment_rejection_note = p_note,
      payment_reviewed_by = v_uid,
      payment_reviewed_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_booking_paid(uuid) from public, anon, authenticated;
revoke all on function public.reject_payment_proof(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_payment_proof(uuid, text) to authenticated;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.reject_payment_proof(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin review queue. Same "empty instead of erroring" pattern as
-- list_club_members: unauthorized callers just see no rows.
-- ---------------------------------------------------------------------------

create function public.list_pending_payments(p_club uuid)
returns table (
  id uuid,
  type public.booking_type,
  starts_at timestamptz,
  ends_at timestamptz,
  court_name text,
  person_name text,
  guest_name text,
  payment_proof_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.type, b.starts_at, b.ends_at, c.name, p.full_name, b.guest_name, b.payment_proof_path
  from public.booking b
  join public.court c on c.id = b.court_id
  left join public.person p on p.id = b.person_id
  where b.club_id = p_club
    and b.payment_status = 'pending_review'
    and (internal.has_role(p_club, 'admin') or internal.is_platform_admin())
  order by b.starts_at;
$$;

revoke all on function public.list_pending_payments(uuid) from public, anon, authenticated;
grant execute on function public.list_pending_payments(uuid) to authenticated;

-- list_my_lessons: the return shape changes (payment columns), so this has
-- to be a drop + recreate rather than create or replace.
drop function public.list_my_lessons(uuid);

create function public.list_my_lessons(p_club uuid)
returns table (
  id uuid,
  status public.booking_status,
  starts_at timestamptz,
  ends_at timestamptz,
  court_name text,
  viewer_role public.club_role,
  counterpart_name text,
  notes text,
  payment_status public.payment_status,
  payment_proof_path text,
  payment_rejection_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id, b.status, b.starts_at, b.ends_at, c.name,
    case when b.person_id = auth.uid() then 'student' else 'coach' end::public.club_role,
    case when b.person_id = auth.uid() then coach.full_name else student.full_name end,
    b.notes, b.payment_status, b.payment_proof_path, b.payment_rejection_note
  from public.booking b
  join public.court c on c.id = b.court_id
  left join public.person student on student.id = b.person_id
  left join public.person coach on coach.id = b.coach_id
  where b.club_id = p_club
    and b.type = 'lesson'
    and (b.person_id = auth.uid() or b.coach_id = auth.uid())
  order by b.starts_at;
$$;

revoke all on function public.list_my_lessons(uuid) from public, anon, authenticated;
grant execute on function public.list_my_lessons(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Payment proofs storage — private (unlike club-logos): a receipt can carry
-- personal/financial info, so only the booking's owner and the club's
-- admins can ever read it. Path convention: {club_id}/{booking_id}/<file>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy payment_proofs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.booking b
      where b.id = ((storage.foldername(name))[2])::uuid
        and b.club_id = ((storage.foldername(name))[1])::uuid
        and b.person_id = auth.uid()
    )
  );

create policy payment_proofs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      exists (
        select 1 from public.booking b
        where b.id = ((storage.foldername(name))[2])::uuid
          and b.club_id = ((storage.foldername(name))[1])::uuid
          and b.person_id = auth.uid()
      )
      or internal.has_role(((storage.foldername(name))[1])::uuid, 'admin')
      or internal.is_platform_admin()
    )
  );

create policy payment_proofs_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.booking b
      where b.id = ((storage.foldername(name))[2])::uuid
        and b.club_id = ((storage.foldername(name))[1])::uuid
        and b.person_id = auth.uid()
    )
  );
