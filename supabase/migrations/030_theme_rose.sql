-- ─────────────────────────────────────────────────────────────────────────────
-- 030_theme_rose.sql
-- Agrega el tema visual "Rose" (cream paper / rosas rojas acuarela)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO invitation_themes (
  slug,
  name,
  description,
  default_design_config,
  available_options,
  is_premium,
  is_active,
  sort_order
) VALUES (
  'rose',
  'Rose',
  'Fondo crema tipo papel con manchas acuarela en rojo crimson y verde salvia. Elegante y romantico.',
  '{"fontPreset":"luxury-serif","decorationLevel":"medium","animationPreset":"none"}',
  '{"fontPresets":["default","romantic-script","luxury-serif","royal-classic"],
    "decorationLevels":["minimal","medium","premium"],
    "animationPresets":["none","elegant-glow"]}',
  true,
  true,
  30
)
ON CONFLICT (slug) DO UPDATE SET
  name                 = EXCLUDED.name,
  description          = EXCLUDED.description,
  default_design_config = EXCLUDED.default_design_config,
  available_options    = EXCLUDED.available_options,
  is_premium           = EXCLUDED.is_premium,
  is_active            = EXCLUDED.is_active,
  sort_order           = EXCLUDED.sort_order,
  updated_at           = now();
