"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canCreateEvents, getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/lib/types";

export async function setEventStatus(eventId: string, newStatus: EventStatus) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");
  if (!canCreateEvents(profile?.role)) {
    redirect(
      `/dashboard/eventos/${eventId}?error=Sin permisos para cambiar el estado del evento.`
    );
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
