"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateD1EventStatus } from "@/lib/cloudflare/public-events";
import { canPublishEvents } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/lib/types";

export async function setEventStatus(eventId: string, newStatus: EventStatus) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");
  if (!canPublishEvents(profile)) {
    redirect(
      `/dashboard/eventos/${eventId}?error=Sin permisos para cambiar el estado del evento.`
    );
  }

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    try {
      await updateD1EventStatus(eventId, newStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
      redirect(`/dashboard/eventos/${eventId}?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/eventos/${eventId}`);
    redirect(`/dashboard/eventos/${eventId}?saved=status`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({ status: newStatus })
    .eq("id", eventId);
  if (error) {
    redirect(
      `/dashboard/eventos/${eventId}?error=${encodeURIComponent(error.message)}`
    );
  }
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/eventos/${eventId}`);
  redirect(`/dashboard/eventos/${eventId}?saved=status`);
}
