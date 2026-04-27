insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('event-audio', 'event-audio', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_event_photos_direct_cover_upload" on storage.objects;

create policy "storage_event_photos_direct_cover_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-photos'
  and (storage.foldername(name))[1] = 'covers'
  and (storage.foldername(name))[2] = 'direct'
  and (storage.foldername(name))[3] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);
