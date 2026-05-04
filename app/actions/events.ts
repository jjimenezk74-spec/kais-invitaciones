"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeInvitationDesignConfig } from "@/lib/invitation-design";
import { eventHasFeature } from "@/lib/event-features";
import {
  canCreateEvents,
  canDeleteEvents,
  canEditEventDesign,
  canManageEvents,
  canManageGuests,
  canManagePhotos,
  canViewRsvps,
} from "@/lib/permissions";
import { getCurrentUserProfile, isKaisAdmin } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type {
  EventPackageKey,
  EventGuest,
  InvitationDesignConfig,
  VisualDecoration,
  VisualDecorationDevice,
  VisualDecorationEffect,
  VisualDecorationGlowStrength,
  VisualDecorationSection
} from "@/lib/types";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg"];
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg"
];
const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;
const EVENT_STATUSES = ["borrador", "publicado", "inactivo"] as const;
const GUEST_MODES = ["publico", "lista_invitados"] as const;
const EVENT_PACKAGE_KEYS = ["essential", "premium", "experience", "luxury"] as const;

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!canCreateEvents(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para crear eventos.");
  }

  const requestedOwnerId = String(formData.get("owner_id") ?? "").trim();
  const ownerId = requestedOwnerId || user.id;
  const title = String(formData.get("title") ?? "Nuevo evento");
  const requestedSlug = String(formData.get("slug") ?? "").trim();
  let musicUrl: string | null;
  const manualCoverUrl = nullable(formData.get("cover_image_url"));
  const coverFile = getOptionalFile(formData.get("cover_image_file"));
  const mobileCoverFile = getOptionalFile(formData.get("mobile_cover_image_file"));

  try {
    if (coverFile) validateCoverImageFile(coverFile);
    if (mobileCoverFile) validateCoverImageFile(mobileCoverFile);
    musicUrl = await getMusicUrlFromForm(formData, supabase, user.id);
  } catch (error) {
    redirect(`/dashboard/eventos/nuevo?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  const slug = requestedSlug || `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
  const slugError = await validateUniqueSlug(slug);
  if (slugError) redirect(`/dashboard/eventos/nuevo?error=${encodeURIComponent(slugError)}`);

  const payload = {
    owner_id: isKaisAdmin(profile?.role) ? ownerId : user.id,
    title,
    event_type: String(formData.get("event_type") ?? "otro"),
    hosts_names: String(formData.get("hosts_names") ?? ""),
    event_date: String(formData.get("event_date") ?? ""),
    event_time: String(formData.get("event_time") ?? ""),
    address: String(formData.get("address") ?? ""),
    google_maps_link: nullable(formData.get("google_maps_link")),
    whatsapp_phone: normalizeParaguayWhatsapp(formData.get("whatsapp_phone")),
    external_photo_album_url: getOptionalUrl(formData.get("external_photo_album_url"), "/dashboard/eventos/nuevo"),
    main_message: nullable(formData.get("main_message")),
    dress_code: nullable(formData.get("dress_code")),
    cover_image_url: manualCoverUrl,
    mobile_cover_image_url: nullable(formData.get("mobile_cover_image_url")),
    music_url: musicUrl,
    visual_decorations: getVisualDecorationsFromForm(formData),
    design_config: getDesignConfigFromForm(formData),
    theme_color: String(formData.get("theme_color") || "#111827"),
    status: getEventStatus(formData.get("status")),
    guest_mode: getGuestMode(formData.get("guest_mode")),
    client_id: nullable(formData.get("client_id")),
    template_id: nullable(formData.get("template_id")),
    category_id: nullableUuid(formData.get("category_id")),
    theme_id: nullableUuid(formData.get("theme_id")),
    slug: normalizeEventSlug(slug)
  };

  const { data, error } = await supabase.from("events").insert(payload).select("id").single();
  if (error) redirect(`/dashboard/eventos/nuevo?error=${encodeURIComponent(error.message)}`);

  if (coverFile || mobileCoverFile) {
    try {
      const coverImageUrl = coverFile ? await uploadCoverImage(coverFile, supabase, data.id, "desktop") : null;
      const mobileCoverImageUrl = mobileCoverFile ? await uploadCoverImage(mobileCoverFile, supabase, data.id, "mobile") : null;
      const { error: coverUpdateError } = await supabase
        .from("events")
        .update({
          ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
          ...(mobileCoverImageUrl ? { mobile_cover_image_url: mobileCoverImageUrl } : {})
        })
        .eq("id", data.id);

      if (coverUpdateError) {
        throw new Error(coverUpdateError.message);
      }
    } catch (error) {
      redirect(`/dashboard/eventos/${data.id}?error=${encodeURIComponent(getErrorMessage(error))}`);
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/eventos/${data.id}?saved=created`);
}

export async function updateEvent(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!canManageEvents(profile)) {
    redirect(`/dashboard/eventos/${eventId}?error=Tu rol no tiene permisos para editar todos los datos del evento.`);
  }

  let musicUrl: string | null;
  let coverImageUrl = nullable(formData.get("cover_image_url"));
  let mobileCoverImageUrl = nullable(formData.get("mobile_cover_image_url"));
  const coverFile = getOptionalFile(formData.get("cover_image_file"));
  const mobileCoverFile = getOptionalFile(formData.get("mobile_cover_image_file"));

  try {
    if (coverFile) {
      validateCoverImageFile(coverFile);
      coverImageUrl = await uploadCoverImage(coverFile, supabase, eventId, "desktop");
    }
    if (mobileCoverFile) {
      validateCoverImageFile(mobileCoverFile);
      mobileCoverImageUrl = await uploadCoverImage(mobileCoverFile, supabase, eventId, "mobile");
    }
    musicUrl = await getMusicUrlFromForm(formData, supabase, user.id);
  } catch (error) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  const payload = {
    title: String(formData.get("title") ?? ""),
    event_type: String(formData.get("event_type") ?? "otro"),
    hosts_names: String(formData.get("hosts_names") ?? ""),
    event_date: String(formData.get("event_date") ?? ""),
    event_time: String(formData.get("event_time") ?? ""),
    address: String(formData.get("address") ?? ""),
    google_maps_link: nullable(formData.get("google_maps_link")),
    whatsapp_phone: normalizeParaguayWhatsapp(formData.get("whatsapp_phone")),
    external_photo_album_url: getOptionalUrl(formData.get("external_photo_album_url"), `/dashboard/eventos/${eventId}`),
    main_message: nullable(formData.get("main_message")),
    dress_code: nullable(formData.get("dress_code")),
    cover_image_url: coverImageUrl,
    mobile_cover_image_url: mobileCoverImageUrl,
    music_url: musicUrl,
    visual_decorations: getVisualDecorationsFromForm(formData),
    design_config: getDesignConfigFromForm(formData),
    theme_color: String(formData.get("theme_color") || "#111827"),
    status: getEventStatus(formData.get("status")),
    guest_mode: getGuestMode(formData.get("guest_mode")),
    client_id: nullable(formData.get("client_id")),
    template_id: nullable(formData.get("template_id")),
    category_id: nullableUuid(formData.get("category_id")),
    theme_id: nullableUuid(formData.get("theme_id"))
  };

  const requestedSlug = String(formData.get("slug") ?? "").trim();
  const normalizedSlug = normalizeEventSlug(requestedSlug);
  if (!normalizedSlug) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent("El enlace corto es obligatorio.")}`);
  }
  const slugError = await validateUniqueSlug(normalizedSlug, eventId);
  if (slugError) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(slugError)}`);
  }
  Object.assign(payload, { slug: normalizedSlug });

  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  if (error) redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/eventos/${eventId}`);
  redirect(`/dashboard/eventos/${eventId}?saved=updated`);
}

