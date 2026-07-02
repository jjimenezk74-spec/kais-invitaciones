CREATE TABLE IF NOT EXISTS canvas_v3_asset_categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS canvas_v3_assets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  category_id TEXT NULL REFERENCES canvas_v3_asset_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NULL,
  file_size INTEGER NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_canvas_v3_asset_categories_sort
  ON canvas_v3_asset_categories(sort_order, name);

CREATE INDEX IF NOT EXISTS idx_canvas_v3_assets_category
  ON canvas_v3_assets(category_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_canvas_v3_assets_storage_key
  ON canvas_v3_assets(storage_key);

CREATE TRIGGER IF NOT EXISTS canvas_v3_asset_categories_set_updated_at
AFTER UPDATE ON canvas_v3_asset_categories
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE canvas_v3_asset_categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS canvas_v3_assets_set_updated_at
AFTER UPDATE ON canvas_v3_assets
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE canvas_v3_assets SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;
