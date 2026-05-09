-- 034_canvas_v3_templates.sql
-- Persisted, editable Canvas V3 templates.
-- This does not connect UI or change event rendering behavior.

create table if not exists public.canvas_v3_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  compatible_event_types text[] not null default '{}'::text[],
  visual_category text,
  description text,
  template_scope text not null default 'full',
  design jsonb not null,
  preview_image_url text,
  thumbnail_url text,
  is_premium boolean not null default false,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  source_event_id uuid references public.events(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canvas_v3_templates_scope_check
    check (template_scope in ('full', 'section', 'component')),
  constraint canvas_v3_templates_design_object_check
    check (jsonb_typeof(design) = 'object'),
  constraint canvas_v3_templates_design_version_check
    check (design->>'version' = '3')
);

create index if not exists canvas_v3_templates_is_active_idx
  on public.canvas_v3_templates(is_active);

create index if not exists canvas_v3_templates_compatible_event_types_idx
  on public.canvas_v3_templates using gin(compatible_event_types);

create index if not exists canvas_v3_templates_visual_category_idx
  on public.canvas_v3_templates(visual_category);

create index if not exists canvas_v3_templates_sort_order_idx
  on public.canvas_v3_templates(sort_order);

create index if not exists canvas_v3_templates_source_event_id_idx
  on public.canvas_v3_templates(source_event_id);

drop trigger if exists canvas_v3_templates_set_updated_at on public.canvas_v3_templates;
create trigger canvas_v3_templates_set_updated_at
  before update on public.canvas_v3_templates
  for each row execute function public.set_updated_at();

grant usage on schema public to anon, authenticated, service_role;

grant select on public.canvas_v3_templates to anon;
grant select, insert, update, delete on public.canvas_v3_templates to authenticated;
grant select, insert, update, delete on public.canvas_v3_templates to service_role;

alter table public.canvas_v3_templates enable row level security;

drop policy if exists "canvas_v3_templates_public_select_active" on public.canvas_v3_templates;
drop policy if exists "canvas_v3_templates_authenticated_select_all" on public.canvas_v3_templates;
drop policy if exists "canvas_v3_templates_authenticated_insert" on public.canvas_v3_templates;
drop policy if exists "canvas_v3_templates_authenticated_update" on public.canvas_v3_templates;
drop policy if exists "canvas_v3_templates_authenticated_delete" on public.canvas_v3_templates;
drop policy if exists "canvas_v3_templates_service_role_all" on public.canvas_v3_templates;

create policy "canvas_v3_templates_public_select_active"
  on public.canvas_v3_templates
  for select
  to anon
  using (is_active = true);

create policy "canvas_v3_templates_authenticated_select_all"
  on public.canvas_v3_templates
  for select
  to authenticated
  using (true);

create policy "canvas_v3_templates_authenticated_insert"
  on public.canvas_v3_templates
  for insert
  to authenticated
  with check (true);

create policy "canvas_v3_templates_authenticated_update"
  on public.canvas_v3_templates
  for update
  to authenticated
  using (true)
  with check (true);

create policy "canvas_v3_templates_authenticated_delete"
  on public.canvas_v3_templates
  for delete
  to authenticated
  using (true);

create policy "canvas_v3_templates_service_role_all"
  on public.canvas_v3_templates
  for all
  to service_role
  using (true)
  with check (true);