export async function saveVisualDecorationsOnly(eventId: string, visualDecorations: VisualDecoration[]) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Tu sesion expiro. Inicia sesion nuevamente." };
  }

  const profile = await getCurrentProfile();
  if (!canEditEventDesign(profile)) {
    return { ok: false, error: "Tu rol no tiene permisos para editar decoraciones." };
  }

  const payload = sanitizeVisualDecorations(visualDecorations);
  const { error } = await supabase
    .from("events")
    .update({ visual_decorations: payload })
    .eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { ok: true, visualDecorations: payload };
}

export async function updateEventThemeOnly(
  eventId: string,
  input: {
    categoryId?: string | null;
    themeId?: string | null;
    designConfig?: Partial<InvitationDesignConfig> | null;
  }
) {
  const permission = await ensurePartialEventEditPermission("tema");
  if (!permission.ok) return permission;

  const payload = {
    category_id: normalizeUuid(input.categoryId),
    theme_id: normalizeUuid(input.themeId),
    design_config: normalizeInvitationDesignConfig({ designConfig: input.designConfig ?? undefined })
  };

  const { error } = await permission.supabase
    .from("events")
    .update(payload)
    .eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { ok: true, payload };
}

export async function updateEventCoverOnly(
  eventId: string,
  input: {
    coverImageUrl?: string | null;
    mobileCoverImageUrl?: string | null;
  }
) {
  const permission = await ensurePartialEventEditPermission("portada");
  if (!permission.ok) return permission;

  const payload = {
    cover_image_url: normalizeOptionalText(input.coverImageUrl),
    mobile_cover_image_url: normalizeOptionalText(input.mobileCoverImageUrl)
  };

  const { error } = await permission.supabase
    .from("events")
    .update(payload)
    .eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { ok: true, payload };
}

