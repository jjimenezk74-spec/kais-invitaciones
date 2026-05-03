alter table public.events
add column if not exists package_key text;

alter table public.events
add column if not exists enabled_features text[] not null default '{}'::text[];

alter table public.events
add column if not exists disabled_features text[] not null default '{}'::text[];

-- Existing events predate package gating. Keep them fully enabled so live invitations
-- do not lose features when this migration is applied.
update public.events
set package_key = 'luxury'
where package_key is null;

alter table public.events
alter column package_key set default 'essential';

alter table public.events
alter column package_key set not null;

alter table public.events
drop constraint if exists events_package_key_check;

alter table public.events
add constraint events_package_key_check
check (package_key in ('essential', 'premium', 'experience', 'luxury'));

alter table public.events
drop constraint if exists events_enabled_features_check;

alter table public.events
add constraint events_enabled_features_check
check (
  enabled_features <@ array[
    'countdown',
    'music',
    'rsvp',
    'guest_list',
    'live_album',
    'album_comments',
    'album_reactions',
    'photo_upload',
    'photo_qr',
    'gallery',
    'custom_themes',
    'free_decorations',
    'client_access',
    'analytics',
    'csv_export'
  ]::text[]
);

alter table public.events
drop constraint if exists events_disabled_features_check;

alter table public.events
add constraint events_disabled_features_check
check (
  disabled_features <@ array[
    'countdown',
    'music',
    'rsvp',
    'guest_list',
    'live_album',
    'album_comments',
    'album_reactions',
    'photo_upload',
    'photo_qr',
    'gallery',
    'custom_themes',
    'free_decorations',
    'client_access',
    'analytics',
    'csv_export'
  ]::text[]
);

create index if not exists events_package_key_idx
on public.events(package_key);

grant select (package_key, enabled_features, disabled_features)
on public.events
to anon, authenticated;

grant update (package_key, enabled_features, disabled_features)
on public.events
to authenticated;
