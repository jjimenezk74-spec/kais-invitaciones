"use server";

import { redirect } from "next/navigation";
import { isCloudflareAuthEnabled, signInWithD1, signOutFromD1 } from "@/lib/cloudflare/auth";
import { ensureProfileForUser } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  console.info("[KAIS AUTH] Intentando login para", email);

  if (isCloudflareAuthEnabled()) {
    const result = await signInWithD1(email, password);
    if (!result.ok) {
      console.warn("[KAIS AUTH] Login D1 fallido:", result.error);
      redirect(`/login?error=${encodeURIComponent(result.error)}`);
    }

    console.info("[KAIS AUTH] Login D1 correcto. Redirigiendo a /dashboard");
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn("[KAIS AUTH] Login fallido:", error.message);
    redirect(`/login?error=${encodeURIComponent(getFriendlyAuthError(error.message))}`);
  }

  if (!data.user) {
    console.warn("[KAIS AUTH] Login sin usuario devuelto por Supabase.");
    redirect("/login?error=No se pudo iniciar sesion. Intenta nuevamente.");
  }

  let profile: Profile;
  try {
    profile = await ensureProfileForUser(data.user);
  } catch (profileError) {
    const message = profileError instanceof Error ? profileError.message : "No se pudo crear el perfil.";
    console.error("[KAIS AUTH] Login con sesion, pero profile fallo:", message);
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=Tu usuario interno esta desactivado. Contacta al super admin de KAIS.");
  }

  console.info("[KAIS AUTH] Login correcto. Redirigiendo a /dashboard");
  redirect("/dashboard");
}

export async function signUp() {
  redirect("/login?error=Registro deshabilitado. Los usuarios internos son creados por un super admin KAIS.");
}

export async function signOut() {
  if (isCloudflareAuthEnabled()) {
    await signOutFromD1();
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o contrasena incorrectos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de ingresar.";
  }

  return message;
}
