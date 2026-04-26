"use server";

import { redirect } from "next/navigation";
import { ensureProfileForUser } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  console.info("[KAIS AUTH] Intentando login para", email);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn("[KAIS AUTH] Login fallido:", error.message);
    redirect(`/login?error=${encodeURIComponent(getFriendlyAuthError(error.message))}`);
  }

  if (!data.user) {
    console.warn("[KAIS AUTH] Login sin usuario devuelto por Supabase.");
    redirect("/login?error=No se pudo iniciar sesion. Intenta nuevamente.");
  }

  try {
    await ensureProfileForUser(data.user);
  } catch (profileError) {
    const message = profileError instanceof Error ? profileError.message : "No se pudo crear el perfil.";
    console.error("[KAIS AUTH] Login con sesión, pero profile falló:", message);
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  console.info("[KAIS AUTH] Login correcto. Redirigiendo a /dashboard");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: absoluteUrl("/login?status=Correo confirmado. Ya puedes ingresar."),
      data: {
        full_name: fullName,
        role: "cliente"
      }
    }
  });

  if (error) redirect(`/registro?error=${encodeURIComponent(error.message)}`);

  if (data.user) {
    try {
      await ensureProfileForUser(data.user);
    } catch (profileError) {
      console.warn(
        "[KAIS AUTH] Registro creado, pero profile todavía no pudo asegurarse:",
        profileError instanceof Error ? profileError.message : profileError
      );
    }
  }

  if (!data.session) {
    redirect("/login?status=Revisa tu correo para confirmar la cuenta antes de ingresar.");
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de ingresar.";
  }

  return message;
}
