-- 017_kpop_warriors_theme.sql
-- Adds the "K-Pop Warriors" premium theme to the quinceañeros category.

do $$
declare
  cat_quince uuid;
begin
  select id into cat_quince from public.event_categories where slug = 'quince';

  insert into public.invitation_themes
    (category_id, slug, name, description,
     default_design_config, available_options,
     is_premium, sort_order, is_active)
  values (
    cat_quince,
    'kpop-warriors',
    'K-Pop Warriors',
    'Escenario neón, girl power y glamour pop — rosa eléctrico, azul spotlight, magia idol.',
    '{"fontPreset":"modern-chic","backgroundVariant":"dark-roses","animationPreset":"gold-sparkles","decorationLevel":"premium","decorationPreset":"none"}'::jsonb,
    '{"fontPresets":["default","modern-chic","luxury-serif","royal-classic"],"backgroundVariants":["default","dark-roses","satin-red"],"animationPresets":["none","gold-sparkles","elegant-glow"],"decorationLevels":["minimal","medium","premium"]}'::jsonb,
    true,   -- is_premium
    4,      -- sort_order (after midnight-queen at 3)
    true    -- is_active
  )
  on conflict (slug) do update
    set category_id           = excluded.category_id,
        name                  = excluded.name,
        description           = excluded.description,
        default_design_config = excluded.default_design_config,
        available_options     = excluded.available_options,
        is_premium            = excluded.is_premium,
        sort_order            = excluded.sort_order,
        is_active             = excluded.is_active,
        updated_at            = now();
end $$;
