create table if not exists public.event_logins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  username text unique not null,
  password_hash text not null,
  active boolean not null default true,
  expires_at timestamptz null,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id)
);

create index if not exists event_logins_event_id_idx on public.event_logins(event_id);
create index if not exists event_logins_username_idx on public.event_logins(username);
create unique index if not exists event_logins_one_active_access_per_event_idx on public.event_logins(event_id);

alter table public.event_photos
add column if not exists status text not null default 'pendiente',
add column if not exists is_public boolean not null default false,
add column if not exists approved_at timestamptz null,
add column if not exists approved_by_event_login uuid null references public.event_logins(id);

alter table public.event_photos
drop constraint if exists event_photos_status_check;

alter table public.event_photos
add constraint event_photos_status_check
check (status in ('pendiente', 'aprobada', 'rechazada'));

update public.event_photos
set status = case when is_approved then 'aprobada' else status end,
    is_public = case when is_approved then true else is_public end,
    approved_at = case when is_approved and approved_at is null then created_at else approved_at end;

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on public.event_logins to service_role;
grant select, insert, update, delete on public.event_photos to service_role;
grant select on public.event_photos to anon, authenticated;
grant insert on public.event_photos to anon, authenticated;

alter table public.event_logins enable row level security;
alter table public.event_photos enable row level security;

drop policy if exists "event_logins_service_role_all" on public.event_logins;

create policy "event_logins_service_role_all"
on public.event_logins
for all
to service_role
using (true)
with check (true);

drop policy if exists "photos_public_select_approved" on public.event_photos;
drop policy if exists "photos_public_insert_for_published_events" on public.event_photos;
drop policy if exists "photos_update_owner_or_admin" on public.event_photos;
drop policy if exists "photos_service_role_all" on public.event_photos;
drop policy if exists "photos_public_select_public_approved" on public.event_photos;
drop policy if exists "photos_public_insert_for_published_events_v2" on public.event_photos;
drop policy if exists "photos_owner_select_all" on public.event_photos;

create policy "photos_service_role_all"
on public.event_photos
for all
to service_role
using (true)
with check (true);

create policy "photos_public_select_public_approved"
on public.event_photos
for select
to anon, authenticated
using (status = 'aprobada' and is_public = true);

create policy "photos_public_insert_for_published_events_v2"
on public.event_photos
for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.events
    where events.id = event_photos.event_id
      and events.status = 'publicado'
  )
);

create policy "photos_owner_select_all"
on public.event_photos
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = event_photos.event_id
      and events.owner_id = auth.uid()
  )
);
