const SUPABASE_PUBLIC_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
] as const;

const SUPABASE_ADMIN_KEYS = [
  ...SUPABASE_PUBLIC_KEYS,
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

export function getSupabasePublicEnv() {
  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
  const missing = getMissingEnv(SUPABASE_PUBLIC_KEYS);

  if (missing.length > 0) {
    throw new Error(buildSupabaseEnvMessage(missing));
  }

  return env as { url: string; anonKey: string };
}

export function getSupabaseAdminEnv() {
  const publicEnv = getSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = getMissingEnv(SUPABASE_ADMIN_KEYS);

  if (missing.length > 0) {
    throw new Error(buildSupabaseEnvMessage(missing));
  }

  return {
    ...publicEnv,
    serviceRoleKey: serviceRoleKey as string
  };
}

export function getMissingSupabasePublicEnv() {
  return getMissingEnv(SUPABASE_PUBLIC_KEYS);
}

export function buildSupabaseEnvMessage(missing: readonly string[]) {
  return [
    "Faltan variables de entorno de Supabase para KAIS INVITACIONES.",
    `Variables faltantes: ${missing.join(", ")}.`,
    "Crea un archivo .env.local en la raiz del proyecto usando .env.example y reinicia npm run dev."
  ].join(" ");
}

function getMissingEnv(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
}
