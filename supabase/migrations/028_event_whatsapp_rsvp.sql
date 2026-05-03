alter table public.events
add column if not exists whatsapp_phone text;

grant select (whatsapp_phone)
on public.events
to anon, authenticated;

grant update (whatsapp_phone)
on public.events
to authenticated;
