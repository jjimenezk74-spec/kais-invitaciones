"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearEventLoginSession,
  generateEventPassword,
  getEventLoginSession,
  hashPassword,
  isExpired,
  normalizeUsername,
  setEventLoginSession,
  verifyPassword
} from "@/lib/event-login-auth";
import { getCurrentUserProfile, isKaisAdmin } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventLogin, EventPhoto } from "@/lib/types";

export async function createEventLogin(eventId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin.from("events").select("*").eq("id", eventId).single();

  if (eventError || !event) {
    redirect(`/dashboard/eventos/${eventId}?error=No se encontro el evento.`);
  }

  const { data: existingLogin } = await admin
    .from("event_logins")
    .select("username")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLogin) {
    redirect(`/dashboard/eventos/${eventId}?access_existing=${encodeURIComponent(existingLogin.username)}`);
  }

  const password = generateEventPassword();
  const username = await getAvailableUsername(normalizeUsername((event as Event).slug));
  const { data, error } = await admin
    .from("event_logins")
    .insert({
      event_id: eventId,
      username,
      password_hash: hashPassword(password),
      active: true,
      created_by: (await getCurrentUserProfile()).user?.id ?? null
    })
    .select("id,username")
    .single();

  if (error || !data) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error?.message ?? "No se pudo crear el acceso.")}`);
  }

  redirect(
    `/dashboard/eventos/${eventId}?login_username=${encodeURIComponent(username)}&login_password=${encodeURIComponent(password)}`
  );
}

export async function resetEventLoginPassword(loginId: string, eventId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const password = generateEventPassword();
  const { data, error } = await admin
    .from("event_logins")
    .update({ password_hash: hashPassword(password) })
    .eq("id", loginId)
    .select("username")
    .single();

  if (error || !data) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error?.message ?? "No se pudo resetear la contrasena.")}`);
  }

  redirect(
    `/dashboard/eventos/${eventId}?login_username=${encodeURIComponent(data.username)}&login_password=${encodeURIComponent(password)}`
  );
}

export async function toggleEventLoginActive(loginId: string, eventId: string, active: boolean) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("event_logins").update({ active }).eq("id", loginId);

  if (error) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
}

export async function updateEventLoginExpiration(loginId: string, eventId: string, formData: FormData) {
  await assertAdmin();
  const expiresAt = String(formData.get("expires_at") ?? "").trim();
  const admin = createAdminClient();
  const { error } = await admin
    .from("event_logins")
    .update({ expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })
    .eq("id", loginId);

  if (error) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
}

export async function eventLoginSignIn(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const admin = createAdminClient();
  const { data: login } = await admin.from("event_logins").select("*").eq("username", username).maybeSingle();

  if (!login || !verifyPassword(password, login.password_hash)) {
    redirect("/evento-login?error=Usuario o contrasena incorrectos.");
  }

  if (!login.active) {
    redirect("/evento-login?error=Este acceso esta desactivado.");
  }

  if (isExpired(login.expires_at)) {
    redirect("/evento-login?error=Este acceso expiro. Contacta a KAIS INVITACIONES.");
  }

  await admin.from("event_logins").update({ last_login_at: new Date().toISOString() }).eq("id", login.id);
  await setEventLoginSession(login as EventLogin);
  redirect("/panel-evento");
}

export async function eventLoginSignOut() {
  await clearEventLoginSession();
  redirect("/evento-login");
}

export async function approveEventPhoto(photoId: string) {
  await updatePhotoStatus(photoId, "aprobada", true);
}

export async function rejectEventPhoto(photoId: string) {
  await updatePhotoStatus(photoId, "rechazada", false);
}

export async function makeEventPhotoPrivate(photoId: string) {
  await updatePhotoStatus(photoId, "aprobada", false);
}

async function updatePhotoStatus(photoId: string, status: "aprobada" | "rechazada", isPublic: boolean) {
  const login = await getEventLoginSession();

  if (!login) {
    redirect("/evento-login?error=Inicia sesion para gestionar fotos.");
  }

  const admin = createAdminClient();
  const { data: photo } = await admin.from("event_photos").select("*").eq("id", photoId).single();

  if (!photo || (photo as EventPhoto).event_id !== login.event_id) {
    redirect("/panel-evento?error=No tienes acceso a esta foto.");
  }

  const { error } = await admin
    .from("event_photos")
    .update({
      status,
      is_public: isPublic,
      is_approved: status === "aprobada" && isPublic,
      approved_at: status === "aprobada" ? new Date().toISOString() : null,
      approved_by_event_login: status === "aprobada" ? login.id : null
    })
    .eq("id", photoId);

  if (error) {
    redirect(`/panel-evento?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/panel-evento");
}

async function assertAdmin() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?error=Inicia sesion para gestionar accesos.");
  }

  if (!isKaisAdmin(profile?.role)) {
    redirect("/dashboard?error=Tu usuario no tiene permisos de administrador KAIS para gestionar accesos.");
  }
}

async function getAvailableUsername(base: string) {
  const admin = createAdminClient();
  const cleanBase = base || `evento-${Date.now()}`;

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? cleanBase : `${cleanBase}-${index + 1}`;
    const { data } = await admin.from("event_logins").select("id").eq("username", candidate).maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return `${cleanBase}-${Math.floor(1000 + Math.random() * 9000)}`;
}
