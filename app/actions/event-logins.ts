"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearEventLoginSession,
  generateEventPassword,
  getEventLoginSession,
  hashPassword as hashLegacyEventPassword,
  isExpired,
  normalizeUsername,
  setEventLoginSession,
  verifyPassword
} from "@/lib/event-login-auth";
import { hashPassword as hashCloudflarePassword, isCloudflareAuthEnabled, verifyCloudflarePassword } from "@/lib/cloudflare/auth";
import {
  createD1EventLogin,
  getD1EventByIdOrSlug,
  getD1EventLoginById,
  getD1EventLoginByUsername,
  listD1EventLogins,
  listD1EventPhotos,
  updateD1EventLoginActive,
  updateD1EventLoginExpiration as updateD1EventLoginExpirationValue,
  updateD1EventLoginLastLogin,
  updateD1EventLoginPassword,
  updateD1EventPhotoStatus
} from "@/lib/cloudflare/public-events";
import { canManageEventAccess } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventLogin, EventPhoto } from "@/lib/types";

export async function createEventLogin(eventId: string) {
  await assertAdmin();

  if (isCloudflareAuthEnabled()) {
    const event = await getD1EventByIdOrSlug(eventId);

    if (!event) {
      redirect(`/dashboard/eventos/${eventId}?error=No se encontro el evento.`);
    }

    const existingLogin = (await listD1EventLogins(eventId))[0];
    if (existingLogin) {
      redirect(`/dashboard/eventos/${eventId}?access_existing=${encodeURIComponent(existingLogin.username)}`);
    }

    const password = generateEventPassword();
    const username = await getAvailableUsername(normalizeUsername(event.slug));
    await createD1EventLogin({
      eventId,
      username,
      passwordHash: await hashCloudflarePassword(password),
      createdBy: (await getCurrentUserProfile()).user?.id ?? null
    });

    redirect(
      `/dashboard/eventos/${eventId}?login_username=${encodeURIComponent(username)}&login_password=${encodeURIComponent(password)}`
    );
  }

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
      password_hash: hashLegacyEventPassword(password),
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

  if (isCloudflareAuthEnabled()) {
    const login = await getD1EventLoginById(loginId);
    if (!login || login.event_id !== eventId) {
      redirect(`/dashboard/eventos/${eventId}?error=No se encontro el acceso.`);
    }

    const password = generateEventPassword();
    await updateD1EventLoginPassword(loginId, await hashCloudflarePassword(password));
    redirect(
      `/dashboard/eventos/${eventId}?login_username=${encodeURIComponent(login.username)}&login_password=${encodeURIComponent(password)}`
    );
  }

  const admin = createAdminClient();
  const password = generateEventPassword();
  const { data, error } = await admin
    .from("event_logins")
    .update({ password_hash: hashLegacyEventPassword(password) })
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

  if (isCloudflareAuthEnabled()) {
    await updateD1EventLoginActive(loginId, active);
    revalidatePath(`/dashboard/eventos/${eventId}`);
    return;
  }

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

  if (isCloudflareAuthEnabled()) {
    await updateD1EventLoginExpirationValue(loginId, expiresAt ? new Date(expiresAt).toISOString() : null);
    revalidatePath(`/dashboard/eventos/${eventId}`);
    return;
  }

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

  if (isCloudflareAuthEnabled()) {
    const login = await getD1EventLoginByUsername(username);

    if (!login || !(await verifyCloudflarePassword(password, login.password_hash))) {
      redirect("/evento-login?error=Usuario o contrasena incorrectos.");
    }

    if (!login.active) {
      redirect("/evento-login?error=Este acceso esta desactivado.");
    }

    if (isExpired(login.expires_at)) {
      redirect("/evento-login?error=Este acceso expiro. Contacta a KAIS INVITACIONES.");
    }

    await updateD1EventLoginLastLogin(login.id);
    await setEventLoginSession(login);
    redirect("/panel-evento");
  }

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

  if (isCloudflareAuthEnabled()) {
    const photo = (await listD1EventPhotos(login.event_id)).find((item) => item.id === photoId);
    if (!photo) {
      redirect("/panel-evento?error=No tienes acceso a esta foto.");
    }

    await updateD1EventPhotoStatus({
      photoId,
      eventId: login.event_id,
      status,
      isPublic,
      approvedByEventLogin: login.id
    });

    revalidatePath("/panel-evento");
    return;
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

  if (!canManageEventAccess(profile)) {
    redirect("/dashboard?error=Tu usuario no tiene permisos de administrador KAIS para gestionar accesos.");
  }
}

async function getAvailableUsername(base: string) {
  if (isCloudflareAuthEnabled()) {
    const cleanBase = base || `evento-${Date.now()}`;

    for (let index = 0; index < 20; index += 1) {
      const candidate = index === 0 ? cleanBase : `${cleanBase}-${index + 1}`;
      const existing = await getD1EventLoginByUsername(candidate);

      if (!existing) {
        return candidate;
      }
    }

    return `${cleanBase}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

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
