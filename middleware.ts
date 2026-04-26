import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildSupabaseEnvMessage, getMissingSupabasePublicEnv } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const missingEnv = getMissingSupabasePublicEnv();

  if (missingEnv.length > 0) {
    const message = buildSupabaseEnvMessage(missingEnv);
    console.warn(message);

    if (request.nextUrl.pathname !== "/") {
      return new NextResponse(renderMissingEnvPage(message), {
        status: 503,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-kais-supabase-config": message
        }
      });
    }

    response.headers.set("x-kais-supabase-config", message);
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};

function renderMissingEnvPage(message: string) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Configurar Supabase | KAIS INVITACIONES</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, sans-serif; background: #fbf7ef; color: #111827; }
      main { width: min(720px, calc(100% - 32px)); border: 1px solid #e5dccd; border-radius: 8px; background: #fff; padding: 32px; box-shadow: 0 24px 80px -48px rgba(17, 24, 39, .55); }
      p { line-height: 1.7; color: #4b5563; }
      code, pre { background: #f3f4f6; border-radius: 6px; }
      code { padding: 2px 6px; }
      pre { overflow: auto; padding: 16px; }
      a { color: #111827; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <p style="font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase;">KAIS INVITACIONES</p>
      <h1>Falta configurar Supabase</h1>
      <p>${escapeHtml(message)}</p>
      <pre>NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key</pre>
      <p>Después de guardar <code>.env.local</code>, reinicia <code>npm run dev</code>. La landing pública sigue disponible en <a href="/">/</a>.</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
