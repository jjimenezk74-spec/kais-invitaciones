import { headers } from "next/headers";
import { submitRsvp, trackVisit } from "@/app/actions/events";
import { resolvePremiumThemeDesign, resolveLegacyDesign } from "@/lib/invitation-design";
import { CanvasMobileRenderer } from "@/components/public-invitation/canvas-mobile-renderer";
import { PublicInvitation } from "@/components/public-invitation/public-invitation";
import { hasRenderableMobileCanvasDesign, normalizeCanvasDesign } from "@/lib/canvas/normalize-canvas-design";
import { CanvasV3PublicRenderer } from "@/app/dashboard/eventos/[id]/canvas-v3/canvas-v3-public-renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchThemeById } from "@/lib/invitation-themes.server";
import { eventHasFeature } from "@/lib/event-features";
import { createClient } from "@/lib/supabase/server";
import { isKaisAdmin } from "@/lib/profiles";
import type { CanvasDesign, Event, EventDecorations, EventGuest, InvitationTemplate, Rsvp, VisualDecoration } from "@/lib/types";
import {
  NotPublishedScreen,
  PersonalLinkRequired,
  InvalidPersonalLink,
  InactivePersonalLink
} from "./_screens";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    rsvp?: string | string[];
    rsvp_error?: string | string[];
    foto?: string | string[];
    foto_error?: string | string[];
    guest?: string | string[];
    rsvp_attending?: string | string[];
    wa?: string | string[];
    wa_message?: string | string[];
    from?: string | string[];
    preview?: string | string[];
  }>;
};

type PublicEventRow = Event & {
  theme_slug?: string | null;
  invitation_theme?: { slug?: string | null; name?: string | null } | null;
  invitation_themes?: { slug?: string | null; name?: string | null } | null;
  selected_theme?: { slug?: string | null; name?: string | null } | null;
};

const PUBLIC_EVENT_SELECT = [
  "id",
  "owner_id",
  "client_id",
  "package_key",
  "enabled_features",
  "disabled_features",
  "template_id",
  "category_id",
  "theme_id",
  "title",
  "event_type",
  "hosts_names",
  "event_date",
  "event_time",
  "address",
  "google_maps_link",
  "whatsapp_phone",
  "external_photo_album_url",
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
  "cover_image_url",
  "mobile_cover_image_url",
  "music_url",
  "decoration_top_left",
  "decoration_top_right",
  "decoration_bottom_left",
  "decoration_bottom_right",
  "decoration_side_left",
  "decoration_side_right",
  "visual_decorations",
  "design_config",
  "canvas_design",
  "theme_color",
  "status",
  "guest_mode",
  "slug",
  "created_at",
  "updated_at"
].join(",");

