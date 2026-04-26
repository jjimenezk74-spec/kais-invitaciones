grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant delete on public.events to authenticated;
grant select, delete on public.events to service_role;

alter table public.events enable row level security;

drop policy if exists "events_authenticated_delete_own" on public.events;
drop policy if exists "events_delete_admin" on public.events;
drop policy if exists "events_authenticated_delete_admin_only" on public.events;

create policy "events_authenticated_delete_admin_only"
on public.events
for delete
to authenticated
using (public.is_admin());
