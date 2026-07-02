# KAIS INVITACIONES

MVP SaaS profesional para gestionar invitaciones digitales: landing publica, auth, panel cliente/admin, eventos, QR, pagina publica, RSVP, subida de fotos, estadisticas y Supabase con RLS.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth, Database y Storage
- Componentes estilo shadcn/ui
- QR PNG/SVG con `qrcode`
- Cloudflare Workers con OpenNext

## Flujo MVP

registro/login -> crear evento -> publicar evento -> descargar QR -> ver `/evento/[slug]` -> confirmar asistencia -> revisar RSVP en panel.

## Instalacion

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
- `NEXT_PUBLIC_APP_URL`: URL de la app. Usa `http://localhost:3000` en desarrollo y `https://kais.click` en produccion.

Despues de editar `.env.local`, reinicia el servidor:

```bash
npm run dev
```

Si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, el middleware no detiene toda la app: la landing puede cargar y las rutas que usan Supabase mostraran un error de configuracion claro para desarrollo.

## Si `/` devuelve 404 en desarrollo

La ruta principal esta en `app/page.tsx`. Si Next responde 404 aunque el archivo exista, normalmente es una cache `.next` incompleta despues de un error de compilacion o de variables de entorno. Deten el servidor, elimina `.next` y vuelve a iniciar:

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
2. Ejecuta las migraciones en `supabase/migrations` desde el SQL Editor, en orden.
3. Crea un usuario desde `/registro`.
4. Para convertirlo en admin:

```sql
update public.profiles
set role = 'admin'
where email = 'tu-email@dominio.com';
```

5. Opcional: usa `supabase/seed.sql`, reemplazando `owner_id` por el id real de un perfil.

Notas de Storage:

- `event-photos`: bucket publico para fotos y portadas.
- `event-audio`: bucket publico para musica del evento.
- Los audios subidos desde el formulario no deben superar 10MB.
- Las portadas aceptan `.jpg`, `.jpeg`, `.png` y `.webp`, con limite de 5MB.

## Modulos incluidos

- Landing publica con secciones de negocio, beneficios, tipos de eventos, planes, testimonios/contacto.
- Login y registro con Supabase Auth.
- Panel cliente para crear, editar, publicar eventos, ver enlace publico, descargar QR, revisar RSVP, fotos y visitas.
- Panel admin para clientes, eventos, metricas y creacion para cliente.
- Invitacion publica en `/evento/[slug]` con Canvas V3 cuando el evento tenga `canvas_design.version === 3`, y fallback legacy para disenos anteriores.
- RLS para separar clientes/admin y permitir acciones publicas limitadas de invitados.

## Produccion

- Configura `NEXT_PUBLIC_APP_URL` con el dominio real para que el QR apunte al sitio correcto.
- Revisa limites de Storage y politicas de moderacion antes de abrir subidas masivas.
- Agrega verificacion de email si el modelo comercial lo requiere.

## Deploy en Cloudflare Workers

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "MVP KAIS INVITACIONES"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/kais-invitaciones.git
git push -u origin main
```

### 2. Requisito de Node

Cloudflare/OpenNext usa Wrangler 4 y requiere Node 22 o superior. El repo incluye `.node-version`, `.nvmrc` y `engines.node` con ese requisito.

```bash
node -v
```

### 3. Configuracion Cloudflare/OpenNext

El proyecto usa:

- `wrangler.jsonc`: configuracion del Worker.
- `open-next.config.ts`: adaptador OpenNext para Cloudflare.
- `.open-next/`: salida generada del build Cloudflare, ignorada por git.

Scripts disponibles:

```bash
npm run cf:build
npm run cf:preview
npm run cf:deploy
npm run cf:typegen
```

### 4. Variables de entorno en Cloudflare

Agrega estas variables en Cloudflare Workers para Production:

```bash
NEXT_PUBLIC_APP_URL=https://kais.click
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

En produccion, manten `NEXT_PUBLIC_APP_URL=https://kais.click` y redeploya si cambias la variable. Esta URL se usa para enlaces publicos, QR y mensajes enviados por WhatsApp.

### 5. Build y deploy

```bash
npm install
npm run build
npm run cf:build
npm run cf:deploy
```

Para probar localmente el Worker generado:

```bash
npm run cf:preview
```

### 6. Configurar Supabase para produccion

En **Authentication > URL Configuration**:

- Site URL: `https://kais.click`.
- Redirect URLs:
  - `http://localhost:3000/**`
  - `https://kais.click/**`
  - opcional para previews Cloudflare: `https://*.workers.dev/**`

### 7. Obtener enlace publico final

1. Haz deploy en Cloudflare Workers.
2. Verifica que el dominio de produccion sea `https://kais.click`.
3. Actualiza `NEXT_PUBLIC_APP_URL` en Cloudflare con `https://kais.click`.
4. Ejecuta nuevamente `npm run cf:deploy`.
5. Crea o publica un evento.
6. Comparte los enlaces cortos como `/e/[slug]`, `/f/[slug]`, `/a/[slug]` o `/l/[slug]`.

## Acceso por evento para clientes

KAIS puede crear accesos especificos por evento sin usar Supabase Auth para el cliente final. Supabase Auth queda para administradores KAIS. Ejecuta `supabase/migrations/006_event_logins.sql` para crear `event_logins` y actualizar la moderacion de fotos.

Checklist de prueba:

1. Admin KAIS entra por `/login`.
2. Admin crea o abre un evento en `/dashboard/eventos/[id]`.
3. En `Acceso del cliente`, admin genera acceso.
4. Admin copia el texto para WhatsApp.
5. Cliente entra en `/evento-login` con usuario y contrasena.
6. Cliente ve solo su evento en `/panel-evento`.
7. Invitado sube foto desde `/evento/[slug]`.
8. Cliente aprueba la foto en `/panel-evento`.
9. La foto aparece en la galeria publica.
10. Cliente cierra sesion desde el panel.
