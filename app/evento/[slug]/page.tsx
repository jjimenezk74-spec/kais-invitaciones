import { headers } from "next/headers";
import Link from "next/link";
import { CalendarPlus, MapPin, Send, Eye } from "lucide-react";
import { submitRsvp, trackVisit } from "@/app/actions/events";
import { Countdown } from "@/components/countdown";
import { BackButton } from "@/components/back-button";
import { EventHero } from "@/components/public-invitation/event-hero";
import { RsvpWhatsAppRedirect } from "@/components/rsvp-whatsapp-redirect";
import { ThemeDecorations } from "@/components/theme-decorations";
import { resolvePremiumThemeDesign, resolveLegacyDesign } from "@/lib/invitation-design";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchThemeById } from "@/lib/invitation-themes.server";
import { eventHasFeature } from "@/lib/event-features";
import { createClient } from "@/lib/supabase/server";
import { isKaisAdmin } from "@/lib/profiles";
import { formatDate } from "@/lib/utils";
import type { Event, EventDecorations, EventGuest, InvitationTemplate, InvitationTheme, Rsvp, VisualDecoration } from "@/lib/types";
import {
  NotPublishedScreen,
  PersonalLinkRequired,
  InvalidPersonalLink,
  InactivePersonalLink
} from "./_screens";
import { RoyalWeddingPack, RoyalWeddingDivider } from "@/components/decorations/royal-wedding-pack";

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

  return (
    <main
      className={[
        "w-full max-w-full overflow-x-hidden",
        design.stageClassName,
        design.designClassName,
        invitationTheme?.slug ? `kais-theme-${invitationTheme.slug}` : "",
        invitationTheme ? "kais-theme-active" : ""
      ].filter(Boolean).join(" ")}
      data-font-preset={design.designConfig.fontPreset}
      data-background-variant={design.designConfig.backgroundVariant}
      data-animation-preset={design.designConfig.animationPreset}
      data-decoration-level={design.designConfig.decorationLevel}
      style={invitationTheme
        ? undefined
        : { ["--template-primary" as string]: design.primary, ["--template-secondary" as string]: design.secondary }}
    >
      {/* Admin preview banner - fixed top, only visible to admin */}
      {isAdminPreview && (
        <div className="fixed inset-x-0 top-0 z-[100] flex max-w-full items-center justify-between gap-2 overflow-hidden border-b border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900 shadow-sm sm:gap-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <span className="truncate">Vista previa administrador</span>
            <span className="hidden font-normal text-amber-700 sm:inline">
              {event.status === "borrador" ? "- Evento en borrador, no visible al publico" : ""}
            </span>
          </div>
          <Link
            href={`/dashboard/eventos/${event.id}`}
            className="max-w-[46vw] shrink-0 truncate rounded-md border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 sm:max-w-none"
          >
            Volver al dashboard
          </Link>
        </div>
      )}

      {/* Royal Wedding Pack SVG overlay */}
      {showRoyalPack && <RoyalWeddingPack />}

      <div
        className={[
          "fixed left-3 z-50 sm:left-5",
          isAdminPreview
            ? "top-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem)]"
            : "top-[max(0.75rem,env(safe-area-inset-top))]"
        ].join(" ")}
      >
        <BackButton from={normalizeSearchParam(query.from)} />
      </div>

      <EventHero
        event={event}
        calendarUrl={calendarUrl}
        invitedGuestName={invitedGuest?.guest_name}
        themeSlug={decorationThemeSlug}
        decorations={slotDecorations}
        freeDecorations={freeDecorations}
        showMusic={eventHasFeature(event, "music")}
      />

      <section className="relative px-5 py-20 sm:py-24 lg:hidden" aria-label="Cuenta regresiva y mensaje">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
        <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#3a0a12]/35 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-12 h-48 w-48 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />

        <div className="relative mx-auto max-w-md text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="block h-px w-10 kais-hairline" />
            <p className="kais-eyebrow">{invitedGuest ? `Para ${invitedGuest.guest_name}` : "Faltan"}</p>
            <span className="block h-px w-10 kais-hairline" />
          </div>

          <div className="mt-10">
            <Countdown date={event.event_date} time={event.event_time} variant="luxe" />
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <a href={event.google_maps_link ?? "#detalles"} target="_blank" rel="noreferrer" className="kais-ghost-link">
              <MapPin className="h-3.5 w-3.5" />
              Como llegar
            </a>
            <a href={calendarUrl} target="_blank" rel="noreferrer" className="kais-ghost-link">
              <CalendarPlus className="h-3.5 w-3.5" />
              Calendario
            </a>
          </div>
        </div>
      </section>

      <section id="detalles" className="kais-section relative overflow-hidden">
        <ThemeDecorations
          themeSlug={decorationThemeSlug}
          section="info"
          decorations={slotDecorations}
          freeDecorations={freeDecorations}
        />
        <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#3a0a12]/35 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-16 h-72 w-72 rounded-full bg-[#d4af37]/[0.06] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="block h-px w-10 kais-hairline" />
            <p className="kais-eyebrow">Una noche . Inolvidable</p>
            <span className="block h-px w-10 kais-hairline" />
          </div>

          <h2
            className="mt-9 font-display font-light italic leading-[0.95]"
            style={{ fontSize: "clamp(2.6rem, 6.5vw, 5.5rem)" }}
          >
            <span className="kais-gold-text kais-shimmer">{event.title}</span>
          </h2>

          {event.main_message ? (
            <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">{event.main_message}</p>
          ) : null}

          {event.quinceanera_name ? (
            <div className="mx-auto mt-12 max-w-2xl">
              <p className="kais-eyebrow">Quinceanera</p>
              <h3 className="mt-3 font-display text-4xl font-light italic text-[#f5ecd9] md:text-5xl">
                {event.quinceanera_name}
              </h3>
            </div>
          ) : null}

          {event.parents_names ? (
            <div className="mx-auto mt-10 max-w-2xl">
              <p className="kais-eyebrow">Junto a mis padres</p>
              <p className="mt-3 font-display text-2xl italic text-[#f5ecd9]/88 md:text-3xl">{event.parents_names}</p>
            </div>
          ) : null}

          {(event.quince_message || event.parents_message) ? (
            <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
              {event.quince_message ? (
                <div className="kais-glass rounded-3xl p-6 text-left">
                  <p className="kais-eyebrow">Mensaje</p>
                  <p className="mt-4 text-sm leading-7 text-[#f5ecd9]/75">{event.quince_message}</p>
                </div>
              ) : null}
              {event.parents_message ? (
                <div className="kais-glass rounded-3xl p-6 text-left">
                  <p className="kais-eyebrow">Familia</p>
                  <p className="mt-4 text-sm leading-7 text-[#f5ecd9]/75">{event.parents_message}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0">
            {[
              ["Fecha", formatDate(event.event_date)],
              ["Hora", event.event_time],
              ["Lugar", event.address]
            ].map(([label, value], i) => (
              <div
                key={label}
                className={`relative px-2 py-2 ${
                  i > 0
                    ? "md:before:absolute md:before:inset-y-3 md:before:left-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#d4af37]/35 md:before:to-transparent"
                    : ""
                }`}
              >
                <p className="kais-eyebrow">{label}</p>
                <p className="mt-4 font-display text-2xl italic text-[#f5ecd9] md:text-3xl">{value}</p>
              </div>
            ))}
          </div>

          {event.church_name ? (
            <div className="mx-auto mt-16 max-w-2xl">
              <p className="kais-eyebrow">Ceremonia religiosa</p>
              <p className="mt-3 font-display text-2xl italic text-[#f5ecd9] md:text-3xl">{event.church_name}</p>
              {event.church_time ? (
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d4af37]/85">{event.church_time}</p>
              ) : null}
            </div>
          ) : null}

          {(event.dress_code || event.color_palette || event.theme) ? (
            <div className="mx-auto mt-16 grid max-w-3xl gap-5 md:grid-cols-3">
              {event.dress_code ? (
                <div>
                  <p className="kais-eyebrow">Tenida</p>
                  <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">{event.dress_code}</p>
                </div>
              ) : null}
              {event.color_palette ? (
                <div>
                  <p className="kais-eyebrow">Gama de colores</p>
                  <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">{event.color_palette}</p>
                </div>
              ) : null}
              {event.theme ? (
                <div>
                  <p className="kais-eyebrow">Tematica</p>
                  <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">{event.theme}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {showRoyalPack && <RoyalWeddingDivider />}

      <section id="rsvp" className="kais-section relative overflow-hidden bg-[#0a0405]">
        <ThemeDecorations
          themeSlug={decorationThemeSlug}
          section="rsvp"
          decorations={slotDecorations}
          freeDecorations={freeDecorations}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
        <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />

        <div className="relative z-10 mx-auto grid max-w-5xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
              <span className="block h-px w-10 kais-hairline" />
              <p className="kais-eyebrow">RSVP . Asistencia</p>
            </div>

            <h2
              className="mt-7 font-display font-light italic leading-[0.95]"
              style={{ fontSize: "clamp(2.4rem, 4.8vw, 4.4rem)" }}
            >
              Tu presencia
              <br />
              es el regalo
              <br />
              <span className="kais-gold-text kais-shimmer">mas bonito.</span>
            </h2>

            <p className="mt-7 max-w-md text-[0.95rem] leading-[1.9] text-[#f5ecd9]/65">
              {isAdminPreview
                ? "Vista previa - el formulario RSVP es solo lectura en modo administrador."
                : isConfirmed && confirmedAttending === false
                  ? "Tu respuesta quedó registrada."
                  : isConfirmed
                    ? "Tu confirmación quedó registrada."
                  : invitedGuest
                    ? `Hola ${invitedGuest.guest_name}, podes confirmar tu asistencia.`
                    : "Tu respuesta ayuda a los anfitriones a preparar cada detalle del evento."}
            </p>

            {isConfirmed && !isAdminPreview ? (
              <p className="mt-7 inline-flex"><span className="kais-status-success">Confirmacion recibida</span></p>
            ) : null}
            {rsvpError && !isAdminPreview ? (
              <p className="mt-7 inline-flex"><span className="kais-status-error">{rsvpError}</span></p>
            ) : null}
            {isAdminPreview && (
              <p className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/50 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300">
                <Eye className="h-3 w-3" />
                Solo lectura en vista previa
              </p>
            )}
          </div>

          <div className="kais-glass relative rounded-[2rem] p-6 sm:p-9 md:p-11">
            {isAdminPreview && (
              <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-xs font-semibold text-amber-300">
                Vista previa administrador - el envio de RSVP esta deshabilitado.
              </div>
            )}
            {eventHasFeature(event, "external_rsvp_whatsapp") && !event.whatsapp_phone ? (
              <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-xs font-semibold text-amber-300">
                Este evento usa RSVP por WhatsApp, pero todavia no tiene un numero configurado. La confirmacion se guardara en el sistema.
              </div>
            ) : null}
            <form action={rsvpAction} className="grid gap-5 md:gap-7">
              <input type="hidden" name="slug" value={event.slug} />
              <input type="hidden" name="guest_token" value={guestToken} />
              <input type="hidden" name="external_rsvp_whatsapp" value={shouldUseWhatsAppRsvp ? "1" : ""} />
              <input type="hidden" name="event_title" value={event.title} />

              {isConfirmed && !isAdminPreview ? (
                <div className="rounded-2xl border border-[#d4af37]/35 bg-[#d4af37]/10 p-4 text-[#f5ecd9]">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#d4af37]">Confirmacion recibida</p>
                  <p className="mt-2 text-sm leading-6 text-[#f5ecd9]/72">
                    {confirmedAttending === false
                      ? "Gracias por tu respuesta."
                      : "Gracias por confirmar tu presencia. Te esperamos con mucha alegría."}
                  </p>
                  {shouldRedirectWhatsApp && event.whatsapp_phone && whatsappMessage ? (
                    <RsvpWhatsAppRedirect phone={event.whatsapp_phone} message={whatsappMessage} />
                  ) : null}
                </div>
              ) : null}

              <LuxeField label="Nombre">
                <input
                  name="guest_name"
                  required
                  defaultValue={invitedGuest?.guest_name ?? ""}
                  readOnly={Boolean(invitedGuest) || isConfirmed || isAdminPreview}
                  disabled={isConfirmed || isAdminPreview}
                  className="kais-input-luxe"
                />
              </LuxeField>

              <div className="grid gap-5 md:grid-cols-2 md:gap-7">
                <LuxeField label="Telefono">
                  <input
                    name="phone"
                    defaultValue={invitedGuest?.phone ?? invitedGuestRsvp?.phone ?? ""}
                    disabled={isConfirmed || isAdminPreview}
                    className="kais-input-luxe"
                  />
                </LuxeField>
                <LuxeField label="Email">
                  <input
                    name="email"
                    type="email"
                    defaultValue={invitedGuest?.email ?? invitedGuestRsvp?.email ?? ""}
                    disabled={isConfirmed || isAdminPreview}
                    className="kais-input-luxe"
                  />
                </LuxeField>
              </div>

              <div className="grid gap-5 md:grid-cols-2 md:gap-7">
                <LuxeField label="Asistira?">
                  <select
                    name="attending"
                    defaultValue={invitedGuestRsvp?.attending === false ? "no" : "si"}
                    disabled={isConfirmed || isAdminPreview}
                    className="kais-input-luxe"
                  >
                    <option value="si">Si, con gusto</option>
                    <option value="no">No podre asistir</option>
                  </select>
                </LuxeField>
                {invitedGuest?.max_companions === 0 ? (
                  <div className="rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 px-4 py-3">
                    <p className="text-sm font-semibold text-[#f5ecd9]">Invitación individual.</p>
                  </div>
                ) : (
                  <LuxeField label="¿Cuántos acompañantes traerás?">
                    <input
                      name="companions"
                      type="number"
                      min={0}
                      max={invitedGuest?.max_companions}
                      defaultValue={String(invitedGuestRsvp?.companions ?? 0)}
                      disabled={isConfirmed || isAdminPreview}
                      className="kais-input-luxe"
                    />
                    {invitedGuest ? (
                      <p className="mt-2 text-xs leading-5 text-[#f5ecd9]/65">
                        Tu cupo permite hasta {invitedGuest.max_companions} acompanante{invitedGuest.max_companions === 1 ? "" : "s"}.
                      </p>
                    ) : null}
                  </LuxeField>
                )}
              </div>

              {invitedGuest && invitedGuest.max_companions > 0 ? (
                <div className="rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 px-4 py-3">
                  <p className="text-sm font-semibold text-[#f5ecd9]">
                    Podes venir con hasta {invitedGuest.max_companions} acompanante{invitedGuest.max_companions === 1 ? "" : "s"}.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#f5ecd9]/70">
                    Tu cupo total es de {invitedGuest.max_companions + 1} personas, incluyendo tu asistencia.
                  </p>
                </div>
              ) : null}

              <LuxeField label="Restriccion alimentaria">
                <input
                  name="dietary_restrictions"
                  placeholder="Opcional"
                  defaultValue={invitedGuestRsvp?.dietary_restrictions ?? ""}
                  disabled={isConfirmed || isAdminPreview}
                  className="kais-input-luxe"
                />
              </LuxeField>

              <LuxeField label="Mensaje para los anfitriones">
                <textarea
                  name="message"
                  rows={3}
                  defaultValue={invitedGuestRsvp?.message ?? ""}
                  disabled={isConfirmed || isAdminPreview}
                  className="kais-input-luxe resize-none"
                />
              </LuxeField>

              {!isConfirmed && !isAdminPreview ? (
                <div className="mt-2">
                  <button type="submit" className="kais-cta w-full sm:w-fit">
                    <Send className="h-3.5 w-3.5" />
                    Enviar confirmacion
                  </button>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </section>

      {showRoyalPack && <RoyalWeddingDivider />}

      <footer className="relative overflow-hidden px-5 py-14 text-center">
        <ThemeDecorations
          themeSlug={decorationThemeSlug}
          section="footer"
          decorations={slotDecorations}
          freeDecorations={freeDecorations}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
        <div className="kais-brand-footer relative z-10">
          <p className="kais-brand-footer__eyebrow">Una experiencia de</p>
          <Link href="/" className="kais-brand-footer__name">KAIS Invitaciones</Link>
        </div>
      </footer>
    </main>
  );
}

function LuxeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">{label}</span>
      <div className="mt-2.5">{children}</div>
    </label>
  );
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
