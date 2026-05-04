"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManagePhotos } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUploadEventPhotos } from "@/lib/event-time";
import type { LivePhoto } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireModerator() {
  const { profile } = await getCurrentUserProfile();
  if (!canManagePhotos(profile)) redirect("/dashboard");
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

  const { data: photo, error: photoError } = await admin
    .from("live_photos")
    .select("id,event_id,storage_path")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (photoError || !photo) {
    console.error("[deleteLivePhoto] lookup error:", photoError);
    return { error: "No se pudo encontrar la foto para eliminar." };
  }

  if (photo?.storage_path) {
    const { error: storageError } = await admin.storage.from("live-photos").remove([photo.storage_path]);
    if (storageError) {
      console.error("[deleteLivePhoto] storage remove error:", storageError);
      return { error: "No se pudo eliminar la foto completamente." };
    }
  }

  const [commentsResult, reactionsResult] = await Promise.all([
    admin.from("live_photo_comments").delete().eq("event_id", eventId).eq("photo_id", photoId),
    admin.from("live_photo_reactions").delete().eq("event_id", eventId).eq("photo_id", photoId),
  ]);

  if (commentsResult.error || reactionsResult.error) {
    console.error("[deleteLivePhoto] interactions delete error:", {
      comments: commentsResult.error,
      reactions: reactionsResult.error,
    });
    return { error: "No se pudo eliminar la foto completamente." };
  }

  const { error: deleteError } = await admin
    .from("live_photos")
    .delete()
    .eq("id", photoId)
    .eq("event_id", eventId);

  if (deleteError) {
    console.error("[deleteLivePhoto] db delete error:", deleteError);
    return { error: "No se pudo eliminar la foto completamente." };
  }

  revalidatePath(`/dashboard/eventos/${eventId}/fotos`);
  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { error: null };
}

export async function deleteAllLivePhotos(eventId: string) {
  await requireModerator();
  const admin = createAdminClient();

  const { data: photos, error: photosError } = await admin
    .from("live_photos")
    .select("id,storage_path")
    .eq("event_id", eventId);

  if (photosError) {
    console.error("[deleteAllLivePhotos] lookup error:", photosError);
    return { error: "No se pudieron consultar las fotos del evento." };
  }

  const storagePaths = (photos ?? [])
    .map((photo) => photo.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    const { error: storageError } = await admin.storage.from("live-photos").remove(storagePaths);
    if (storageError) {
      console.error("[deleteAllLivePhotos] storage remove error:", storageError);
      return { error: "No se pudo eliminar la foto completamente." };
    }
  }

  const [commentsResult, reactionsResult] = await Promise.all([
    admin.from("live_photo_comments").delete().eq("event_id", eventId),
    admin.from("live_photo_reactions").delete().eq("event_id", eventId),
  ]);

  if (commentsResult.error || reactionsResult.error) {
    console.error("[deleteAllLivePhotos] interactions delete error:", {
      comments: commentsResult.error,
      reactions: reactionsResult.error,
    });
    return { error: "No se pudieron eliminar las interacciones del álbum." };
  }

  const { error: deleteError } = await admin.from("live_photos").delete().eq("event_id", eventId);
  if (deleteError) {
    console.error("[deleteAllLivePhotos] db delete error:", deleteError);
    return { error: "No se pudieron eliminar los registros del álbum." };
  }

  revalidatePath(`/dashboard/eventos/${eventId}/fotos`);
  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { error: null };
}

export async function createLiveAlbumDownloadLinks(eventId: string) {
  await requireModerator();
  const admin = createAdminClient();

  const { data: photos, error } = await admin
    .from("live_photos")
    .select("id,guest_name,storage_path,created_at")
    .eq("event_id", eventId)
    .eq("approved", true)
    .eq("rejected", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[createLiveAlbumDownloadLinks] photos lookup error:", error);
    return { error: "No se pudo preparar la descarga del álbum.", links: [] };
  }

  const links = [];
  for (const [index, photo] of (photos ?? []).entries()) {
    if (!photo.storage_path) continue;
    const extension = photo.storage_path.split(".").pop() ?? "jpg";
    const guestName = (photo.guest_name ?? "foto").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `${String(index + 1).padStart(3, "0")}-${guestName || "foto"}.${extension}`;
    const { data, error: signedError } = await admin.storage
      .from("live-photos")
      .createSignedUrl(photo.storage_path, 60 * 60, { download: filename });

    if (signedError || !data?.signedUrl) {
      console.error("[createLiveAlbumDownloadLinks] signed url error:", signedError);
      return { error: "No se pudo preparar la descarga del álbum.", links: [] };
    }

    links.push({ id: photo.id, filename, url: data.signedUrl });
  }

  return { error: null, links };
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
    .select("id, status, event_date, event_time")
    .eq("id", payload.event_id)
    .single();

  if (eventError) {
    console.error("[insertLivePhotoRecord] event lookup error:", eventError.message);
    return { error: "No se pudo verificar el evento: " + eventError.message };
  }
  if (!event)                        return { error: "Evento no encontrado." };
  if (event.status !== "publicado")  return { error: "El evento no está activo." };
  if (!canUploadEventPhotos(event))  return { error: "La subida de fotos estará disponible el día del evento." };

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
