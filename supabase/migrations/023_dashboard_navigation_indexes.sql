-- KAIS INVITACIONES
-- Complementary indexes for faster dashboard navigation and public invitations.
-- Safe to run more than once.

-- Public invitation lookup and dashboard filters.
create index if not exists idx_events_slug
  on public.events (slug);

create index if not exists idx_events_status
  on public.events (status);

create index if not exists idx_events_client_id
  on public.events (client_id);

create index if not exists idx_events_event_date
  on public.events (event_date);

create index if not exists idx_events_theme_id
  on public.events (theme_id);

-- Client management filters.
create index if not exists idx_clients_status
  on public.clients (status);

create index if not exists idx_clients_plan_id
  on public.clients (plan_id);

create index if not exists idx_clients_created_at_desc
  on public.clients (created_at desc);

-- Event access and guest links.
create index if not exists idx_event_logins_event_id
  on public.event_logins (event_id);

create index if not exists idx_event_guests_token
  on public.event_guests (token);

create index if not exists idx_event_guests_event_status
  on public.event_guests (event_id, status);

-- RSVP/fotos/live album counters and lists.
create index if not exists idx_rsvps_event_created_at_desc
  on public.rsvps (event_id, created_at desc);

create index if not exists idx_event_photos_public_gallery
  on public.event_photos (event_id, status, is_public, created_at desc);

create index if not exists idx_live_photos_event_created_at_desc
  on public.live_photos (event_id, created_at desc);

-- Analytics count by event. This remains deferred from the initial event detail render.
create index if not exists idx_analytics_visits_event_id
  on public.analytics_visits (event_id);

analyze public.events;
analyze public.clients;
analyze public.event_logins;
analyze public.event_guests;
analyze public.rsvps;
analyze public.event_photos;
analyze public.live_photos;
analyze public.analytics_visits;
