-- KAIS INVITACIONES
-- Dashboard/query performance indexes.
--
-- Safe to run more than once: every index uses IF NOT EXISTS.
-- These indexes target the slow dashboard reads measured in production/dev:
-- invitation_templates active list, event photo counts, client list,
-- guest counts/lists, live album counters, RSVP counters.

-- Events: public slug lookups, dashboard ownership/client filters and lists.
create index if not exists events_status_slug_idx
  on public.events (status, slug);

create index if not exists events_client_created_at_idx
  on public.events (client_id, created_at desc);

create index if not exists events_owner_created_at_idx
  on public.events (owner_id, created_at desc);

create index if not exists events_status_created_at_idx
  on public.events (status, created_at desc);

-- Templates: dashboard selector currently filters active templates and orders by created_at.
create index if not exists invitation_templates_active_created_at_idx
  on public.invitation_templates (active, created_at);

create index if not exists invitation_templates_active_category_created_at_idx
  on public.invitation_templates (active, category, created_at);

-- Clients: dashboard list/order plus status filters.
create index if not exists clients_name_idx
  on public.clients (name);

create index if not exists clients_status_name_idx
  on public.clients (status, name);

create index if not exists clients_created_at_idx
  on public.clients (created_at desc);

create index if not exists clients_created_by_created_at_idx
  on public.clients (created_by, created_at desc);

-- RSVP: counters, attendee counters and confirmation table ordering.
create index if not exists rsvps_event_created_at_idx
  on public.rsvps (event_id, created_at desc);

create index if not exists rsvps_event_attending_idx
  on public.rsvps (event_id, attending);

create index if not exists rsvps_event_attending_created_at_idx
  on public.rsvps (event_id, attending, created_at desc);

-- Event photos: counts, moderation/public gallery filters and newest-first lists.
create index if not exists event_photos_event_created_at_idx
  on public.event_photos (event_id, created_at desc);

create index if not exists event_photos_event_status_created_at_idx
  on public.event_photos (event_id, status, created_at desc);

create index if not exists event_photos_event_public_status_idx
  on public.event_photos (event_id, is_public, status);

create index if not exists event_photos_event_approved_created_at_idx
  on public.event_photos (event_id, is_approved, created_at desc);

-- Event guests: counts, list ordering, status filters and token validation.
create index if not exists event_guests_event_created_at_idx
  on public.event_guests (event_id, created_at desc);

create index if not exists event_guests_event_status_created_at_idx
  on public.event_guests (event_id, status, created_at desc);

create index if not exists event_guests_event_token_idx
  on public.event_guests (event_id, token);

-- Live photos: dashboard counters, moderation lists, public/live approved feeds.
create index if not exists live_photos_event_created_at_idx
  on public.live_photos (event_id, created_at desc);

create index if not exists live_photos_event_approved_rejected_idx
  on public.live_photos (event_id, approved, rejected);

create index if not exists live_photos_event_approved_rejected_created_at_idx
  on public.live_photos (event_id, approved, rejected, created_at desc);

create index if not exists live_photos_event_featured_created_at_idx
  on public.live_photos (event_id, featured, created_at desc)
  where approved = true and rejected = false;

-- Analytics visits: event metrics over time.
create index if not exists analytics_visits_event_created_at_idx
  on public.analytics_visits (event_id, created_at desc);

-- Refresh planner statistics after adding indexes.
analyze public.events;
analyze public.invitation_templates;
analyze public.clients;
analyze public.rsvps;
analyze public.event_photos;
analyze public.event_guests;
analyze public.live_photos;
analyze public.analytics_visits;
