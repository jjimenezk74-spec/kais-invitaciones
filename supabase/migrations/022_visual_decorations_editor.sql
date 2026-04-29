alter table public.events
  add column if not exists visual_decorations jsonb not null default '[]'::jsonb;

grant select (visual_decorations) on public.events to anon, authenticated;
grant insert (visual_decorations) on public.events to authenticated;
grant update (visual_decorations) on public.events to authenticated;
grant insert (visual_decorations) on public.events to service_role;
grant update (visual_decorations) on public.events to service_role;
