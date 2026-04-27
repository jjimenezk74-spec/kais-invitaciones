-- 016_categories_and_themes.sql
-- Escalable category + theme system for KAIS INVITACIONES.
-- Adds event_categories and invitation_themes tables,
-- then links them to events via category_id / theme_id FKs.
-- design_config already exists on events (migration 015) — skipped.

-- ============================================================
-- 1. event_categories
-- ============================================================
create table if not exists public.event_categories (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        unique not null,
  name        text        not null,
  description text,
  sort_order  int         not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists event_categories_slug_idx      on public.event_categories(slug);
create index if not exists event_categories_sort_order_idx on public.event_categories(sort_order);

-- ============================================================
-- 2. invitation_themes
-- ============================================================
create table if not exists public.invitation_themes (
  id                   uuid        primary key default gen_random_uuid(),
  category_id          uuid        references public.event_categories(id) on delete set null,
  slug                 text        unique not null,
  name                 text        not null,
  description          text,
  preview_image_url    text,
  thumbnail_url        text,
  default_design_config jsonb      not null default '{}'::jsonb,
  available_options    jsonb       not null default '{}'::jsonb,
  is_premium           boolean     not null default false,
  is_active            boolean     not null default true,
  sort_order           int         not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists invitation_themes_slug_idx        on public.invitation_themes(slug);
create index if not exists invitation_themes_category_id_idx on public.invitation_themes(category_id);
create index if not exists invitation_themes_sort_order_idx  on public.invitation_themes(sort_order);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invitation_themes_set_updated_at on public.invitation_themes;
create trigger invitation_themes_set_updated_at
  before update on public.invitation_themes
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. FK columns on events
-- ============================================================
alter table public.events
  add column if not exists category_id uuid references public.event_categories(id) on delete set null,
  add column if not exists theme_id    uuid references public.invitation_themes(id) on delete set null;

create index if not exists events_category_id_idx on public.events(category_id);
create index if not exists events_theme_id_idx    on public.events(theme_id);

-- ============================================================
-- 4. Grants
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;

grant select                          on public.event_categories  to anon, authenticated;
grant select, insert, update, delete  on public.event_categories  to service_role;

grant select                          on public.invitation_themes to anon, authenticated;
grant select, insert, update, delete  on public.invitation_themes to service_role;

grant update (category_id, theme_id)  on public.events to authenticated;
grant update (category_id, theme_id)  on public.events to service_role;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.event_categories enable row level security;
alter table public.invitation_themes enable row level security;

drop policy if exists "event_categories_public_select_active" on public.event_categories;
drop policy if exists "event_categories_service_role_all"     on public.event_categories;
drop policy if exists "invitation_themes_public_select_active" on public.invitation_themes;
drop policy if exists "invitation_themes_service_role_all"     on public.invitation_themes;

create policy "event_categories_public_select_active"
  on public.event_categories for select
  to anon, authenticated
  using (is_active = true);

create policy "event_categories_service_role_all"
  on public.event_categories for all
  to service_role
  using (true) with check (true);

create policy "invitation_themes_public_select_active"
  on public.invitation_themes for select
  to anon, authenticated
  using (is_active = true);

create policy "invitation_themes_service_role_all"
  on public.invitation_themes for all
  to service_role
  using (true) with check (true);

-- ============================================================
-- 6. Seed: event_categories
-- ============================================================
insert into public.event_categories (slug, name, description, sort_order, is_active)
values
  ('wedding',    'Bodas',        'Invitaciones para ceremonias de matrimonio',          1, true),
  ('quince',     'Quinceaños',   'Celebraciones de 15 años',                            2, true),
  ('birthday',   'Cumpleaños',   'Fiestas de cumpleaños para adultos y jóvenes',        3, true),
  ('kids',       'Infantil',     'Fiestas infantiles y baby shower',                    4, true),
  ('corporate',  'Corporativo',  'Eventos empresariales, lanzamientos y conferencias',  5, true),
  ('graduation', 'Graduación',   'Ceremonias de graduación y egresados',                6, true)
on conflict (slug) do update
  set name        = excluded.name,
      description = excluded.description,
      sort_order  = excluded.sort_order,
      is_active   = excluded.is_active;

-- ============================================================
-- 7. Seed: invitation_themes
-- ============================================================
-- Helper: resolve category_id by slug in a single statement block
do $$
declare
  cat_wedding    uuid;
  cat_quince     uuid;
  cat_birthday   uuid;
  cat_kids       uuid;
  cat_corporate  uuid;
  cat_graduation uuid;
begin
  select id into cat_wedding    from public.event_categories where slug = 'wedding';
  select id into cat_quince     from public.event_categories where slug = 'quince';
  select id into cat_birthday   from public.event_categories where slug = 'birthday';
  select id into cat_kids       from public.event_categories where slug = 'kids';
  select id into cat_corporate  from public.event_categories where slug = 'corporate';
  select id into cat_graduation from public.event_categories where slug = 'graduation';

  insert into public.invitation_themes
    (category_id, slug, name, description,
     default_design_config, available_options,
     is_premium, sort_order, is_active)
  values

  -- ---- QUINCE ----
  (
    cat_quince,
    'red-roses-glam',
    'Red Roses Glam',
    'Rosas rojas y oro — elegancia oscura para una noche inolvidable.',
    '{"fontPreset":"romantic-script","backgroundVariant":"dark-roses","animationPreset":"soft-petals","decorationLevel":"premium"}'::jsonb,
    '{"fontPresets":["default","romantic-script","luxury-serif","royal-classic"],"backgroundVariants":["default","dark-roses","satin-red","romantic-floral"],"animationPresets":["none","soft-petals","elegant-glow"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    true, 1, true
  ),
  (
    cat_quince,
    'princess-pink',
    'Princess Pink',
    'Rosa y champagne — suave, romántico, de cuento de hadas.',
    '{"fontPreset":"romantic-script","backgroundVariant":"romantic-floral","animationPreset":"soft-petals","decorationLevel":"medium"}'::jsonb,
    '{"fontPresets":["default","romantic-script","luxury-serif"],"backgroundVariants":["default","romantic-floral","satin-red"],"animationPresets":["none","soft-petals","elegant-glow"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    false, 2, true
  ),
  (
    cat_quince,
    'midnight-queen',
    'Midnight Queen',
    'Negro, dorado y morado — poder y misterio en cada detalle.',
    '{"fontPreset":"luxury-serif","backgroundVariant":"dark-roses","animationPreset":"gold-sparkles","decorationLevel":"premium"}'::jsonb,
    '{"fontPresets":["default","luxury-serif","royal-classic","modern-chic"],"backgroundVariants":["default","dark-roses","satin-red"],"animationPresets":["none","gold-sparkles","elegant-glow"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    true, 3, true
  ),

  -- ---- WEDDING ----
  (
    cat_wedding,
    'garden-romance',
    'Garden Romance',
    'Blanco, verde y flores — elegancia natural al aire libre.',
    '{"fontPreset":"romantic-script","backgroundVariant":"romantic-floral","animationPreset":"soft-petals","decorationLevel":"medium"}'::jsonb,
    '{"fontPresets":["default","romantic-script","luxury-serif"],"backgroundVariants":["default","romantic-floral","satin-red"],"animationPresets":["none","soft-petals","elegant-glow"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    false, 1, true
  ),
  (
    cat_wedding,
    'royal-wedding',
    'Royal Wedding',
    'Dorado y marfil — fastuoso, clásico, atemporal.',
    '{"fontPreset":"royal-classic","backgroundVariant":"gold-glow","animationPreset":"elegant-glow","decorationLevel":"premium"}'::jsonb,
    '{"fontPresets":["default","royal-classic","luxury-serif","romantic-script"],"backgroundVariants":["default","gold-glow","romantic-floral"],"animationPresets":["none","elegant-glow","gold-sparkles"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    true, 2, true
  ),
  (
    cat_wedding,
    'ivory-minimal',
    'Ivory Minimal',
    'Blanco roto y tipografía limpia — menos es más.',
    '{"fontPreset":"modern-chic","backgroundVariant":"default","animationPreset":"none","decorationLevel":"minimal"}'::jsonb,
    '{"fontPresets":["default","modern-chic","luxury-serif"],"backgroundVariants":["default","romantic-floral"],"animationPresets":["none","elegant-glow"],"decorationLevels":["minimal","medium"]}'::jsonb,
    false, 3, true
  ),

  -- ---- BIRTHDAY ----
  (
    cat_birthday,
    'luxury-night',
    'Luxury Night',
    'Negro y champagne — cumpleaños sofisticado y nocturno.',
    '{"fontPreset":"luxury-serif","backgroundVariant":"dark-roses","animationPreset":"gold-sparkles","decorationLevel":"premium"}'::jsonb,
    '{"fontPresets":["default","luxury-serif","royal-classic","modern-chic"],"backgroundVariants":["default","dark-roses","satin-red","gold-glow"],"animationPresets":["none","gold-sparkles","elegant-glow"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    true, 1, true
  ),
  (
    cat_birthday,
    'neon-party',
    'Neon Party',
    'Colores brillantes y tipografía moderna — fiesta urbana y vibrante.',
    '{"fontPreset":"modern-chic","backgroundVariant":"satin-red","animationPreset":"gold-sparkles","decorationLevel":"medium"}'::jsonb,
    '{"fontPresets":["default","modern-chic","royal-classic"],"backgroundVariants":["default","satin-red","dark-roses"],"animationPresets":["none","gold-sparkles"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    false, 2, true
  ),

  -- ---- KIDS ----
  (
    cat_kids,
    'safari-kids',
    'Safari Kids',
    'Tierra, verde y animales — aventura en cada detalle.',
    '{"fontPreset":"modern-chic","backgroundVariant":"romantic-floral","animationPreset":"soft-petals","decorationLevel":"medium"}'::jsonb,
    '{"fontPresets":["default","modern-chic"],"backgroundVariants":["default","romantic-floral"],"animationPresets":["none","soft-petals"],"decorationLevels":["minimal","medium"]}'::jsonb,
    false, 1, true
  ),
  (
    cat_kids,
    'candy-land',
    'Candy Land',
    'Rosa, celeste y dulces — mágico y festivo para los más pequeños.',
    '{"fontPreset":"romantic-script","backgroundVariant":"romantic-floral","animationPreset":"soft-petals","decorationLevel":"medium"}'::jsonb,
    '{"fontPresets":["default","romantic-script","modern-chic"],"backgroundVariants":["default","romantic-floral","satin-red"],"animationPresets":["none","soft-petals"],"decorationLevels":["minimal","medium"]}'::jsonb,
    false, 2, true
  ),

  -- ---- CORPORATE ----
  (
    cat_corporate,
    'executive-black',
    'Executive Black',
    'Negro y plata — presencia, autoridad y profesionalismo.',
    '{"fontPreset":"royal-classic","backgroundVariant":"dark-roses","animationPreset":"none","decorationLevel":"minimal"}'::jsonb,
    '{"fontPresets":["default","royal-classic","modern-chic"],"backgroundVariants":["default","dark-roses"],"animationPresets":["none","elegant-glow"],"decorationLevels":["minimal","medium"]}'::jsonb,
    false, 1, true
  ),

  -- ---- GRADUATION ----
  (
    cat_graduation,
    'legacy-night',
    'Legacy Night',
    'Azul marino y dorado — logro, tradición y futuro brillante.',
    '{"fontPreset":"luxury-serif","backgroundVariant":"gold-glow","animationPreset":"elegant-glow","decorationLevel":"premium"}'::jsonb,
    '{"fontPresets":["default","luxury-serif","royal-classic","modern-chic"],"backgroundVariants":["default","gold-glow","dark-roses"],"animationPresets":["none","elegant-glow","gold-sparkles"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    true, 1, true
  )

  on conflict (slug) do update
    set category_id           = excluded.category_id,
        name                  = excluded.name,
        description           = excluded.description,
        default_design_config = excluded.default_design_config,
        available_options     = excluded.available_options,
        is_premium            = excluded.is_premium,
        sort_order            = excluded.sort_order,
        is_active             = excluded.is_active,
        updated_at            = now();
end $$;
