update public.invitation_templates
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{designConfig}',
  '{
    "fontPreset": "default",
    "backgroundVariant": "default",
    "animationPreset": "none",
    "decorationLevel": "minimal"
  }'::jsonb,
  true
)
where slug = 'rosas-rojas-15'
  and not coalesce(config, '{}'::jsonb) ? 'designConfig';
