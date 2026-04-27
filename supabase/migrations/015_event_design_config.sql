alter table public.events
add column if not exists design_config jsonb not null default '{
  "fontPreset": "default",
  "backgroundVariant": "default",
  "animationPreset": "none",
  "decorationLevel": "minimal"
}'::jsonb;

update public.events
set design_config = '{
  "fontPreset": "default",
  "backgroundVariant": "default",
  "animationPreset": "none",
  "decorationLevel": "minimal"
}'::jsonb
where design_config is null;

grant update (design_config) on public.events to authenticated;
grant update (design_config) on public.events to service_role;
