"use server";

import { createClient } from "@supabase/supabase-js";
import { canUploadEventPhotos } from "@/lib/event-time";

const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/**
 * insertLivePhoto
 * ───────────────
 * Server Action llamado desde el formulario público de invitados.
 * Usa service role key directamente — bypasses RLS por completo.
 * Import estático, sin wrappers, sin cookies, sin auth helpers.
 */
export async function insertLivePhoto(payload: {
  event_id: string;
  image_url: string;
  storage_path: string;
  guest_name: string | null;
  guest_message: string | null;
}): Promise<{ error: string | null }> {
  const url            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // ── Diagnóstico de env vars ─────────────────────────────────────────────
  console.log("SERVICE ROLE ACTIVE", serviceRoleKey?.slice(0, 15));
  console.log("[insertLivePhoto] url:", url?.slice(0, 30));
  console.log("[insertLivePhoto] event_id:", payload.event_id);

  if (!url || !serviceRoleKey) {
    console.error("[insertLivePhoto] MISSING ENV VARS", { url: Boolean(url), key: Boolean(serviceRoleKey) });
    return { error: "Configuración de servidor incompleta. Contacta al administrador." };
  }

  // ── Cliente con service role — sin helpers intermedios ──────────────────
  if (!isStoragePathForEvent(payload.storage_path, payload.event_id)) {
    return { error: "La foto no pertenece al evento indicado." };
  }

  if (!isAllowedImagePath(payload.storage_path)) {
    return { error: "Solo se permiten fotos JPG, PNG o WEBP." };
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });

  // ── Verificar evento ────────────────────────────────────────────────────
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status, event_date, event_time")
    .eq("id", payload.event_id)
    .single();

  if (eventError) {
    console.error("[insertLivePhoto] event lookup error:", eventError.message);
    return { error: "No se pudo verificar el evento: " + eventError.message };
  }
  if (!event)                       return { error: "Evento no encontrado." };
  if (event.status !== "publicado") return { error: "El evento no está activo." };
  if (!canUploadEventPhotos(event)) return { error: "La subida de fotos estará disponible el día del evento." };

  // ── Insert ──────────────────────────────────────────────────────────────
  const { error: insertError } = await supabase.from("live_photos").insert({
    event_id:      payload.event_id,
    image_url:     payload.image_url,
    storage_path:  payload.storage_path,
    guest_name:    payload.guest_name,
    guest_message: payload.guest_message,
    approved:      false,
    featured:      false,
    rejected:      false,
  });

  if (insertError) {
    console.error("[insertLivePhoto] insert error:", insertError.message, insertError.code);
    return { error: insertError.message };
  }

  console.log("[insertLivePhoto] INSERT OK for event:", payload.event_id);
  return { error: null };
}

function isStoragePathForEvent(storagePath: string, eventId: string) {
  return storagePath.startsWith(`${eventId}/`) && !storagePath.includes("..");
}

function isAllowedImagePath(storagePath: string) {
  const normalized = storagePath.toLowerCase().split("?")[0];
  return ALLOWED_IMAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}