export default async function PublicEventPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(PUBLIC_EVENT_SELECT).eq("slug", slug).maybeSingle();
  const eventRow = data as PublicEventRow | null;
  const event = eventRow as Event | null;

  if (!event) return <NotPublishedScreen />;

  // --- Admin preview: verify BEFORE any access restrictions ---
  // Must run first so isAdminPreview can suppress all blocks below.
  const isPreviewMode = normalizeSearchParam(query.preview) === "admin";
  let isAdminPreview = false;

  if (isPreviewMode) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profileData } = await createAdminClient()
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (isKaisAdmin((profileData as { role?: string } | null)?.role)) {
        isAdminPreview = true;
      }
    }
  }

  // Status gate - skip for verified admin preview
  if (event.status !== "publicado" && !isAdminPreview) {
    return <NotPublishedScreen />;
  }

  // Guest token / lista_invitados gate - skip entirely for admin preview
  const guestToken = normalizeSearchParam(query.guest);
  let invitedGuest: EventGuest | null = null;
  let invitedGuestRsvp: Rsvp | null = null;

  if (event.guest_mode === "lista_invitados" && !isAdminPreview) {
    console.info("[KAIS GUEST LINK]", { slug, guestToken, eventId: event.id, guestMode: event.guest_mode });

    if (!guestToken) {
      console.warn("[KAIS GUEST LINK] Invitacion sin token personal", { slug, eventId: event.id });
      return <PersonalLinkRequired />;
    }

    const admin = createAdminClient();
    const { data: guestData, error: guestError } = await admin
      .from("event_guests")
      .select("id,event_id,guest_name,phone,email,token,max_companions,status,rsvp_id,last_opened_at,created_at")
      .eq("token", guestToken)
      .eq("event_id", event.id)
      .maybeSingle();

    console.info("[KAIS GUEST LINK] Resultado busqueda invitado", {
      slug,
      guestToken,
      eventId: event.id,
      found: Boolean(guestData),
      error: guestError?.message ?? null
    });

    invitedGuest = (guestData ?? null) as EventGuest | null;
    if (!invitedGuest) return <InvalidPersonalLink />;
    if (invitedGuest.status === "bloqueado") return <InactivePersonalLink />;

    await admin
      .from("event_guests")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", invitedGuest.id);

    if (invitedGuest.rsvp_id) {
      const { data: rsvpData } = await admin
        .from("rsvps")
        .select("id,event_id,guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
        .eq("id", invitedGuest.rsvp_id)
        .maybeSingle();
      invitedGuestRsvp = (rsvpData ?? null) as Rsvp | null;
    }
  }

  // Skip analytics for admin previews (avoid polluting visit counts)
  if (!isAdminPreview) {
    const headerStore = await headers();
    await trackVisit(event.id, headerStore.get("user-agent"));
  }

  const rsvpAction = submitRsvp.bind(null, event.id);
  const calendarUrl = buildCalendarUrl(event);
  const [template, invitationTheme] = await Promise.all([
    event.template_id ? getInvitationTemplate(event.template_id) : Promise.resolve(null),
    event.theme_id    ? fetchThemeById(event.theme_id)           : Promise.resolve(null)
  ]);

  const rsvpStatus = normalizeSearchParam(query.rsvp);
  const rsvpError = normalizeSearchParam(query.rsvp_error);
  const rsvpAttending = normalizeSearchParam(query.rsvp_attending);
  const shouldRedirectWhatsApp = normalizeSearchParam(query.wa) === "1";
  const whatsappMessage = normalizeSearchParam(query.wa_message);
  const isConfirmed = Boolean(invitedGuestRsvp) || rsvpStatus === "ok";
  const confirmedAttending = invitedGuestRsvp
    ? invitedGuestRsvp.attending
    : rsvpStatus === "ok"
      ? rsvpAttending !== "no"
      : null;

  const design = invitationTheme
    ? resolvePremiumThemeDesign(invitationTheme, null, event.design_config)
    : resolveLegacyDesign(template?.config, event.theme_color, event.design_config, template?.slug);

  const showRoyalPack =
    invitationTheme?.slug === "royal-wedding" ||
    design.designConfig.decorationPreset === "luxury-gold";
  const shouldUseWhatsAppRsvp =
    eventHasFeature(event, "external_rsvp_whatsapp") &&
    Boolean(event.whatsapp_phone);
  const resolvedThemeSlug =
    invitationTheme?.slug ??
    eventRow?.theme_slug ??
    eventRow?.invitation_themes?.slug ??
    eventRow?.invitation_theme?.slug ??
    eventRow?.selected_theme?.slug ??
    eventRow?.invitation_themes?.name ??
    eventRow?.invitation_theme?.name ??
    eventRow?.selected_theme?.name ??
    null;
  const slotDecorations: EventDecorations = {
    top_left: event.decoration_top_left,
    top_right: event.decoration_top_right,
    bottom_left: event.decoration_bottom_left,
    bottom_right: event.decoration_bottom_right,
    side_left: event.decoration_side_left,
    side_right: event.decoration_side_right
  };
  const freeDecorations = normalizeVisualDecorations(event.visual_decorations);
  const hasAnyDecoration = Boolean(
    event.decoration_top_left ||
    event.decoration_top_right ||
    event.decoration_bottom_left ||
    event.decoration_bottom_right ||
    event.decoration_side_left ||
    event.decoration_side_right ||
    freeDecorations.length > 0
  );
  const decorationThemeSlug = resolvedThemeSlug ?? (hasAnyDecoration ? "luxury-night" : null);
  const decorationDebug = {
    top_left: Boolean(event.decoration_top_left),
    top_right: Boolean(event.decoration_top_right),
    bottom_left: Boolean(event.decoration_bottom_left),
    bottom_right: Boolean(event.decoration_bottom_right),
    side_left: Boolean(event.decoration_side_left),
    side_right: Boolean(event.decoration_side_right)
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[PUBLIC EVENT DECORATIONS]", {
      themeSlug: eventRow?.theme_slug ?? decorationThemeSlug,
      theme_id: event.theme_id,
      decoration_top_left: event.decoration_top_left,
      decoration_top_right: event.decoration_top_right,
      decoration_bottom_left: event.decoration_bottom_left,
      decoration_bottom_right: event.decoration_bottom_right,
      decoration_side_left: event.decoration_side_left,
      decoration_side_right: event.decoration_side_right,
      visual_decorations: freeDecorations.length
    });
    console.info("[KAIS DECORATIONS SERVER]", {
      slug,
      eventId: event.id,
      themeSlug: decorationThemeSlug,
      decorations: decorationDebug
    });
  }

  const canvasDesign = event.canvas_design as unknown;
  const hasCanvasV3Design = isCanvasV3Design(canvasDesign);
  const hasMobileCanvas = !hasCanvasV3Design && hasRenderableMobileCanvasDesign(canvasDesign);

  const publicInvitation = (
    <PublicInvitation
      mode="public"
      event={event}
      design={design}
      invitationThemeSlug={invitationTheme?.slug ?? null}
      isAdminPreview={isAdminPreview}
      from={normalizeSearchParam(query.from)}
      invitedGuest={invitedGuest}
      invitedGuestRsvp={invitedGuestRsvp}
      guestToken={guestToken}
      rsvpAction={rsvpAction}
      rsvpError={rsvpError}
      rsvpStatus={rsvpStatus}
      rsvpAttending={rsvpAttending}
      shouldRedirectWhatsApp={shouldRedirectWhatsApp}
      whatsappMessage={whatsappMessage}
      shouldUseWhatsAppRsvp={shouldUseWhatsAppRsvp}
      calendarUrl={calendarUrl}
      decorationThemeSlug={decorationThemeSlug}
      slotDecorations={slotDecorations}
      freeDecorations={freeDecorations}
      showRoyalPack={showRoyalPack}
      canvasDesign={canvasDesign as CanvasDesign | null}
    />
  );

  if (hasCanvasV3Design) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#fff8f0 0%,#f7eadc 55%,#f1dccd 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
          overflowX: "hidden",
        }}
      >
        <div style={{ width: "100%", maxWidth: "100vw", padding: 0, overflowX: "hidden" }}>
          <CanvasV3PublicRenderer
            design={canvasDesign}
            eventTitle={event.hosts_names || event.title || "Evento"}
            eventSlug={event.slug ?? slug}
            eventDate={event.event_date && event.event_time ? `${event.event_date}T${event.event_time}` : undefined}
            mode="public"
          />
        </div>
      </div>
    );
  }

  if (hasMobileCanvas && canvasDesign) {
    return (
      <>
        <div className="md:hidden">
          <CanvasMobileRenderer
            event={event}
            canvasDesign={normalizeCanvasDesign(canvasDesign)}
            mode="public"
          />
        </div>
        <div className="hidden md:block">
          {publicInvitation}
        </div>
      </>
    );
  }

  return publicInvitation;
}

function isCanvasV3Design(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const design = value as Record<string, unknown>;
  return design.version === 3 && Array.isArray(design.sections) && Array.isArray(design.elements);
}

function normalizeVisualDecorations(value: unknown): VisualDecoration[] {
  if (Array.isArray(value)) return value.filter((decoration) => Boolean(decoration?.url)) as VisualDecoration[];
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((decoration) => Boolean(decoration?.url)) as VisualDecoration[] : [];
  } catch {
    return [];
  }
}

function buildCalendarUrl(event: Event) {
  const start = `${event.event_date.replaceAll("-", "")}T${event.event_time.replace(":", "")}00`;
  const end = `${event.event_date.replaceAll("-", "")}T235900`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.main_message ?? "",
    location: event.address
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

function normalizeSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").trim();
}
