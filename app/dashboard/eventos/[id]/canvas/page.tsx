import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorClient } from "./editor-client";
import type { CanvasDesign, Event } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const CANVAS_EVENT_SELECT = [
  "id", "owner_id", "client_id", "package_key", "enabled_features", "disabled_features",
  "template_id", "category_id", "theme_id", "slug", "title", "hosts_names", "event_type",
  "event_date", "event_time", "address", "google_maps_link",
  "cover_image_url", "mobile_cover_image_url", "music_url", "theme_color",
  "main_message", "quinceanera_name", "parents_names",
  "quince_message", "parents_message",
  "church_name", "church_time", "dress_code", "color_palette", "theme",
  "decoration_top_left", "decoration_top_right",
  "decoration_bottom_left", "decoration_bottom_right",
  "decoration_side_left", "decoration_side_right",
  "visual_decorations", "design_config", "canvas_design", "status", "guest_mode", "created_at", "updated_at",
].join(", ");

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("hosts_names").eq("id", id).single();
  return { title: data ? `Editor · ${data.hosts_names}` : "Editor canvas" };
}

export default async function CanvasEditorPage({ params }: Props) {
  const { id } = await params;

  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select(CANVAS_EVENT_SELECT)
    .eq("id", id)
    .single();

  if (!data) notFound();

  // Same cast pattern used by the public invitation page
  const event = data as unknown as Event;

  return (
    <CanvasEditorClient
      eventId={event.id}
      eventSlug={event.slug}
      eventTitle={event.hosts_names}
      event={event}
      initialDesign={(event.canvas_design as CanvasDesign | null) ?? null}
    />
  );
}
