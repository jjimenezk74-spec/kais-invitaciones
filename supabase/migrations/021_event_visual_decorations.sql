-- 021_event_visual_decorations.sql
-- Optional transparent PNG/WebP decorative assets per event.

alter table public.events
  add column if not exists decoration_top_left text,
  add column if not exists decoration_top_right text,
  add column if not exists decoration_bottom_left text,
  add column if not exists decoration_bottom_right text,
  add column if not exists decoration_side_left text,
  add column if not exists decoration_side_right text;

grant select (
  decoration_top_left,
  decoration_top_right,
  decoration_bottom_left,
  decoration_bottom_right,
  decoration_side_left,
  decoration_side_right
) on public.events to anon, authenticated;

grant insert (
  decoration_top_left,
  decoration_top_right,
  decoration_bottom_left,
  decoration_bottom_right,
  decoration_side_left,
  decoration_side_right
) on public.events to authenticated;

grant update (
  decoration_top_left,
  decoration_top_right,
  decoration_bottom_left,
  decoration_bottom_right,
  decoration_side_left,
  decoration_side_right
) on public.events to authenticated;

grant insert (
  decoration_top_left,
  decoration_top_right,
  decoration_bottom_left,
  decoration_bottom_right,
  decoration_side_left,
  decoration_side_right
) on public.events to service_role;

grant update (
  decoration_top_left,
  decoration_top_right,
  decoration_bottom_left,
  decoration_bottom_right,
  decoration_side_left,
  decoration_side_right
) on public.events to service_role;
