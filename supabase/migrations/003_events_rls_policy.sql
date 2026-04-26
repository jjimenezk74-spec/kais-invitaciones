-- Events RLS and grants for KAIS INVITACIONES.
-- The current schema uses owner_id as the client/user id for each event.

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.events to service_role;

alter table public.events enable row level security;

drop policy if exists "events_public_select_published" on public.events;
drop policy if exists "events_insert_owner_or_admin" on public.events;
drop policy if exists "events_update_owner_or_admin" on public.events;
drop policy if exists "events_delete_admin" on public.events;
drop policy if exists "events_service_role_all" on public.events;
drop policy if exists "events_anon_read_published" on public.events;
drop policy if exists "events_authenticated_read_own_or_published" on public.events;
drop policy if exists "events_authenticated_insert_own" on public.events;
drop policy if exists "events_authenticated_update_own" on public.events;
drop policy if exists "events_authenticated_delete_own" on public.events;

create policy "events_service_role_all"
on public.events
for all
to service_role
using (true)
with check (true);

create policy "events_anon_read_published"
on public.events
for select
to anon
using (status = 'publicado');

create policy "events_authenticated_read_own_or_published"
on public.events
for select
to authenticated
using (
  owner_id = auth.uid()
  or status = 'publicado'
  or public.is_admin()
);

create policy "events_authenticated_insert_own"
on public.events
for insert
to authenticated
with check (
  owner_id = auth.uid()
  or public.is_admin()
);

create policy "events_authenticated_update_own"
on public.events
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.is_admin()
)
with check (
  owner_id = auth.uid()
  or public.is_admin()
);

create policy "events_authenticated_delete_own"
on public.events
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.is_admin()
);
