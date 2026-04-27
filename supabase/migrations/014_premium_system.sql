do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'user_role'
      and enum_value.enumlabel = 'vendedor'
  ) then
    alter type public.user_role add value 'vendedor';
  end if;
end $$;

create table if not exists public.commercial_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  price_label text,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clients
add column if not exists plan_id uuid references public.commercial_plans(id) on delete set null;

alter table public.events
add column if not exists mobile_cover_image_url text;

create index if not exists commercial_plans_slug_idx on public.commercial_plans(slug);
create index if not exists clients_plan_id_idx on public.clients(plan_id);

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select on public.commercial_plans to anon, authenticated;
grant select, insert, update, delete on public.commercial_plans to service_role;
grant update (mobile_cover_image_url) on public.events to authenticated;
grant update (plan_id) on public.clients to service_role;

alter table public.commercial_plans enable row level security;

drop policy if exists "commercial_plans_public_select_active" on public.commercial_plans;
drop policy if exists "commercial_plans_service_role_all" on public.commercial_plans;

create policy "commercial_plans_public_select_active"
on public.commercial_plans
for select
to anon, authenticated
using (active = true);

create policy "commercial_plans_service_role_all"
on public.commercial_plans
for all
to service_role
using (true)
with check (true);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role::text in ('super_admin', 'admin', 'admin_kais')
  );
$$;

insert into public.commercial_plans (name, slug, price_label, features, active)
values
  ('Esencial', 'esencial', 'Base', '["Invitación digital", "RSVP", "QR público"]'::jsonb, true),
  ('Premium', 'premium', 'Más vendido', '["Doble portada", "Lista de invitados", "WhatsApp", "Álbum en vivo"]'::jsonb, true),
  ('Luxury', 'luxury', 'Full service', '["Plantillas premium", "Métricas", "Soporte de evento", "Recordatorios WhatsApp"]'::jsonb, true)
on conflict (slug) do update
set name = excluded.name,
    price_label = excluded.price_label,
    features = excluded.features,
    active = excluded.active;
