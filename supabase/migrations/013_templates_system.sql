create table if not exists public.invitation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  category text not null,
  preview_image text,
  config jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.events
add column if not exists template_id uuid references public.invitation_templates(id) on delete set null;

create index if not exists invitation_templates_slug_idx on public.invitation_templates(slug);
create index if not exists events_template_id_idx on public.events(template_id);

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select on public.invitation_templates to anon;
grant select on public.invitation_templates to authenticated;
grant select, insert, update, delete on public.invitation_templates to service_role;
grant update (template_id) on public.events to authenticated;
grant update (template_id) on public.events to service_role;

alter table public.invitation_templates enable row level security;

drop policy if exists "templates_public_select_active" on public.invitation_templates;
drop policy if exists "templates_service_role_all" on public.invitation_templates;

create policy "templates_public_select_active"
on public.invitation_templates
for select
to anon, authenticated
using (active = true);

create policy "templates_service_role_all"
on public.invitation_templates
for all
to service_role
using (true)
with check (true);

insert into public.invitation_templates (name, slug, category, preview_image, config, active)
values
  (
    'Rosas Rojas 15 Años',
    'rosas-rojas-15',
    'quinceaños',
    null,
    '{
      "background":"dark-red",
      "primary":"#8B0000",
      "secondary":"#FFD700",
      "fontTitle":"Playfair Display",
      "fontBody":"Inter",
      "overlay":"black/40",
      "countdownStyle":"glass",
      "flowerTheme":"red-roses"
    }'::jsonb,
    true
  ),
  (
    'Princesa Rosa',
    'princesa-rosa',
    'quinceaños',
    null,
    '{
      "background":"soft-pink",
      "primary":"#DB2777",
      "secondary":"#FBCFE8",
      "fontTitle":"Playfair Display",
      "fontBody":"Inter",
      "overlay":"white/30",
      "countdownStyle":"soft",
      "flowerTheme":"pink-garden"
    }'::jsonb,
    true
  ),
  (
    'Dorado Elegante',
    'dorado-elegante',
    'premium',
    null,
    '{
      "background":"charcoal-gold",
      "primary":"#111827",
      "secondary":"#D4AF37",
      "fontTitle":"Playfair Display",
      "fontBody":"Inter",
      "overlay":"black/50",
      "countdownStyle":"gold-glass",
      "flowerTheme":"none"
    }'::jsonb,
    true
  ),
  (
    'Floral Pastel',
    'floral-pastel',
    'social',
    null,
    '{
      "background":"pastel",
      "primary":"#7C3AED",
      "secondary":"#FDE68A",
      "fontTitle":"Playfair Display",
      "fontBody":"Inter",
      "overlay":"white/20",
      "countdownStyle":"light",
      "flowerTheme":"pastel-flowers"
    }'::jsonb,
    true
  )
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    preview_image = excluded.preview_image,
    config = excluded.config,
    active = excluded.active;
