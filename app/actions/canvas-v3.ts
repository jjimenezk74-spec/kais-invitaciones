"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getD1EventByIdOrSlug, updateD1CanvasDesign } from "@/lib/cloudflare/public-events";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInitialCanvasV3Design, type CanvasV3EventData } from "@/lib/canvas-v3/initial-design";

const CANVAS_V3_EVENT_SELECT = [
  "id",
  "slug",
  "event_type",
  "hosts_names",
  "title",
  "canvas_design",
  "event_date",
  "event_time",
  "address",
  "google_maps_link",
  "main_message",
  "quinceanera_name",
  "parents_names",
  "church_name",
  "church_time",
  "dress_code",
  "color_palette",
  "theme",
  "quince_message",
  "parents_message",
  "package_key",
  "whatsapp_phone",
].join(", ");

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function regenerateCanvasDesignV3(eventId: string) {
  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para editar el diseno del evento.");
  }

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(eventId)) {
      redirect("/dashboard?error=Evento invalido.");
    }

    const event = await getD1EventByIdOrSlug(eventId);
    if (!event) {
      redirect(`/dashboard/eventos/${eventId}?tab=diseno-v3&error=No se pudo cargar el evento.`);
    }

    const design = createInitialCanvasV3Design(event as CanvasV3EventData);
    try {
      await updateD1CanvasDesign(event.id, design);
    } catch {
      redirect(`/dashboard/eventos/${eventId}?tab=diseno-v3&error=No se pudo regenerar el diseno V3.`);
    }

    revalidatePath(`/dashboard/eventos/${event.id}`);
    revalidatePath(`/dashboard/eventos/${event.id}/canvas-v3`);
    revalidatePath(`/evento/${event.slug}/preview-v3`);

    redirect(`/dashboard/eventos/${event.id}/canvas-v3`);
  }

  if (!isUuid(eventId)) {
    redirect("/dashboard?error=Evento invalido.");
  }

  const admin = createAdminClient();
  const { data, error: readError } = await admin
    .from("events")
    .select(CANVAS_V3_EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();

  if (readError || !data) {
    redirect(`/dashboard/eventos/${eventId}?tab=diseno-v3&error=No se pudo cargar el evento.`);
  }

  const event = data as unknown as CanvasV3EventData;
  const design = createInitialCanvasV3Design(event);
  const { error: updateError } = await admin
    .from("events")
    .update({
      canvas_design: design,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (updateError) {
    redirect(`/dashboard/eventos/${eventId}?tab=diseno-v3&error=No se pudo regenerar el diseno V3.`);
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  revalidatePath(`/dashboard/eventos/${eventId}/canvas-v3`);
  revalidatePath(`/evento/${event.slug}/preview-v3`);

  redirect(`/dashboard/eventos/${eventId}/canvas-v3`);
}
