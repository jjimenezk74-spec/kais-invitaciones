alter table public.events
add column if not exists quinceanera_name text,
add column if not exists parents_names text,
add column if not exists church_name text,
add column if not exists church_time text,
add column if not exists dress_code text,
add column if not exists color_palette text,
add column if not exists theme text,
add column if not exists quince_message text,
add column if not exists parents_message text;
