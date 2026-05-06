import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLegacyDesign, resolvePremiumThemeDesign } from "@/lib/invitation-design";
import { fetchThemeById } from "@/lib/invitation-themes.server";
import { CanvasEditorClient } from "./editor-client";
import type { CanvasDesign, Event, EventDecorations, InvitationTemplate, VisualDecoration } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

// All fields needed to render every invitation section in the editor
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

async function getInvitationTemplate(templateId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitation_templates")
    .select("id,name,slug,category,preview_image,config,active,created_at")
    .eq("id", templateId)
    .eq("active", true)
    .maybeSingle();
  return (data ?? null) as InvitationTemplate | null;
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

  const [template, invitationTheme] = await Promise.all([
    event.template_id ? getInvitationTemplate(event.template_id) : Promise.resolve(null),
    event.theme_id ? fetchThemeById(event.theme_id) : Promise.resolve(null)
  ]);

  const design = invitationTheme
    ? resolvePremiumThemeDesign(invitationTheme, null, event.design_config)
    : resolveLegacyDesign(template?.config, event.theme_color, event.design_config, template?.slug);

  const showRoyalPack =
    invitationTheme?.slug === "royal-wedding" ||
    design.designConfig.decorationPreset === "luxury-gold";
  const decorationThemeSlug: string | null = invitationTheme?.slug ?? (hasAnyDecoration ? "luxury-night" : null);

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
      invitationThemeSlug={invitationTheme?.slug ?? null}
      design={design}
      showRoyalPack={showRoyalPack}
      calendarUrl={calendarUrl}
      initialDesign={(event.canvas_design as CanvasDesign | null) ?? null}
    />
  );
}
