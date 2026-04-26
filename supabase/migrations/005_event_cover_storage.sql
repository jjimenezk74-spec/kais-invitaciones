-- Event cover image support for KAIS INVITACIONES.
-- Cover files reuse the existing public event-photos bucket and are stored as:
-- covers/{event_id}/filename.ext

alter table public.events
add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_event_photos_cover_upload" on storage.objects;
drop policy if exists "storage_event_photos_cover_update" on storage.objects;
drop policy if exists "storage_event_photos_cover_delete" on storage.objects;

create policy "storage_event_photos_cover_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'covers'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "storage_event_photos_cover_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'covers'
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'covers'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "storage_event_photos_cover_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'covers'
  and exists (
    select 1
    from public.events
    where events.id::text = (storage.foldername(name))[2]
      and (events.owner_id = auth.uid() or public.is_admin())
  )
);
