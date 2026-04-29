-- KAIS INVITACIONES
-- Immediate indexes for measured dashboard bottlenecks.
-- Safe/idempotent. These names match the operational fix notes.

create index if not exists idx_analytics_visits_event_id_created
  on public.analytics_visits (event_id, created_at desc);

create index if not exists idx_live_photos_event
  on public.live_photos (event_id);

create index if not exists idx_live_photos_event_created
  on public.live_photos (event_id, created_at desc);

create index if not exists idx_live_photos_event_approved_rejected
  on public.live_photos (event_id, approved, rejected);

create index if not exists idx_invitation_templates_active_created
  on public.invitation_templates (active, created_at);

create index if not exists idx_event_photos_event_id
  on public.event_photos (event_id);

create index if not exists idx_event_guests_event_id
  on public.event_guests (event_id);

create index if not exists idx_rsvps_event_id
  on public.rsvps (event_id);

analyze public.analytics_visits;
analyze public.live_photos;
analyze public.invitation_templates;
analyze public.event_photos;
analyze public.event_guests;
analyze public.rsvps;