export async function updateEventMusicOnly(eventId: string, musicUrl?: string | null) {
  const permission = await ensurePartialEventEditPermission("musica");
  if (!permission.ok) return permission;

  const { data: eventFeatures, error: eventFeaturesError } = await permission.supabase
    .from("events")
    .select("id,package_key,enabled_features,disabled_features")
    .eq("id", eventId)
    .maybeSingle();

  if (eventFeaturesError || !eventFeatures) {
    return { ok: false, error: "No se pudo validar el paquete contratado del evento." };
  }

  if (!eventHasFeature(eventFeatures, "music")) {
    return {
      ok: false,
      error: "El paquete contratado para este evento no incluye musica."
    };
  }

  const payload = { music_url: normalizeOptionalText(musicUrl) };
  const { error } = await permission.supabase
    .from("events")
    .update(payload)
    .eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { ok: true, payload };
}

export async function updateEventPackage(eventId: string, packageKey: EventPackageKey) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    return { ok: false, error: "Inicia sesion para cambiar el paquete del evento." };
  }

  if (!canManageEvents(profile)) {
    return { ok: false, error: "Tu rol no tiene permisos para cambiar el paquete contratado." };
  }

  if (!EVENT_PACKAGE_KEYS.includes(packageKey)) {
    return { ok: false, error: "Paquete invalido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ package_key: packageKey })
    .eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { ok: true, packageKey };
}

export async function deleteEvent(eventId: string) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?error=Inicia sesion para eliminar eventos.");
  }

  if (!canDeleteEvents(profile)) {
    redirect("/dashboard?error=Solo administradores KAIS pueden eliminar eventos.");
  }

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id,title,cover_image_url,mobile_cover_image_url,music_url,decoration_top_left,decoration_top_right,decoration_bottom_left,decoration_bottom_right,decoration_side_left,decoration_side_right,visual_decorations")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(eventError?.message ?? "No se encontro el evento.")}`);
  }

  const { data: photosData } = await admin.from("event_photos").select("storage_path").eq("event_id", eventId);
  const storageWarnings = await deleteEventStorageFiles({
    coverImageUrl: event.cover_image_url,
    mobileCoverImageUrl: event.mobile_cover_image_url,
    musicUrl: event.music_url,
    decorationUrls: [
      event.decoration_top_left,
      event.decoration_top_right,
      event.decoration_bottom_left,
      event.decoration_bottom_right,
      event.decoration_side_left,
      event.decoration_side_right,
      ...getVisualDecorationUrls(event.visual_decorations)
    ],
    photoPaths: (photosData ?? []).map((photo) => photo.storage_path).filter(Boolean)
  });

  const { error: deleteError } = await admin.from("events").delete().eq("id", eventId);

  if (deleteError) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(`No se pudo eliminar el evento. Detalle: ${deleteError.message}`)}`);
  }

  revalidatePath("/dashboard");

  const params = new URLSearchParams({
    deleted: String(event.title ?? "Evento eliminado")
  });

  if (storageWarnings.length > 0) {
    params.set("warning", "El evento se elimino, pero algunos archivos de Storage no pudieron borrarse automaticamente.");
  }

  redirect(`/dashboard?${params.toString()}`);
}

export async function submitRsvp(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const slug = String(formData.get("slug") ?? "").trim();
  const guestToken = String(formData.get("guest_token") ?? "").trim();
  const rsvpUrl = (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    if (guestToken) search.set("guest", guestToken);
    return `/evento/${slug}?${search.toString()}#rsvp`;
  };
  const errorUrl = (message: string) => rsvpUrl({ rsvp_error: message });
  let guestName = String(formData.get("guest_name") ?? "").trim();
  const companions = Number(formData.get("companions") || 0);
  const attending = String(formData.get("attending")) === "si";
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const dietaryRestrictions = String(formData.get("dietary_restrictions") ?? "").trim();
  const shouldOpenWhatsApp = String(formData.get("external_rsvp_whatsapp") ?? "") === "1";
  const eventTitle = String(formData.get("event_title") ?? "").trim();
  let eventGuest: EventGuest | null = null;

  if (!slug) {
    redirect("/?error=No se pudo identificar la invitacion.");
  }

  if (guestToken) {
    const admin = createAdminClient();
    const { data: guestData } = await admin
      .from("event_guests")
      .select("*")
      .eq("token", guestToken)
      .eq("event_id", eventId)
      .maybeSingle();

    eventGuest = (guestData ?? null) as EventGuest | null;

    if (!eventGuest) {
      redirect(errorUrl("Este enlace personal no es valido."));
    }

    if (eventGuest.status === "bloqueado") {
      redirect(errorUrl("Este enlace ya no esta activo."));
    }

    if (companions > eventGuest.max_companions) {
      redirect(errorUrl(`Este enlace permite un cupo total de ${eventGuest.max_companions + 1} persona${eventGuest.max_companions + 1 === 1 ? "" : "s"}.`));
    }

    guestName = eventGuest.guest_name;

    if (eventGuest.rsvp_id) {
      revalidatePath(`/evento/${slug}`);
      redirect(rsvpUrl(buildRsvpSuccessParams({
        guestName,
        attending,
        companions,
        phone,
        email,
        message,
        dietaryRestrictions,
        eventTitle,
        shouldOpenWhatsApp
      })));
    }
  } else {
    const { data: eventData } = await createAdminClient()
      .from("events")
      .select("status,guest_mode")
      .eq("id", eventId)
      .maybeSingle();

    if (eventData?.status !== "publicado") {
      redirect(errorUrl("Esta invitacion aun no esta publicada."));
    }

    if (eventData?.guest_mode === "lista_invitados") {
      redirect(errorUrl("Esta invitacion requiere enlace personal."));
    }
  }

  if (!guestName) {
    redirect(errorUrl("Escribe tu nombre para confirmar asistencia."));
  }

  if (!Number.isFinite(companions) || companions < 0) {
    redirect(errorUrl("La cantidad de acompanantes debe ser 0 o mayor."));
  }

  const payload = {
    event_id: eventId,
    guest_name: guestName,
    phone: nullable(formData.get("phone")),
    email: nullable(formData.get("email")),
    attending,
    companions: Math.floor(companions),
    message: nullable(formData.get("message")),
    dietary_restrictions: nullable(formData.get("dietary_restrictions"))
  };

  const client = createAdminClient();
  const { data: insertedRsvp, error } = await client.from("rsvps").insert(payload).select("id").single();
  if (error) {
    console.error("[KAIS RSVP] No se pudo guardar RSVP", {
      eventId,
      slug,
      code: error.code,
      message: error.message
    });
    redirect(errorUrl("No pudimos guardar tu confirmacion. Intenta de nuevo o contacta a los anfitriones."));
  }

  if (eventGuest) {
    await createAdminClient()
      .from("event_guests")
      .update({
        rsvp_id: insertedRsvp?.id ?? null,
        status: attending ? "confirmado" : "no_asiste",
        last_opened_at: new Date().toISOString()
      })
      .eq("id", eventGuest.id);
  }

  revalidatePath(`/evento/${slug}`);
  redirect(rsvpUrl(buildRsvpSuccessParams({
    guestName,
    attending,
    companions,
    phone,
    email,
    message,
    dietaryRestrictions,
    eventTitle,
    shouldOpenWhatsApp
  })));
}

