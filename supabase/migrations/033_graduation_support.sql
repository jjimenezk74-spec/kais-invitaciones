alter table public.events
  add column if not exists graduate_name text,
  add column if not exists graduation_type text,
  add column if not exists institution_name text,
  add column if not exists academic_program text,
  add column if not exists degree_title text,
  add column if not exists promotion_name text,
  add column if not exists academic_ceremony_place text,
  add column if not exists academic_ceremony_time text,
  add column if not exists reception_place text,
  add column if not exists reception_time text,
  add column if not exists family_message text,
  add column if not exists graduate_message text;
