create extension if not exists "pgcrypto";

create type public.user_role as enum ('super_admin', 'admin', 'admin_kais', 'diseñador', 'soporte_evento', 'cliente');
create type public.event_type as enum ('boda', 'cumpleaños', 'quinceaños', 'bautizo', 'baby shower', 'corporativo', 'graduación', 'otro');
create type public.event_status as enum ('borrador', 'publicado', 'inactivo');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.user_role not null default 'cliente',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid,
  title text not null,
  event_type public.event_type not null default 'otro',
  hosts_names text not null,
  event_date date not null,
  event_time time not null,
  address text not null,
  google_maps_link text,
  main_message text,
  dress_code text,
  cover_image_url text,
  music_url text,
  theme_color text not null default '#111827',
  status public.event_status not null default 'borrador',
  guest_mode text not null default 'publico' check (guest_mode in ('publico', 'lista_invitados')),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  notes text,
  status text not null default 'activo' check (status in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.invitation_templates (
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
add constraint events_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;

alter table public.events
add column template_id uuid references public.invitation_templates(id) on delete set null;

create table public.rsvps (
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

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  guest_name text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.analytics_visits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index events_owner_id_idx on public.events(owner_id);
create index events_client_id_idx on public.events(client_id);
create index clients_status_idx on public.clients(status);
create index invitation_templates_slug_idx on public.invitation_templates(slug);
create index events_slug_idx on public.events(slug);
create index rsvps_event_id_idx on public.rsvps(event_id);
create index event_photos_event_id_idx on public.event_photos(event_id);
create index analytics_visits_event_id_idx on public.analytics_visits(event_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'cliente')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.event_photos enable row level security;
alter table public.analytics_visits enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_insert_own_cliente"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'cliente');

create policy "events_public_select_published"
on public.events for select
to anon, authenticated
using (status = 'publicado' or owner_id = auth.uid() or public.is_admin());

create policy "events_insert_owner_or_admin"
on public.events for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

create policy "events_update_owner_or_admin"
on public.events for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "events_delete_admin"
on public.events for delete
to authenticated
using (public.is_admin());

create policy "rsvps_public_insert_for_published_events"
on public.rsvps for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.events
    where events.id = rsvps.event_id
    and events.status = 'publicado'
  )
);

create policy "rsvps_select_owner_or_admin"
on public.rsvps for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = rsvps.event_id
    and events.owner_id = auth.uid()
  )
);

create policy "photos_public_insert_for_published_events"
on public.event_photos for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.events
    where events.id = event_photos.event_id
    and events.status = 'publicado'
  )
);

create policy "photos_public_select_approved"
on public.event_photos for select
to anon, authenticated
using (
  is_approved = true
  or public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = event_photos.event_id
    and events.owner_id = auth.uid()
  )
);

create policy "photos_update_owner_or_admin"
on public.event_photos for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = event_photos.event_id
    and events.owner_id = auth.uid()
  )
);

create policy "visits_public_insert"
on public.analytics_visits for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.events
    where events.id = analytics_visits.event_id
    and events.status = 'publicado'
  )
);

create policy "visits_select_owner_or_admin"
on public.analytics_visits for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = analytics_visits.event_id
    and events.owner_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

create policy "storage_public_upload_event_photos"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'event-photos');

create policy "storage_public_read_event_photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'event-photos');

create policy "storage_owner_delete_event_photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-photos' and public.is_admin());
