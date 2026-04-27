"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClientSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      client: null,
      error: "Faltan variables publicas de Supabase para subir archivos. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel."
    };
  }

  return {
    client: createBrowserClient(url, anonKey),
    error: null
  };
}

export function createClient() {
  const { client, error } = createClientSupabaseBrowser();

  if (!client) {
    throw new Error(error ?? "No se pudo inicializar Supabase en el navegador.");
  }

  return client;
}

export function getSupabaseBrowserEnvError() {
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : "",
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : ""
  ].filter(Boolean);

  return missing.length > 0 ? `Faltan variables publicas de Supabase: ${missing.join(", ")}.` : null;
}
