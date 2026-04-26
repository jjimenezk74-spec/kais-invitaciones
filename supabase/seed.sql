-- Run after creating at least one Supabase Auth user.
-- Replace the owner_id value with the id from auth.users/profiles.

insert into public.events (
  owner_id,
  title,
  event_type,
  hosts_names,
  event_date,
  event_time,
  address,
  google_maps_link,
  main_message,
  dress_code,
  cover_image_url,
  theme_color,
  status,
  slug
) values (
  '00000000-0000-0000-0000-000000000000',
  'Boda de Ana y Luis',
  'boda',
  'Ana & Luis',
  '2026-10-17',
  '20:30',
  'Asunción, Paraguay',
  'https://maps.google.com',
  'Nos encantará compartir una noche inolvidable con vos.',
  'Elegante',
  'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1600&auto=format&fit=crop',
  '#111827',
  'publicado',
  'ana-luis-demo'
);
