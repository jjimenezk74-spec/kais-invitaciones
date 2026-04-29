-- ─── 018_live_album.sql ───────────────────────────────────────────────────────
-- KAIS Live Album: guest photo uploads, moderation, live slideshow, final album.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table ──────────────────────────────────────────────────────────────────

create table if not exists public.live_photos (
  id            uuid        primary key default gen_random_uuid(),
  event_id      uuid        not null references public.events(id) on delete cascade,
  image_url     text        not null,
  storage_path  text        not null,
  guest_name    text,
  guest_message text,
  approved      boolean     not null default false,
  featured      boolean     not null default false,
  rejected      boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

create index if not exists live_photos_event_id_idx
  on public.live_photos (event_id);

create index if not exists live_photos_event_approved_idx
  on public.live_photos (event_id, approved)
  where rejected = false;

create index if not exists live_photos_created_at_idx
  on public.live_photos (created_at desc);

create index if not exists live_photos_featured_idx
  on public.live_photos (event_id, featured)
  where approved = true and rejected = false;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

alter table public.live_photos enable row level security;

-- Anyone (guest, no auth) can insert — guests upload photos without logging in.
create policy "live_photos: guests can upload"
  on public.live_photos
  for insert
  with check (true);

-- Anyone can read approved, non-rejected photos (live screen + public album).
create policy "live_photos: anyone can view approved"
  on public.live_photos
  for select
  using (approved = true and rejected = false);

-- Authenticated users with sufficient role can read all (via service-role admin client anyway).
-- The admin client bypasses RLS entirely, so no extra policy needed.

-- ── 4. Storage bucket ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-photos',
  'live-photos',
  true,
  10485760,   -- 10 MB per file
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 5. Storage policies ───────────────────────────────────────────────────────

-- Public read (bucket is public, but explicit policy keeps things clean).
create policy "live-photos bucket: public read"
  on storage.objects
  for select
  using (bucket_id = 'live-photos');

-- Anyone can upload (guests use anon key).
create policy "live-photos bucket: anyone can upload"
  on storage.objects
  for insert
  with check (bucket_id = 'live-photos');