export async function createEventGuest(eventId: string, formData: FormData) {
  const { profile } = await getCurrentUserProfile();
  if (!canManageGuests(profile)) {
    redirect(`/dashboard/eventos/${eventId}?error=Solo admin KAIS puede gestionar invitados.`);
  }

  const guestName = String(formData.get("guest_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = nullable(formData.get("email"));
  // DB compatibility: event_guests.max_companions stores additional companions.
  // UI exposes total quota including the titular guest.
  const totalQuota = Math.max(1, Math.floor(Number(formData.get("total_quota") || formData.get("max_companions") || 1)));
  const maxCompanions = Math.max(0, totalQuota - 1);

  if (!guestName || !phone) {
    redirect(`/dashboard/eventos/${eventId}?error=Nombre y telefono son obligatorios para agregar invitado.`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("event_guests").insert({
    event_id: eventId,
    guest_name: guestName,
    phone,
    email,
    max_companions: maxCompanions,
    token: crypto.randomUUID().replace(/-/g, "")
  });

  if (error) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
}

export async function deleteEventGuest(guestId: string, eventId: string) {
  const { profile } = await getCurrentUserProfile();
  if (!canManageGuests(profile)) {
    redirect(`/dashboard/eventos/${eventId}?error=Solo admin KAIS puede eliminar invitados.`);
  }

  const { error } = await createAdminClient().from("event_guests").delete().eq("id", guestId).eq("event_id", eventId);
  if (error) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/dashboard/eventos/${eventId}`);
}

export async function toggleEventGuestBlocked(guestId: string, eventId: string, blocked: boolean) {
  const { profile } = await getCurrentUserProfile();
  if (!canManageGuests(profile)) {
    redirect(`/dashboard/eventos/${eventId}?error=Solo admin KAIS puede bloquear invitados.`);
  }

  const { error } = await createAdminClient()
    .from("event_guests")
    .update({ status: blocked ? "bloqueado" : "pendiente" })
    .eq("id", guestId)
    .eq("event_id", eventId);
  if (error) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/dashboard/eventos/${eventId}`);
}

export async function uploadEventPhoto(eventId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("photo");
  const photoUrl = (params: Record<string, string>) => `/evento/${slug}?${new URLSearchParams(params).toString()}#fotos`;
  const errorUrl = (message: string) => photoUrl({ foto_error: message });

  if (!(file instanceof File) || file.size === 0) {
    redirect(errorUrl("Selecciona una foto para subir."));
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${eventId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("event-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (uploadError) {
    console.error("[KAIS FOTO] No se pudo subir foto", { eventId, slug, message: uploadError.message });
    redirect(errorUrl("No pudimos subir la foto. Intenta de nuevo en unos minutos."));
  }

  const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
  const { error } = await supabase.from("event_photos").insert({
    event_id: eventId,
    storage_path: path,
    public_url: data.publicUrl,
    guest_name: nullable(formData.get("guest_name")),
    is_approved: false,
    status: "pendiente",
    is_public: false
  });
  if (error) {
    console.error("[KAIS FOTO] No se pudo guardar registro de foto", { eventId, slug, message: error.message });
    redirect(errorUrl("La foto se subio, pero no pudimos registrarla para moderacion."));
  }

  revalidatePath(`/evento/${slug}`);
  redirect(photoUrl({ foto: "ok" }));
}

export async function approvePhoto(photoId: string, eventId: string, approved: boolean) {
  const { profile } = await getCurrentUserProfile();

  if (!canManagePhotos(profile)) {
    redirect("/dashboard?error=Tu usuario no tiene permisos para moderar fotos.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("event_photos")
    .update({
      is_approved: approved,
      status: approved ? "aprobada" : "rechazada",
      is_public: approved,
      approved_at: approved ? new Date().toISOString() : null
    })
    .eq("id", photoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/eventos/${eventId}`);
}

export async function exportRsvpsCsv(eventId: string) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) {
    redirect("/login?error=Inicia sesion para exportar RSVP.");
  }
  if (!canViewRsvps(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para exportar confirmaciones.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rsvps")
    .select("id,guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const rsvpIds = rows.map((row) => row.id);
  const { data: guestRows } = rsvpIds.length
    ? await supabase.from("event_guests").select("rsvp_id,max_companions").eq("event_id", eventId).in("rsvp_id", rsvpIds)
    : { data: [] };
  const cupoByRsvpId = new Map((guestRows ?? []).map((guest) => [guest.rsvp_id, Number(guest.max_companions ?? 0) + 1]));
  const header = ["nombre", "telefono", "email", "asistira", "cupo_total", "acompanantes_confirmados", "total_confirmado", "mensaje", "restriccion_alimentaria", "fecha"];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.guest_name,
        row.phone,
        row.email,
        row.attending ? "si" : "no",
        cupoByRsvpId.get(row.id) ?? "",
        row.companions,
        row.attending ? Number(row.companions ?? 0) + 1 : 0,
        row.message,
        row.dietary_restrictions,
        row.created_at
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\n");
}

export async function trackVisit(eventId: string, userAgent?: string | null) {
  const supabase = await createClient();
  await supabase.from("analytics_visits").insert({
    event_id: eventId,
    user_agent: userAgent ?? null
  });
}

export async function getCurrentProfile() {
  const { profile } = await getCurrentUserProfile();
  return profile;
}

function buildRsvpSuccessParams({
  guestName,
  attending,
  companions,
  phone,
  email,
  message,
  dietaryRestrictions,
  eventTitle,
  shouldOpenWhatsApp
}: {
  guestName: string;
  attending: boolean;
  companions: number;
  phone: string;
  email: string;
  message: string;
  dietaryRestrictions: string;
  eventTitle: string;
  shouldOpenWhatsApp: boolean;
}) {
  const params: Record<string, string> = {
    rsvp: "ok",
    rsvp_attending: attending ? "si" : "no"
  };

  if (shouldOpenWhatsApp) {
    params.wa = "1";
    params.wa_message = [
      `Confirmacion RSVP - ${eventTitle || "Evento"}`,
      "",
      `Nombre: ${guestName}`,
      `Asistira: ${attending ? "Si" : "No"}`,
      `Acompanantes: ${companions}`,
      phone ? `Telefono: ${phone}` : "",
      email ? `Email: ${email}` : "",
      dietaryRestrictions ? `Restriccion alimentaria: ${dietaryRestrictions}` : "",
      message ? `Mensaje: ${message}` : ""
    ].filter(Boolean).join("\n");
  }

  return params;
}

function normalizeParaguayWhatsapp(value: FormDataEntryValue | null) {
  let digits = String(value ?? "").replace(/[\s-]/g, "").replace(/\D/g, "");

  if (!digits) return null;
  if (digits.startsWith("595")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return `595${digits}`;
}

function getOptionalUrl(value: FormDataEntryValue | null, errorPath: string) {
  const text = nullable(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall through to the shared redirect below.
  }

  redirect(`${errorPath}?error=${encodeURIComponent("El enlace del album externo debe ser una URL valida.")}`);
}

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeEventSlug(value: string) {
  return slugify(value).slice(0, 70);
}

async function validateUniqueSlug(value: string, currentEventId?: string) {
  const slug = normalizeEventSlug(value);

  if (!slug) {
    return "El enlace corto debe incluir letras, numeros o guiones.";
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return "El enlace corto solo puede usar minusculas, numeros y guiones.";
  }

  const query = createAdminClient().from("events").select("id").eq("slug", slug).limit(1);
  const { data, error } = currentEventId
    ? await query.neq("id", currentEventId)
    : await query;

  if (error) {
    return `No se pudo validar el enlace corto. Detalle: ${error.message}`;
  }

  return data && data.length > 0 ? "Ese enlace corto ya existe. Usa otro slug." : "";
}

/** Returns null for empty strings and values that aren't valid UUIDs. */
function nullableUuid(value: FormDataEntryValue | null): string | null {
  const str = nullable(value);
  if (!str) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ? str : null;
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function getEventStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "borrador");
  return EVENT_STATUSES.includes(status as (typeof EVENT_STATUSES)[number]) ? status : "borrador";
}

function getGuestMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? "publico");
  return GUEST_MODES.includes(mode as (typeof GUEST_MODES)[number]) ? mode : "publico";
}

function getDesignConfigFromForm(formData: FormData) {
  return normalizeInvitationDesignConfig({
    designConfig: {
      fontPreset: String(formData.get("design_font_preset") ?? ""),
      backgroundVariant: String(formData.get("design_background_variant") ?? ""),
      animationPreset: String(formData.get("design_animation_preset") ?? ""),
      decorationLevel: String(formData.get("design_decoration_level") ?? ""),
      decorationPreset: String(formData.get("design_decoration_preset") ?? "")
    } as Partial<InvitationDesignConfig>
  });
}

async function ensurePartialEventEditPermission(scope: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Tu sesion expiro. Inicia sesion nuevamente." };
  }

  const profile = await getCurrentProfile();
  if (!canEditEventDesign(profile)) {
    return { ok: false as const, error: `Tu rol no tiene permisos para editar ${scope}.` };
  }

  return { ok: true as const, supabase };
}

function normalizeUuid(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null;
}

function normalizeOptionalText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

const VISUAL_DECORATION_SECTIONS = ["hero", "info", "rsvp", "gallery", "footer"] as const;
const VISUAL_DECORATION_EFFECTS = ["none", "glow", "soft_shadow", "float", "pulse"] as const;
const VISUAL_DECORATION_GLOW_STRENGTHS = ["low", "medium", "high"] as const;

function getVisualDecorationsFromForm(formData: FormData): VisualDecoration[] {
  const raw = String(formData.get("visual_decorations") ?? "[]");

  try {
    const parsed = JSON.parse(raw);
    return sanitizeVisualDecorations(parsed);
  } catch {
    return [];
  }
}

function sanitizeVisualDecorations(value: unknown): VisualDecoration[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const section = normalizeVisualDecorationSection(record.section);
      const url = typeof record.url === "string" ? record.url.trim() : "";

      return {
        id: normalizeText(record.id, `decor-${index + 1}`),
        url,
        section,
        x: clampNumber(record.x, 0, 100, 6),
        y: clampNumber(record.y, 0, 100, 12),
        width: clampNumber(record.width, 40, 2000, 220),
        opacity: clampNumber(record.opacity, 0, 1, 0.85),
        rotate: clampNumber(record.rotate, -180, 180, 0),
        device: normalizeVisualDecorationDevice(record.device, record.desktop, record.mobile),
        effect: normalizeVisualDecorationEffect(record.effect),
        glowColor: normalizeHexColor(record.glowColor, "#f4d27a"),
        glowStrength: normalizeVisualDecorationGlowStrength(record.glowStrength),
        fitMode: record.fitMode === "section" ? "section" : "manual"
      } as VisualDecoration;
    })
    .filter((item) => item.url);
}

function getVisualDecorationUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = (item as { url?: unknown }).url;
    return typeof url === "string" && url.trim() ? [url.trim()] : [];
  });
}

function normalizeVisualDecorationSection(value: unknown): VisualDecorationSection {
  return VISUAL_DECORATION_SECTIONS.includes(value as VisualDecorationSection)
    ? value as VisualDecorationSection
    : "info";
}

function normalizeVisualDecorationDevice(device: unknown, desktop: unknown, mobile: unknown): VisualDecorationDevice {
  if (device === "mobile" || device === "desktop") return device;
  if (mobile === true && desktop !== true) return "mobile";
  return "desktop";
}

function normalizeVisualDecorationEffect(value: unknown): VisualDecorationEffect {
  if (value === "golden_glow") return "glow";
  return VISUAL_DECORATION_EFFECTS.includes(value as VisualDecorationEffect)
    ? value as VisualDecorationEffect
    : "none";
}

function normalizeVisualDecorationGlowStrength(value: unknown): VisualDecorationGlowStrength {
  return VISUAL_DECORATION_GLOW_STRENGTHS.includes(value as VisualDecorationGlowStrength)
    ? value as VisualDecorationGlowStrength
    : "medium";
}

function normalizeHexColor(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

async function getMusicUrlFromForm(formData: FormData, supabase: ServerSupabaseClient, userId: string) {
  const manualUrl = nullable(formData.get("music_url"));
  const file = formData.get("music_file");

  if (!(file instanceof File) || file.size === 0) {
    return manualUrl;
  }

  validateAudioFile(file);

  const extension = getFileExtension(file.name);
  const path = `${userId}/${crypto.randomUUID()}${extension}`;
  const { error } = await supabase.storage.from("event-audio").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || getAudioContentType(extension),
    upsert: false
  });

  if (error) {
    throw new Error(`No se pudo subir la música a Supabase Storage. Detalle: ${error.message}`);
  }

  const { data } = supabase.storage.from("event-audio").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadCoverImage(file: File, supabase: ServerSupabaseClient, eventId: string, variant = "desktop") {
  const extension = getFileExtension(file.name);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `covers/${eventId}/${variant}/${crypto.randomUUID()}-${safeName || `cover${extension}`}`;
  const { error } = await supabase.storage.from("event-photos").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || getCoverContentType(extension),
    upsert: false
  });

  if (error) {
    throw new Error(`No se pudo subir la foto de portada a Supabase Storage. Detalle: ${error.message}`);
  }

  const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
  return data.publicUrl;
}

function validateCoverImageFile(file: File) {
  const extension = getFileExtension(file.name);
  const hasValidExtension = ALLOWED_COVER_EXTENSIONS.includes(extension);
  const hasValidType = !file.type || ALLOWED_COVER_TYPES.includes(file.type);

  if (file.size > MAX_COVER_FILE_SIZE) {
    throw new Error("La foto de portada no debe superar 5MB.");
  }

  if (!hasValidExtension || !hasValidType) {
    throw new Error("La foto de portada debe ser una imagen válida .jpg, .jpeg, .png o .webp.");
  }
}

function validateAudioFile(file: File) {
  const extension = getFileExtension(file.name);
  const hasValidExtension = ALLOWED_AUDIO_EXTENSIONS.includes(extension);
  const hasValidType = !file.type || ALLOWED_AUDIO_TYPES.includes(file.type);

  if (file.size > MAX_AUDIO_FILE_SIZE) {
    throw new Error("El archivo de música no debe superar 10MB.");
  }

  if (!hasValidExtension || !hasValidType) {
    throw new Error("El archivo de música debe ser un audio válido .mp3, .wav u .ogg.");
  }
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function getAudioContentType(extension: string) {
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  return "audio/ogg";
}

function getCoverContentType(extension: string) {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  return "image/webp";
}

async function deleteEventStorageFiles({
  coverImageUrl,
  mobileCoverImageUrl,
  musicUrl,
  decorationUrls,
  photoPaths
}: {
  coverImageUrl: string | null;
  mobileCoverImageUrl: string | null;
  musicUrl: string | null;
  decorationUrls: Array<string | null>;
  photoPaths: string[];
}) {
  const admin = createAdminClient();
  const warnings: string[] = [];
  const eventPhotoPaths = Array.from(
    new Set(
      [
        ...photoPaths,
        getStoragePathFromPublicUrl(coverImageUrl, "event-photos"),
        getStoragePathFromPublicUrl(mobileCoverImageUrl, "event-photos"),
        ...decorationUrls.map((url) => getStoragePathFromPublicUrl(url, "event-photos"))
      ].filter(Boolean) as string[]
    )
  );
  const eventAudioPath = getStoragePathFromPublicUrl(musicUrl, "event-audio");

  if (eventPhotoPaths.length > 0) {
    const { error } = await admin.storage.from("event-photos").remove(eventPhotoPaths);
    if (error) {
      console.error("[KAIS DELETE EVENT] No se pudieron borrar archivos de event-photos", error.message);
      warnings.push(error.message);
    }
  }

  if (eventAudioPath) {
    const { error } = await admin.storage.from("event-audio").remove([eventAudioPath]);
    if (error) {
      console.error("[KAIS DELETE EVENT] No se pudo borrar audio de event-audio", error.message);
      warnings.push(error.message);
    }
  }

  return warnings;
}

function getStoragePathFromPublicUrl(url: string | null, bucket: "event-photos" | "event-audio") {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const path = url.slice(markerIndex + marker.length).split("?")[0];

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}


function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
