-- KAIS Invitaciones - Cloudflare D1 initial schema.
-- This is the Cloudflare-only target schema. It is not connected to the app yet.
-- Apply manually after creating the D1 database:
--   npx wrangler d1 migrations apply kais-invitaciones-db --local
--   npx wrangler d1 migrations apply kais-invitaciones-db --remote

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'cliente'
    CHECK (role IN ('super_admin', 'admin', 'admin_kais', 'disenador', 'soporte_evento', 'vendedor', 'cliente')),
  password_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS commercial_plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_label TEXT,
  features TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  contact_name TEXT,
  plan_id TEXT REFERENCES commercial_plans(id) ON DELETE SET NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS event_categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS invitation_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  preview_image TEXT,
  config TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS invitation_themes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  category_id TEXT REFERENCES event_categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  thumbnail_url TEXT,
  default_design_config TEXT NOT NULL DEFAULT '{}',
  available_options TEXT NOT NULL DEFAULT '{}',
  is_premium INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  package_key TEXT NOT NULL DEFAULT 'essential',
  enabled_features TEXT NOT NULL DEFAULT '[]',
  disabled_features TEXT NOT NULL DEFAULT '[]',
  template_id TEXT REFERENCES invitation_templates(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES event_categories(id) ON DELETE SET NULL,
  theme_id TEXT REFERENCES invitation_themes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'otro',
  hosts_names TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  address TEXT NOT NULL,
  google_maps_link TEXT,
  whatsapp_phone TEXT,
  external_photo_album_url TEXT,
  main_message TEXT,
  quinceanera_name TEXT,
  parents_names TEXT,
  church_name TEXT,
  church_time TEXT,
  dress_code TEXT,
  color_palette TEXT,
  theme TEXT,
  quince_message TEXT,
  parents_message TEXT,
  graduate_name TEXT,
  graduation_type TEXT,
  institution_name TEXT,
  academic_program TEXT,
  degree_title TEXT,
  promotion_name TEXT,
  academic_ceremony_place TEXT,
  academic_ceremony_time TEXT,
  reception_place TEXT,
  reception_time TEXT,
  family_message TEXT,
  graduate_message TEXT,
  cover_image_url TEXT,
  mobile_cover_image_url TEXT,
  music_url TEXT,
  decoration_top_left TEXT,
  decoration_top_right TEXT,
  decoration_bottom_left TEXT,
  decoration_bottom_right TEXT,
  decoration_side_left TEXT,
  decoration_side_right TEXT,
  visual_decorations TEXT,
  design_config TEXT,
  canvas_design TEXT,
  theme_color TEXT NOT NULL DEFAULT '#111827',
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'publicado', 'inactivo')),
  guest_mode TEXT NOT NULL DEFAULT 'publico' CHECK (guest_mode IN ('publico', 'lista_invitados')),
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  attending INTEGER NOT NULL,
  companions INTEGER NOT NULL DEFAULT 0 CHECK (companions >= 0),
  message TEXT,
  dietary_restrictions TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS event_guests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  max_companions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'confirmado', 'no_asiste', 'bloqueado')),
  rsvp_id TEXT REFERENCES rsvps(id) ON DELETE SET NULL,
  last_opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS event_photos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  guest_name TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  is_public INTEGER NOT NULL DEFAULT 1,
  is_approved INTEGER NOT NULL DEFAULT 0,
  approved_at TEXT,
  approved_by_event_login TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS analytics_visits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS event_logins (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS live_photos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  guest_name TEXT,
  guest_message TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS live_photo_comments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES live_photos(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS live_photo_reactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES live_photos(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  reaction TEXT NOT NULL DEFAULT 'heart',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(photo_id, session_id, reaction)
);

CREATE TABLE IF NOT EXISTS canvas_v3_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  compatible_event_types TEXT NOT NULL DEFAULT '[]',
  visual_category TEXT,
  description TEXT,
  template_scope TEXT NOT NULL DEFAULT 'full' CHECK (template_scope IN ('full', 'section', 'component')),
  design TEXT NOT NULL,
  preview_image_url TEXT,
  thumbnail_url TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (json_valid(design)),
  CHECK (json_extract(design, '$.version') = 3)
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS events_owner_id_idx ON events(owner_id);
CREATE INDEX IF NOT EXISTS events_client_id_idx ON events(client_id);
CREATE INDEX IF NOT EXISTS events_slug_idx ON events(slug);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status);
CREATE INDEX IF NOT EXISTS clients_plan_id_idx ON clients(plan_id);
CREATE INDEX IF NOT EXISTS commercial_plans_slug_idx ON commercial_plans(slug);
CREATE INDEX IF NOT EXISTS invitation_templates_slug_idx ON invitation_templates(slug);
CREATE INDEX IF NOT EXISTS invitation_themes_slug_idx ON invitation_themes(slug);
CREATE INDEX IF NOT EXISTS rsvps_event_id_idx ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_guests_event_id_idx ON event_guests(event_id);
CREATE INDEX IF NOT EXISTS event_guests_token_idx ON event_guests(token);
CREATE INDEX IF NOT EXISTS event_photos_event_id_idx ON event_photos(event_id);
CREATE INDEX IF NOT EXISTS analytics_visits_event_id_idx ON analytics_visits(event_id);
CREATE INDEX IF NOT EXISTS event_logins_event_id_idx ON event_logins(event_id);
CREATE INDEX IF NOT EXISTS event_logins_username_idx ON event_logins(username);
CREATE INDEX IF NOT EXISTS live_photos_event_id_idx ON live_photos(event_id);
CREATE INDEX IF NOT EXISTS live_photos_event_approved_idx ON live_photos(event_id, approved, rejected);
CREATE INDEX IF NOT EXISTS live_photos_created_at_idx ON live_photos(created_at);
CREATE INDEX IF NOT EXISTS live_photo_comments_photo_id_idx ON live_photo_comments(photo_id);
CREATE INDEX IF NOT EXISTS live_photo_reactions_photo_id_idx ON live_photo_reactions(photo_id);
CREATE INDEX IF NOT EXISTS canvas_v3_templates_slug_idx ON canvas_v3_templates(slug);
CREATE INDEX IF NOT EXISTS canvas_v3_templates_active_idx ON canvas_v3_templates(is_active);
CREATE INDEX IF NOT EXISTS canvas_v3_templates_sort_idx ON canvas_v3_templates(sort_order);

CREATE TRIGGER IF NOT EXISTS events_set_updated_at
AFTER UPDATE ON events
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE events SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS profiles_set_updated_at
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS event_logins_set_updated_at
AFTER UPDATE ON event_logins
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE event_logins SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS canvas_v3_templates_set_updated_at
AFTER UPDATE ON canvas_v3_templates
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE canvas_v3_templates SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
