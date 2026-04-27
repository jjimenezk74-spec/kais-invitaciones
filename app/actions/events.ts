"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canCreateEvents, canModerateEvents, getCurrentUserProfile, isKaisAdmin } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

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

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!canCreateEvents(profile?.role)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para crear eventos.");
  }

  const ownerId = String(formData.get("owner_id") || user.id);
  const title = String(formData.get("title") ?? "Nuevo evento");
  const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
  let musicUrl: string | null;
  const manualCoverUrl = nullable(formData.get("cover_image_url"));
  const coverFile = getOptionalFile(formData.get("cover_image_file"));

  try {
    if (coverFile) validateCoverImageFile(coverFile);
    musicUrl = await getMusicUrlFromForm(formData, supabase, user.id);
  } catch (error) {
    redirect(`/dashboard/eventos/nuevo?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  const payload = {
    owner_id: isKaisAdmin(profile?.role) ? ownerId : user.id,
    title,
    event_type: String(formData.get("event_type") ?? "otro"),
    hosts_names: String(formData.get("hosts_names") ?? ""),
    event_date: String(formData.get("event_date") ?? ""),
    event_time: String(formData.get("event_time") ?? ""),
    address: String(formData.get("address") ?? ""),
    google_maps_link: nullable(formData.get("google_maps_link")),
    main_message: nullable(formData.get("main_message")),
    dress_code: nullable(formData.get("dress_code")),
    cover_image_url: manualCoverUrl,
    music_url: musicUrl,
    theme_color: String(formData.get("theme_color") || "#111827"),
    status: getEventStatus(formData.get("status")),
    slug
  };

  const { data, error } = await supabase.from("events").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  if (coverFile) {
    try {
      const coverImageUrl = await uploadCoverImage(coverFile, supabase, data.id);
      const { error: coverUpdateError } = await supabase
        .from("events")
        .update({ cover_image_url: coverImageUrl })
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

  let musicUrl: string | null;
  let coverImageUrl = nullable(formData.get("cover_image_url"));
  const coverFile = getOptionalFile(formData.get("cover_image_file"));

  try {
    if (coverFile) {
      validateCoverImageFile(coverFile);
      coverImageUrl = await uploadCoverImage(coverFile, supabase, eventId);
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
    main_message: nullable(formData.get("main_message")),
    dress_code: nullable(formData.get("dress_code")),
    cover_image_url: coverImageUrl,
    music_url: musicUrl,
    theme_color: String(formData.get("theme_color") || "#111827"),
    status: getEventStatus(formData.get("status"))
  };

  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/eventos/${eventId}`);
  redirect(`/dashboard/eventos/${eventId}?saved=updated`);
}

export async function deleteEvent(eventId: string) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?error=Inicia sesion para eliminar eventos.");
  }

  if (!isKaisAdmin(profile?.role)) {
    redirect("/dashboard?error=Solo administradores KAIS pueden eliminar eventos.");
  }

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id,title,cover_image_url,music_url")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(eventError?.message ?? "No se encontro el evento.")}`);
  }

  const { data: photosData } = await admin.from("event_photos").select("storage_path").eq("event_id", eventId);
  const storageWarnings = await deleteEventStorageFiles({
    coverImageUrl: event.cover_image_url,
    musicUrl: event.music_url,
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
  const errorUrl = (message: string) => `/evento/${slug}?rsvp_error=${encodeURIComponent(message)}#rsvp`;
  const successUrl = `/evento/${slug}?rsvp=ok#rsvp`;
  const guestName = String(formData.get("guest_name") ?? "").trim();
  const companions = Number(formData.get("companions") || 0);

  if (!slug) {
    redirect("/?error=No se pudo identificar la invitacion.");
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
    attending: String(formData.get("attending")) === "si",
    companions: Math.floor(companions),
    message: nullable(formData.get("message")),
    dietary_restrictions: nullable(formData.get("dietary_restrictions"))
  };

  const { error } = await supabase.from("rsvps").insert(payload);
  if (error) {
    console.error("[KAIS RSVP] No se pudo guardar RSVP", {
      eventId,
      slug,
      code: error.code,
      message: error.message
    });
    redirect(errorUrl("No pudimos guardar tu confirmacion. Intenta de nuevo o contacta a los anfitriones."));
  }

  revalidatePath(`/evento/${slug}`);
  redirect(successUrl);
}

export async function uploadEventPhoto(eventId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${eventId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("event-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (uploadError) throw new Error(uploadError.message);

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
  if (error) throw new Error(error.message);

  revalidatePath(`/evento/${slug}`);
  redirect(`/evento/${slug}?foto=ok`);
}

export async function approvePhoto(photoId: string, eventId: string, approved: boolean) {
  const { profile } = await getCurrentUserProfile();

  if (!canModerateEvents(profile?.role)) {
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
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rsvps")
    .select("guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const header = ["nombre", "telefono", "email", "asistira", "acompanantes", "mensaje", "restriccion_alimentaria", "fecha"];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.guest_name,
        row.phone,
        row.email,
        row.attending ? "si" : "no",
        row.companions,
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

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function getEventStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "borrador");
  return EVENT_STATUSES.includes(status as (typeof EVENT_STATUSES)[number]) ? status : "borrador";
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

async function uploadCoverImage(file: File, supabase: ServerSupabaseClient, eventId: string) {
  const extension = getFileExtension(file.name);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `covers/${eventId}/${crypto.randomUUID()}-${safeName || `cover${extension}`}`;
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
  musicUrl,
  photoPaths
}: {
  coverImageUrl: string | null;
  musicUrl: string | null;
  photoPaths: string[];
}) {
  const admin = createAdminClient();
  const warnings: string[] = [];
  const eventPhotoPaths = Array.from(
    new Set([...photoPaths, getStoragePathFromPublicUrl(coverImageUrl, "event-photos")].filter(Boolean) as string[])
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

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
