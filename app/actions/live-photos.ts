"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canModerateEvents, getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LivePhoto } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireModerator() {
  const { profile } = await getCurrentUserProfile();
  if (!canModerateEvents(profile?.role)) redirect("/dashboard");
  return profile;
}

// ─── Public reads (used by server pages — no auth required) ───────────────────

/** All photos for an event (admin view — all statuses). */
export async function getAllLivePhotos(eventId: string): Promise<LivePhoto[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("live_photos")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return (data ?? []) as LivePhoto[];
}

/** Approved, non-rejected photos (public live screen + album). */
export async function getApprovedLivePhotos(eventId: string): Promise<LivePhoto[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("live_photos")
    .select("*")
    .eq("event_id", eventId)
    .eq("approved", true)
    .eq("rejected", false)
    .order("created_at", { ascending: false });
  return (data ?? []) as LivePhoto[];
}

/** Approved photos as a lightweight JSON response (polled by the live slideshow). */
export async function getApprovedLivePhotosJson(eventId: string) {
  return getApprovedLivePhotos(eventId);
}

// ─── Admin mutations ──────────────────────────────────────────────────────────

export async function approveLivePhoto(photoId: string, eventId: string) {
  await requireModerator();
  const admin = createAdminClient();
  await admin
    .from("live_photos")
    .update({ approved: true, rejected: false })
    .eq("id", photoId);
  revalidatePath(`/dashboard/eventos`);
  revalidatePath(`/dashboard/eventos/${eventId}/fotos`);
}

export async function rejectLivePhoto(photoId: string, eventId: string) {
  await requireModerator();
  const admin = createAdminClient();
  await admin
    .from("live_photos")
    .update({ approved: false, rejected: true })
    .eq("id", photoId);
  revalidatePath(`/dashboard/eventos`);
  revalidatePath(`/dashboard/eventos/${eventId}/fotos`);
}

export async function featureLivePhoto(photoId: string, eventId: string, featured: boolean) {
  await requireModerator();
  const admin = createAdminClient();
  await admin
    .from("live_photos")
    .update({ featured })
    .eq("id", photoId);
  revalidatePath(`/dashboard/eventos/${eventId}/fotos`);
}

export async function deleteLivePhoto(photoId: string, eventId: string) {
  await requireModerator();
  const admin = createAdminClient();

  // Remove from storage first.
  const { data: photo } = await admin
    .from("live_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  if (photo?.storage_path) {
    await admin.storage.from("live-photos").remove([photo.storage_path]);
  }

  await admin.from("live_photos").delete().eq("id", photoId);
  revalidatePath(`/dashboard/eventos/${eventId}/fotos`);
}

// ─── Public insert (called from guest upload form via Server Action) ───────────
// Bypasses all RLS: uses service role key directly, never goes through auth helpers.

export async function insertLivePhotoRecord(payload: {
  event_id: string;
  image_url: string;
  storage_path: string;
  guest_name: string | null;
  guest_message: string | null;
}): Promise<{ error: string | null }> {
  // Build a raw service-role client — no cookie helpers, no anon key, no auth middleware.
  const { createClient: rawCreateClient } = await import("@supabase/supabase-js");

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[insertLivePhotoRecord] Missing env vars:", {
      hasUrl:            Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return { error: "Configuración de servidor incompleta." };
  }

  console.log("[insertLivePhotoRecord] using service role key:", serviceRoleKey.slice(0, 20) + "...");

  const serviceClient = rawCreateClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the event exists and is published.
  const { data: event, error: eventError } = await serviceClient
    .from("events")
    .select("id, status")
    .eq("id", payload.event_id)
    .single();

  if (eventError) {
    console.error("[insertLivePhotoRecord] event lookup error:", eventError.message);
    return { error: "No se pudo verificar el evento: " + eventError.message };
  }
  if (!event)                        return { error: "Evento no encontrado." };
  if (event.status !== "publicado")  return { error: "El evento no está activo." };

  const { error: insertError } = await serviceClient.from("live_photos").insert({
    event_id:      payload.event_id,
    image_url:     payload.image_url,
    storage_path:  payload.storage_path,
    guest_name:    payload.guest_name,
    guest_message: payload.guest_message,
    approved:  false,
    featured:  false,
    rejected:  false,
  });

  if (insertError) {
    console.error("[insertLivePhotoRecord] insert error:", insertError.message);
    return { error: insertError.message };
  }

  console.log("[insertLivePhotoRecord] insert OK for event:", payload.event_id);
  return { error: null };
}
