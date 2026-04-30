-- 025_live_photo_comments_public_fix.sql
-- Makes public album comments/reactions reliable for anonymous QR visitors.

create table if not exists public.live_photo_comments (
  id           uuid        primary key default gen_random_uuid(),
  photo_id     uuid        not null references public.live_photos(id) on delete cascade,
  event_id     uuid        not null references public.events(id) on delete cascade,
  author_name  text        not null,
  comment_text text        not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.live_photo_reactions (
  id                   uuid        primary key default gen_random_uuid(),
  photo_id              uuid        not null references public.live_photos(id) on delete cascade,
  event_id              uuid        not null references public.events(id) on delete cascade,
  emoji                 text        not null,
  anonymous_session_id  text        not null,
  created_at            timestamptz not null default now()
);

create index if not exists idx_live_photo_comments_photo_created
  on public.live_photo_comments(photo_id, created_at desc);

create index if not exists idx_live_photo_comments_event_created
  on public.live_photo_comments(event_id, created_at desc);

create index if not exists idx_live_photo_reactions_photo_emoji
  on public.live_photo_reactions(photo_id, emoji);

create index if not exists idx_live_photo_reactions_event_created
  on public.live_photo_reactions(event_id, created_at desc);

create unique index if not exists idx_live_photo_reactions_unique_session_emoji
  on public.live_photo_reactions(photo_id, anonymous_session_id, emoji);

alter table public.live_photo_comments enable row level security;
alter table public.live_photo_reactions enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on public.live_photo_comments to anon, authenticated;
grant select, insert on public.live_photo_reactions to anon, authenticated;

drop policy if exists "live_photo_comments: public view approved event comments" on public.live_photo_comments;
drop policy if exists "live_photo_comments: public insert approved event comments" on public.live_photo_comments;
drop policy if exists "Allow public read comments" on public.live_photo_comments;
drop policy if exists "Allow public insert comments" on public.live_photo_comments;

create policy "Allow public read comments"
  on public.live_photo_comments
  for select
  to anon, authenticated
  using (true);

create policy "Allow public insert comments"
  on public.live_photo_comments
  for insert
  to anon, authenticated
  with check (
    event_id is not null
    and photo_id is not null
    and char_length(trim(author_name)) between 1 and 80
    and char_length(trim(comment_text)) between 1 and 300
  );

drop policy if exists "live_photo_reactions: public view approved event reactions" on public.live_photo_reactions;
drop policy if exists "live_photo_reactions: public insert approved event reactions" on public.live_photo_reactions;
drop policy if exists "Allow public read reactions" on public.live_photo_reactions;
drop policy if exists "Allow public insert reactions" on public.live_photo_reactions;

create policy "Allow public read reactions"
  on public.live_photo_reactions
  for select
  to anon, authenticated
  using (true);

create policy "Allow public insert reactions"
  on public.live_photo_reactions
  for insert
  to anon, authenticated
  with check (
    event_id is not null
    and photo_id is not null
    and emoji in ('❤️', '😂', '😍', '👏', '🥹', '🎉')
    and char_length(trim(anonymous_session_id)) between 8 and 120
  );
