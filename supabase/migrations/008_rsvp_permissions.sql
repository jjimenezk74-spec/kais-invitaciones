create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  phone text,
  email text,
  attending boolean not null,
  companions integer not null default 0 check (companions >= 0),
  message text,
  dietary_restrictions text,
  created_at timestamptz not null default now()
);

alter table public.rsvps
add column if not exists phone text,
add column if not exists email text,
add column if not exists message text,
add column if not exists dietary_restrictions text,
add column if not exists created_at timestamptz not null default now();

create index if not exists rsvps_event_id_idx on public.rsvps(event_id);

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant insert on public.rsvps to anon;
grant insert on public.rsvps to authenticated;
grant select on public.rsvps to authenticated;
grant select, insert, update, delete on public.rsvps to service_role;

alter table public.rsvps enable row level security;

drop policy if exists "rsvps_public_insert_for_published_events" on public.rsvps;
drop policy if exists "rsvps_public_insert_for_published_events_v2" on public.rsvps;
drop policy if exists "rsvps_select_owner_or_admin" on public.rsvps;
drop policy if exists "rsvps_select_owner_or_admin_v2" on public.rsvps;
drop policy if exists "rsvps_service_role_all" on public.rsvps;

create policy "rsvps_service_role_all"
on public.rsvps
for all
to service_role
using (true)
with check (true);

create policy "rsvps_public_insert_for_published_events_v2"
on public.rsvps
for insert
to anon, authenticated
with check (
  guest_name is not null
  and length(trim(guest_name)) > 0
  and companions >= 0
  and exists (
    select 1
    from public.events
    where events.id = rsvps.event_id
      and events.status = 'publicado'
  )
);

create policy "rsvps_select_owner_or_admin_v2"
on public.rsvps
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.events
    where events.id = rsvps.event_id
      and events.owner_id = auth.uid()
  )
);
