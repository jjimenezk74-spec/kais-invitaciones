do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'user_role'
      and enum_value.enumlabel = 'super_admin'
  ) then
    alter type public.user_role add value 'super_admin';
  end if;

  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'user_role'
      and enum_value.enumlabel = 'admin_kais'
  ) then
    alter type public.user_role add value 'admin_kais';
  end if;

  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'user_role'
      and enum_value.enumlabel = 'diseñador'
  ) then
    alter type public.user_role add value 'diseñador';
  end if;

  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'user_role'
      and enum_value.enumlabel = 'soporte_evento'
  ) then
    alter type public.user_role add value 'soporte_evento';
  end if;
end $$;

alter table public.profiles
add column if not exists is_active boolean not null default true;

update public.profiles
set is_active = true
where is_active is null;

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

create or replace function public.is_super_admin()
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
      and role::text = 'super_admin'
  );
$$;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
