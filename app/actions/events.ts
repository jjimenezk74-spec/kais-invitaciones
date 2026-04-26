"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/profiles";
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
    owner_id: profile?.role === "admin" ? ownerId : user.id,
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

export async function submitRsvp(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const payload = {
    event_id: eventId,
    guest_name: String(formData.get("guest_name") ?? ""),
    phone: nullable(formData.get("phone")),
    email: nullable(formData.get("email")),
    attending: String(formData.get("attending")) === "si",
    companions: Number(formData.get("companions") || 0),
    message: nullable(formData.get("message")),
    dietary_restrictions: nullable(formData.get("dietary_restrictions"))
  };

  const { error } = await supabase.from("rsvps").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/evento/${formData.get("slug")}`);
  redirect(`/evento/${formData.get("slug")}?rsvp=ok`);
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
    is_approved: false
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/evento/${slug}`);
  redirect(`/evento/${slug}?foto=ok`);
}

export async function approvePhoto(photoId: string, eventId: string, approved: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("event_photos").update({ is_approved: approved }).eq("id", photoId);
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
  const { error } = await supabase.storage.from("event-covers").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || getCoverContentType(extension),
    upsert: false
  });

  if (error) {
    throw new Error(`No se pudo subir la foto de portada a Supabase Storage. Detalle: ${error.message}`);
  }

  const { data } = supabase.storage.from("event-covers").getPublicUrl(path);
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
