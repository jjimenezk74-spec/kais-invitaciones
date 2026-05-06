import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorClient } from "./editor-client";
import type { CanvasDesign, Event, EventDecorations, VisualDecoration } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

// All fields needed to render every invitation section in the editor
const CANVAS_EVENT_SELECT = [
  "id", "slug", "title", "hosts_names", "event_type",
  "event_date", "event_time", "address", "google_maps_link",
  "cover_image_url", "mobile_cover_image_url", "music_url", "theme_color",
  "main_message", "quinceanera_name", "parents_names",
  "quince_message", "parents_message",
  "church_name", "church_time", "dress_code", "color_palette", "theme",
  "decoration_top_left", "decoration_top_right",
  "decoration_bottom_left", "decoration_bottom_right",
  "decoration_side_left", "decoration_side_right",
  "visual_decorations", "canvas_design",
].join(", ");

function normalizeVisualDecorations(value: unknown): VisualDecoration[] {
  if (Array.isArray(value)) return value.filter((d) => Boolean(d?.url)) as VisualDecoration[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((d) => Boolean(d?.url)) as VisualDecoration[] : [];
  } catch { return []; }
}

function buildCalendarUrl(event: Pick<Event, "event_date" | "event_time" | "title" | "main_message" | "address">) {
  const start = `${event.event_date.replaceAll("-", "")}T${event.event_time.replace(":", "")}00`;
  const end   = `${event.event_date.replaceAll("-", "")}T235900`;
  const params = new URLSearchParams({
    action:   "TEMPLATE",
    text:     event.title,
    dates:    `${start}/${end}`,
    details:  event.main_message ?? "",
    location: event.address ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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

  const slotDecorations: EventDecorations = {
    top_left:    event.decoration_top_left    ?? null,
    top_right:   event.decoration_top_right   ?? null,
    bottom_left: event.decoration_bottom_left ?? null,
    bottom_right:event.decoration_bottom_right?? null,
    side_left:   event.decoration_side_left   ?? null,
    side_right:  event.decoration_side_right  ?? null,
  };

  const freeDecorations = normalizeVisualDecorations(event.visual_decorations);

  const hasAnyDecoration =
    Object.values(slotDecorations).some(Boolean) || freeDecorations.length > 0;

  // Simplified theme resolution (no template/theme_id lookup needed for editor preview)
  const decorationThemeSlug: string | null = hasAnyDecoration ? "luxury-night" : null;

  const calendarUrl = buildCalendarUrl(event);

  return (
    <CanvasEditorClient
      eventId={event.id}
      eventSlug={event.slug}
      eventTitle={event.hosts_names}
      event={event}
      slotDecorations={slotDecorations}
      freeDecorations={freeDecorations}
      decorationThemeSlug={decorationThemeSlug}
      calendarUrl={calendarUrl}
      initialDesign={(event.canvas_design as CanvasDesign | null) ?? null}
    />
  );
}
