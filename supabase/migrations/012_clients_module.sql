create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  notes text,
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.clients
drop constraint if exists clients_status_check;

alter table public.clients
add constraint clients_status_check
check (status in ('activo', 'inactivo'));

alter table public.events
add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists clients_status_idx on public.clients(status);
create index if not exists events_client_id_idx on public.events(client_id);

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on public.clients to service_role;
grant select on public.clients to authenticated;
grant update (client_id) on public.events to authenticated;
grant update (client_id) on public.events to service_role;

alter table public.clients enable row level security;

drop policy if exists "clients_service_role_all" on public.clients;
drop policy if exists "clients_admin_select_all" on public.clients;
drop policy if exists "clients_event_related_select" on public.clients;

create policy "clients_service_role_all"
on public.clients
for all
to service_role
using (true)
with check (true);

create policy "clients_admin_select_all"
on public.clients
for select
to authenticated
using (public.is_admin());

create policy "clients_event_related_select"
on public.clients
for select
to authenticated
using (
  exists (
    select 1
    from public.events
    where events.client_id = clients.id
      and events.owner_id = auth.uid()
  )
);
