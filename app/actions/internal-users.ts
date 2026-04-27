"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, isSuperAdmin } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const INTERNAL_ROLES = ["super_admin", "admin", "admin_kais", "diseñador", "soporte_evento", "vendedor"] as const;

export async function createInternalUser(formData: FormData) {
  await assertSuperAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim() || generateTemporaryPassword();
  const role = getInternalRole(formData.get("role"));
  const isActive = formData.get("is_active") === "on";

  if (!fullName || !email || password.length < 8) {
    redirect("/dashboard/usuarios?error=Nombre, email y contrasena temporal de minimo 8 caracteres son obligatorios.");
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role
    }
  });

  if (authError || !authData.user) {
    redirect(`/dashboard/usuarios?error=${encodeURIComponent(authError?.message ?? "No se pudo crear el usuario.")}`);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authData.user.id,
    full_name: fullName,
    email,
    role,
    is_active: isActive
  });

  if (profileError) {
    redirect(`/dashboard/usuarios?error=${encodeURIComponent(profileError.message)}`);
  }

  revalidatePath("/dashboard/usuarios");
  redirect(
    `/dashboard/usuarios?created_email=${encodeURIComponent(email)}&created_password=${encodeURIComponent(password)}&created_role=${encodeURIComponent(role)}`
  );
}

export async function updateInternalUserRole(userId: string, formData: FormData) {
  const currentUserId = await assertSuperAdmin();
  const role = getInternalRole(formData.get("role"));
  const admin = createAdminClient();

  if (userId === currentUserId && role !== "super_admin") {
    redirect("/dashboard/usuarios?error=No puedes quitarte tu propio rol super_admin.");
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);

  if (error) {
    redirect(`/dashboard/usuarios?error=${encodeURIComponent(error.message)}`);
  }

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { role }
  });

  revalidatePath("/dashboard/usuarios");
}

export async function toggleInternalUserActive(userId: string, active: boolean) {
  const currentUserId = await assertSuperAdmin();

  if (userId === currentUserId && !active) {
    redirect("/dashboard/usuarios?error=No puedes desactivar tu propio usuario super_admin.");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();

  if (profile?.role === "super_admin" && !active && userId !== currentUserId) {
    redirect("/dashboard/usuarios?error=No puedes desactivar otro super_admin desde este MVP.");
  }

  const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", userId);

  if (error) {
    redirect(`/dashboard/usuarios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/usuarios");
}

export async function deleteInternalUser(userId: string) {
  const currentUserId = await assertSuperAdmin();

  if (userId === currentUserId) {
    redirect("/dashboard/usuarios?error=No puedes eliminar tu propio usuario super_admin.");
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    redirect(`/dashboard/usuarios?error=${encodeURIComponent(authError.message)}`);
  }

  await admin.from("profiles").delete().eq("id", userId);

  revalidatePath("/dashboard/usuarios");
  redirect("/dashboard/usuarios?deleted=Usuario interno eliminado.");
}

async function assertSuperAdmin() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?error=Inicia sesion para gestionar usuarios internos.");
  }

  if (!isSuperAdmin(profile?.role)) {
    redirect("/dashboard?error=Solo super_admin puede gestionar usuarios internos.");
  }

  return user.id;
}

function getInternalRole(value: FormDataEntryValue | null): Exclude<UserRole, "cliente"> {
  const role = String(value ?? "soporte_evento");
  return INTERNAL_ROLES.includes(role as (typeof INTERNAL_ROLES)[number])
    ? (role as Exclude<UserRole, "cliente">)
    : "soporte_evento";
}

function generateTemporaryPassword() {
  return `KAIS-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
}
