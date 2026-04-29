-- ─── 018b_live_album_rls_fix.sql ─────────────────────────────────────────────
-- Fixes "permission denied for table live_photos" for anonymous guests.
--
-- Root cause: Supabase requires TWO things for public/anon access:
--   1. A RLS POLICY  (row-level filter)
--   2. A SQL GRANT   (table-level privilege on the role)
-- The original 018 migration had policies but was missing the GRANTs.
-- This file is safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop existing policies cleanly (recreate below) ────────────────────────

drop policy if exists "live_photos: guests can upload"         on public.live_photos;
drop policy if exists "live_photos: anyone can view approved"  on public.live_photos;
drop policy if exists "live_photos: auth can read all"         on public.live_photos;
drop policy if exists "live_photos: auth can update"           on public.live_photos;
drop policy if exists "live_photos: auth can delete"           on public.live_photos;

-- ── 2. Grant SQL-level privileges ────────────────────────────────────────────
-- anon  = unauthenticated visitors (guests using the upload form)
-- authenticated = logged-in users (admins managing photos)

grant usage  on schema public                to anon, authenticated;

grant select, insert
  on public.live_photos                      to anon;

grant select, insert, update, delete
  on public.live_photos                      to authenticated;

-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- Guests (anon) can insert any photo — no login required.
create policy "live_photos: guests can upload"
  on public.live_photos
  for insert
  to anon
  with check (true);

-- Anyone can read approved, non-rejected photos (live screen + album).
create policy "live_photos: anyone can view approved"
  on public.live_photos
  for select
  to anon
  using (approved = true and rejected = false);

-- Authenticated users can read ALL photos (for admin moderation panel).
create policy "live_photos: auth can read all"
  on public.live_photos
  for select
  to authenticated
  using (true);

-- Authenticated users can insert (in case admins add photos directly).
create policy "live_photos: auth can insert"
  on public.live_photos
  for insert
  to authenticated
  with check (true);

-- Authenticated users can update (approve / reject / feature).
create policy "live_photos: auth can update"
  on public.live_photos
  for update
  to authenticated
  using (true)
  with check (true);

-- Authenticated users can delete.
create policy "live_photos: auth can delete"
  on public.live_photos
  for delete
  to authenticated
  using (true);

-- ── 4. Storage bucket: grant anon upload ─────────────────────────────────────

-- Drop old storage policies to avoid conflicts.
drop policy if exists "live-photos bucket: public read"        on storage.objects;
drop policy if exists "live-photos bucket: anyone can upload"  on storage.objects;
drop policy if exists "live-photos bucket: auth can delete"    on storage.objects;

-- Public read for the entire live-photos bucket.
create policy "live-photos bucket: public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'live-photos');

-- Anon guests can upload.
create policy "live-photos bucket: anon can upload"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'live-photos');

-- Authenticated users can upload.
create policy "live-photos bucket: auth can upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'live-photos');

-- Authenticated users can delete (admin removes a photo).
create policy "live-photos bucket: auth can delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'live-photos');
