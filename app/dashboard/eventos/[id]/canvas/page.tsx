import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchThemeById } from "@/lib/invitation-themes.server";
import { resolvePremiumThemeDesign, resolveLegacyDesign } from "@/lib/invitation-design";
import { CanvasEditorClient } from "./editor-client";
import { InvitationEditorBase } from "./invitation-editor-base";
import type { CanvasDesign, Event, EventDecorations, VisualDecoration } from "@/lib/types";

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

const EDITOR_SELECT = [
  "id", "slug", "title", "hosts_names", "cover_image_url", "canvas_design",
  "theme_id", "design_config", "theme_color", "template_id",
  "event_type", "event_date", "event_time", "address",
  "google_maps_link", "music_url", "whatsapp_phone",
  "main_message", "quinceanera_name", "parents_names",
  "quince_message", "parents_message",
  "church_name", "church_time",
  "dress_code", "color_palette", "theme",
  "mobile_cover_image_url",
  // decoration fields — needed for WYSIWYG fidelity
  "decoration_top_left", "decoration_top_right",
  "decoration_bottom_left", "decoration_bottom_right",
  "decoration_side_left", "decoration_side_right",
  "visual_decorations",
].join(", ");

function normalizeVisualDecorations(value: unknown): VisualDecoration[] {
  if (Array.isArray(value)) return value.filter((d) => Boolean(d?.url)) as VisualDecoration[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((d) => Boolean(d?.url)) as VisualDecoration[] : [];
  } catch {
    return [];
  }
}

export default async function CanvasEditorPage({ params }: Props) {
  const { id } = await params;

  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select(EDITOR_SELECT)
    .eq("id", id)
    .single();

  if (!data) notFound();

  // Cast to Event — same pattern as the public page (eventRow as Event)
  const event = data as unknown as Event;

  // Resolve theme for CSS class names (same logic as public page)
  const invitationTheme = event.theme_id
    ? await fetchThemeById(event.theme_id)
    : null;

  const resolvedDesign = invitationTheme
    ? resolvePremiumThemeDesign(invitationTheme, null, event.design_config as never)
    : resolveLegacyDesign(null, event.theme_color, event.design_config as never, null);

  const themeClassName = [
    resolvedDesign.stageClassName,
    resolvedDesign.designClassName,
    invitationTheme?.slug ? `kais-theme-${invitationTheme.slug}` : "",
    invitationTheme ? "kais-theme-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const themeSlug = invitationTheme?.slug ?? null;

  // Build decoration props — same logic as public page
  const slotDecorations: EventDecorations = {
    top_left:     event.decoration_top_left    ?? null,
    top_right:    event.decoration_top_right   ?? null,
    bottom_left:  event.decoration_bottom_left ?? null,
    bottom_right: event.decoration_bottom_right ?? null,
    side_left:    event.decoration_side_left   ?? null,
    side_right:   event.decoration_side_right  ?? null,
  };
  const freeDecorations = normalizeVisualDecorations(event.visual_decorations);
  const decorationThemeSlug = themeSlug;
  const showRoyalPack =
    invitationTheme?.slug === "royal-wedding" ||
    resolvedDesign.designConfig.decorationPreset === "luxury-gold";

  return (
    <CanvasEditorClient
      eventId={event.id}
      eventSlug={event.slug}
      eventTitle={event.hosts_names}
      initialDesign={(event.canvas_design as CanvasDesign | null) ?? null}
      themeClassName={themeClassName}
    >
      <InvitationEditorBase
        event={event}
        themeSlug={themeSlug}
        decorationThemeSlug={decorationThemeSlug}
        slotDecorations={slotDecorations}
        freeDecorations={freeDecorations}
        showRoyalPack={showRoyalPack}
      />
    </CanvasEditorClient>
  );
}