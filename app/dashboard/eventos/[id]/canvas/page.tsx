import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorClient } from "./editor-client";
import type { CanvasDesign } from "@/lib/types";
import type { EventHeroData } from "@/components/public-invitation/event-hero";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("hosts_names")
    .eq("id", id)
    .single();
  return { title: data ? `Editor · ${data.hosts_names}` : "Editor canvas" };
}

export default async function CanvasEditorPage({ params }: Props) {
  const { id } = await params;

  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, cover_image_url, mobile_cover_image_url, event_type, event_date, event_time, google_maps_link, theme_color, music_url, canvas_design")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const heroEvent: EventHeroData = {
    cover_image_url:        data.cover_image_url        ?? null,
    mobile_cover_image_url: data.mobile_cover_image_url ?? null,
    theme_color:            data.theme_color,
    hosts_names:            data.hosts_names,
    event_type:             data.event_type,
    event_date:             data.event_date,
    event_time:             data.event_time,
    google_maps_link:       data.google_maps_link        ?? null,
    music_url:              data.music_url               ?? null,
  };

  return (
    <CanvasEditorClient
      eventId={data.id}
      eventSlug={data.slug}
      eventTitle={data.hosts_names}
      coverImageUrl={data.cover_image_url ?? null}
      heroEvent={heroEvent}
      initialDesign={(data.canvas_design as CanvasDesign | null) ?? null}
    />
  );
}
