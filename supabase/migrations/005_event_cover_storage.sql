-- Event cover image support for KAIS INVITACIONES.
-- Files are stored as covers/{event_id}/filename.ext in the public event-covers bucket.

alter table public.events
add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_event_covers_public_read" on storage.objects;
drop policy if exists "storage_event_covers_authenticated_upload" on storage.objects;
drop policy if exists "storage_event_covers_owner_update" on storage.objects;
drop policy if exists "storage_event_covers_owner_delete" on storage.objects;
drop policy if exists "storage_event_covers_service_role_all" on storage.objects;

create policy "storage_event_covers_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'event-covers');

create policy "storage_event_covers_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = 'covers'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "storage_event_covers_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = 'covers'
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = 'covers'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "storage_event_covers_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-covers'
  and (storage.foldername(name))[1] = 'covers'
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "storage_event_covers_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'event-covers')
with check (bucket_id = 'event-covers');
