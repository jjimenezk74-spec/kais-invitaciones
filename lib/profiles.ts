import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export function isKaisAdmin(role?: string | null) {
  return role === "super_admin" || role === "admin" || role === "admin_kais";
}

export function isSuperAdmin(role?: string | null) {
  return role === "super_admin";
}

export function canCreateEvents(role?: string | null) {
  return role === "super_admin" || role === "admin" || role === "admin_kais";
}

export function canManageClients(role?: string | null) {
  return role === "super_admin" || role === "admin_kais" || role === "vendedor";
}

export function canModerateEvents(role?: string | null) {
  return isKaisAdmin(role) || role === "soporte_evento";
}

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
    return promoteFirstProfileIfNeeded(existingProfile as Profile);
  }

  if (selectError) {
    console.warn("[KAIS AUTH] No se pudo leer profile. Intentando crearlo.", selectError.message);
  }

  const role = await getInitialRole();
  const payload = {
    id: user.id,
    full_name: getFullName(user),
    email: user.email ?? null,
    role,
    is_active: true
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

async function getInitialRole(): Promise<Profile["role"]> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true });

    if (!error && (count ?? 0) === 0) {
      return "super_admin";
    }
  } catch {
    // If admin env is unavailable, fall back to a normal client profile.
  }

  return "cliente";
}

async function promoteFirstProfileIfNeeded(profile: Profile): Promise<Profile> {
  if (isKaisAdmin(profile.role)) {
    return profile;
  }

  try {
    const admin = createAdminClient();
    const { count, error: countError } = await admin.from("profiles").select("id", { count: "exact", head: true });

    if (countError || (count ?? 0) !== 1) {
      return profile;
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ role: "super_admin", is_active: true })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error || !data) {
      return profile;
    }

    console.info("[KAIS AUTH] Primer perfil promovido automaticamente a super_admin:", profile.email ?? profile.id);
    return data as Profile;
  } catch {
    return profile;
  }
}

function getFullName(user: User) {
  const metadataName = user.user_metadata?.full_name;
  return typeof metadataName === "string" && metadataName.trim().length > 0
    ? metadataName.trim()
    : null;
}
