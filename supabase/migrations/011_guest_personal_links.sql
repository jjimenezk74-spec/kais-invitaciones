alter table public.events
add column if not exists guest_mode text not null default 'publico';

alter table public.events
drop constraint if exists events_guest_mode_check;

alter table public.events
add constraint events_guest_mode_check
check (guest_mode in ('publico', 'lista_invitados'));

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  phone text not null,
  email text null,
  token text unique not null,
  max_companions integer not null default 0 check (max_companions >= 0),
  status text not null default 'pendiente',
  rsvp_id uuid null references public.rsvps(id) on delete set null,
  last_opened_at timestamptz null,
  created_at timestamptz default now()
);

alter table public.event_guests
drop constraint if exists event_guests_status_check;

alter table public.event_guests
add constraint event_guests_status_check
check (status in ('pendiente', 'confirmado', 'no_asiste', 'bloqueado'));

create index if not exists event_guests_event_id_idx on public.event_guests(event_id);
create index if not exists event_guests_token_idx on public.event_guests(token);
create index if not exists event_guests_rsvp_id_idx on public.event_guests(rsvp_id);

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on public.event_guests to service_role;
grant select on public.event_guests to authenticated;
grant update (guest_mode) on public.events to authenticated;
grant update (guest_mode) on public.events to service_role;

alter table public.event_guests enable row level security;

drop policy if exists "event_guests_service_role_all" on public.event_guests;
drop policy if exists "event_guests_owner_or_admin_select" on public.event_guests;

create policy "event_guests_service_role_all"
on public.event_guests
for all
to service_role
using (true)
with check (true);

create policy "event_guests_owner_or_admin_select"
on public.event_guests
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.events
    where events.id = event_guests.event_id
      and events.owner_id = auth.uid()
  )
);

drop policy if exists "rsvps_public_insert_for_published_events" on public.rsvps;
drop policy if exists "rsvps_public_insert_for_published_events_v2" on public.rsvps;
drop policy if exists "rsvps_public_insert_for_public_mode_events" on public.rsvps;

create policy "rsvps_public_insert_for_public_mode_events"
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
      and coalesce(events.guest_mode, 'publico') = 'publico'
  )
);
