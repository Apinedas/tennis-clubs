-- Club settings: branding, currency and contact info, plus the storage
-- bucket for club logos.

alter table public.club
  add column contact_email text,
  add column contact_phone text,
  add column currency text not null default 'COP'
    check (currency in ('COP', 'USD', 'EUR', 'PEN')),
  add column brand_color text not null default '#1B7F4F'
    check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text;

-- ---------------------------------------------------------------------------
-- Club logos
--
-- Public bucket: logos are shown on the public microsite once it exists, so
-- reads don't require auth. Path convention: {club_id}/<filename>, so a
-- single policy can check the folder against the club a person administers.
-- Row-level access to the `club` table itself already enforces who can see
-- and edit which club (see the `club_select`/`club_update` policies);
-- storage only needs to mirror the write side.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;

create policy club_logos_read on storage.objects for select
  using (bucket_id = 'club-logos');

create policy club_logos_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'club-logos'
    and (
      internal.has_role(((storage.foldername(name))[1])::uuid, 'admin')
      or internal.is_platform_admin()
    )
  );

create policy club_logos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'club-logos'
    and (
      internal.has_role(((storage.foldername(name))[1])::uuid, 'admin')
      or internal.is_platform_admin()
    )
  )
  with check (
    bucket_id = 'club-logos'
    and (
      internal.has_role(((storage.foldername(name))[1])::uuid, 'admin')
      or internal.is_platform_admin()
    )
  );

create policy club_logos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'club-logos'
    and (
      internal.has_role(((storage.foldername(name))[1])::uuid, 'admin')
      or internal.is_platform_admin()
    )
  );
