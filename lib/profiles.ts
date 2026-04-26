import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, profile: null, error };
  }

  const profile = await ensureProfileForUser(user);
  return { user, profile, error: null };
}

export async function ensureProfileForUser(user: User): Promise<Profile> {
  const supabase = await createClient();
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return existingProfile as Profile;
  }

  if (selectError) {
    console.warn("[KAIS AUTH] No se pudo leer profile. Intentando crearlo.", selectError.message);
  }

  const payload = {
    id: user.id,
    full_name: getFullName(user),
    email: user.email ?? null,
    role: "cliente"
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").upsert(payload).select("*").single();

    if (error) {
      throw error;
    }

    console.info("[KAIS AUTH] Profile creado con service role para", user.email ?? user.id);
    return data as Profile;
  } catch (adminError) {
    console.warn(
      "[KAIS AUTH] No se pudo crear profile con service role. Probando con cliente autenticado.",
      adminError instanceof Error ? adminError.message : adminError
    );
  }

  const { data, error } = await supabase.from("profiles").upsert(payload).select("*").single();

  if (error) {
    throw new Error(
      `Sesión iniciada, pero no se pudo crear el perfil del usuario. Revisa la política RLS de profiles y SUPABASE_SERVICE_ROLE_KEY. Detalle: ${error.message}`
    );
  }

  console.info("[KAIS AUTH] Profile creado con cliente autenticado para", user.email ?? user.id);
  return data as Profile;
}

function getFullName(user: User) {
  const metadataName = user.user_metadata?.full_name;
  return typeof metadataName === "string" && metadataName.trim().length > 0
    ? metadataName.trim()
    : null;
}
