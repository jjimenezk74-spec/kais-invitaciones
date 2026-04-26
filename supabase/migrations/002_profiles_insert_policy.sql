do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own_cliente'
  ) then
    create policy "profiles_insert_own_cliente"
    on public.profiles for insert
    to authenticated
    with check (id = auth.uid() and role = 'cliente');
  end if;
end;
$$;
