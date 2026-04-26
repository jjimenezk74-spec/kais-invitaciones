-- Public bucket for event music files uploaded by authenticated clients.
-- Accepted formats are enforced in the application: .mp3, .wav, .ogg.

insert into storage.buckets (id, name, public)
values ('event-audio', 'event-audio', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_event_audio_public_read" on storage.objects;
drop policy if exists "storage_event_audio_authenticated_upload" on storage.objects;
drop policy if exists "storage_event_audio_owner_update" on storage.objects;
drop policy if exists "storage_event_audio_owner_delete" on storage.objects;
drop policy if exists "storage_event_audio_service_role_all" on storage.objects;

create policy "storage_event_audio_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'event-audio');

create policy "storage_event_audio_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-audio'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('mp3', 'wav', 'ogg')
);

create policy "storage_event_audio_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-audio'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'event-audio'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('mp3', 'wav', 'ogg')
);

create policy "storage_event_audio_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-audio'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_event_audio_service_role_all"
on storage.objects
for all
to service_role
using (bucket_id = 'event-audio')
with check (bucket_id = 'event-audio');
