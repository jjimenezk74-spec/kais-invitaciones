# KAIS INVITACIONES

MVP SaaS profesional para gestionar invitaciones digitales: landing pública, auth, panel cliente/admin, eventos, QR, página pública, RSVP, subida de fotos, estadísticas y Supabase con RLS.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth, Database y Storage
- Componentes estilo shadcn/ui
- QR PNG/SVG con `qrcode`

## Flujo MVP

registro/login -> crear evento -> publicar evento -> descargar QR -> ver `/evento/[slug]` -> confirmar asistencia -> revisar RSVP en panel.

## Instalación

```bash
npm install
npm run dev
```

Crea `.env.local` usando `.env.example`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Puedes crearlo copiando el ejemplo:

```bash
copy .env.example .env.local
```

Luego reemplaza los valores de Supabase desde **Supabase Dashboard > Project Settings > API**:

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/public key.
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key, solo para servidor.
- `NEXT_PUBLIC_APP_URL`: URL de la app, por ejemplo `http://localhost:3000` en desarrollo.

Después de editar `.env.local`, reinicia el servidor:

```bash
npm run dev
```

Si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, el middleware no detiene toda la app: la landing puede cargar y las rutas que usan Supabase mostrarán un error de configuración claro para desarrollo.

## Si `/` devuelve 404 en desarrollo

La ruta principal está en `app/page.tsx`. Si Next responde 404 aunque el archivo exista, normalmente es una caché `.next` incompleta después de un error de compilación o de variables de entorno. Detén el servidor, elimina `.next` y vuelve a iniciar:

```bash
rmdir /s /q .next
npm run dev
```

En PowerShell:

```powershell
Remove-Item .next -Recurse -Force
npm run dev
```

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/migrations/001_initial_schema.sql` en el SQL Editor.
3. Crea un usuario desde `/registro`.
4. Para convertirlo en admin:

```sql
update public.profiles
set role = 'admin'
where email = 'tu-email@dominio.com';
```

5. Opcional: usa `supabase/seed.sql`, reemplazando `owner_id` por el id real de un perfil.

Si ya ejecutaste la primera migración antes de esta versión, ejecuta también:

```sql
-- supabase/migrations/002_profiles_insert_policy.sql
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own_cliente'
  ) then
    create policy "profiles_insert_own_cliente"
    on public.profiles for insert
    to authenticated
    with check (id = auth.uid() and role = 'cliente');
  end if;
end;
$$;
```

Esto permite que la app cree un `profile` faltante en el primer login si el trigger de registro no lo creó.

Para permitir subida de música desde el formulario de evento, ejecuta también `supabase/migrations/004_event_audio_storage.sql`. Esa migración crea el bucket público `event-audio` y las políticas de Storage para que usuarios autenticados puedan subir solo `.mp3`, `.wav` u `.ogg` dentro de su carpeta.

Los audios subidos desde el formulario no deben superar 10MB. El proyecto configura Server Actions con `bodySizeLimit: "10mb"` y valida ese límite antes de subir el archivo a Supabase Storage.

Para permitir foto de portada original, ejecuta `supabase/migrations/005_event_cover_storage.sql`. Esa migración asegura la columna `events.cover_image_url`, crea el bucket público `event-covers` y permite subir portadas en `covers/{event_id}/...`. Las portadas aceptan `.jpg`, `.jpeg`, `.png` y `.webp`, con límite de 5MB.

## Módulos incluidos

- Landing pública con secciones de negocio, beneficios, tipos de eventos, planes, testimonios/contacto.
- Login y registro con Supabase Auth.
- Panel cliente para crear, editar, publicar eventos, ver enlace público, descargar QR, revisar RSVP, fotos y visitas.
- Panel admin para clientes, eventos, métricas y creación para cliente.
- Invitación pública en `/evento/[slug]` con portada premium, cuenta regresiva, RSVP, Google Maps, calendario, fotos y branding discreto.
- RLS para separar clientes/admin y permitir acciones públicas limitadas de invitados.

## Producción

- Configura `NEXT_PUBLIC_APP_URL` con el dominio real para que el QR apunte al sitio correcto.
- Revisa límites de Storage y políticas de moderación antes de abrir subidas masivas.
- Agrega verificación de email si el modelo comercial lo requiere.

## Deploy en Vercel

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "MVP KAIS INVITACIONES"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/kais-invitaciones.git
git push -u origin main
```

### 2. Conectar con Vercel

1. Entra a Vercel y elige **Add New Project**.
2. Importa el repositorio de GitHub.
3. Framework preset: **Next.js**.
4. Build command: `npm run build`.
5. Output directory: dejar vacío, Vercel detecta `.next`.

### 3. Variables de entorno en Vercel

Agrega estas variables en **Project Settings > Environment Variables** para Production y Preview:

```bash
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Cuando tengas dominio propio, cambia `NEXT_PUBLIC_APP_URL` a `https://tudominio.com` y redeploya. Esta URL se usa para enlaces públicos y QR enviados por WhatsApp.

### 4. Configurar Supabase para producción

En Supabase ejecuta las migraciones en orden:

```text
001_initial_schema.sql
002_profiles_insert_policy.sql
003_events_rls_policy.sql
004_event_audio_storage.sql
005_event_cover_storage.sql
```

En **Authentication > URL Configuration**:

- Site URL: `https://tu-dominio.vercel.app` o tu dominio real.
- Redirect URLs:
  - `http://localhost:3000/**`
  - `https://tu-dominio.vercel.app/**`
  - opcional para previews: `https://*-tu-usuario.vercel.app/**`

Storage requerido:

- `event-photos`: público, creado por `001_initial_schema.sql`.
- `event-audio`: público, creado por `004_event_audio_storage.sql`.
- `event-covers`: público, creado por `005_event_cover_storage.sql`.

### 5. Obtener enlace público final

1. Haz deploy en Vercel.
2. Copia el dominio de producción, por ejemplo `https://kais-invitaciones.vercel.app`.
3. Actualiza `NEXT_PUBLIC_APP_URL` en Vercel con ese dominio.
4. Haz **Redeploy**.
5. Crea o publica un evento.
6. Comparte `/evento/[slug]` o descarga el QR desde el detalle del evento.
