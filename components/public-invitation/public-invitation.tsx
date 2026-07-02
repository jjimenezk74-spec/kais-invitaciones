"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarPlus, Eye, MapPin } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { CanvasRenderer } from "@/components/canvas-renderer";
import { RoyalWeddingDivider, RoyalWeddingPack } from "@/components/decorations/royal-wedding-pack";
import { EventHero } from "@/components/public-invitation/event-hero";
import {
  ChurchSectionContent,
  CountdownSectionContent,
  DetailsSectionContent,
  DresscodeSectionContent,
  FooterBrandContent,
  MessagesSectionContent,
  PresentationSectionContent
} from "@/components/public-invitation/invitation-sections";
import { PublicRsvpForm } from "@/components/public-invitation/public-rsvp-form";
import { ThemeDecorations } from "@/components/theme-decorations";
import { eventHasFeature } from "@/lib/event-features";
import type { ResolvedDesign } from "@/lib/invitation-design";
import type { CanvasDesign, CanvasSectionId, Event, EventDecorations, EventGuest, InvitationTheme, Rsvp, VisualDecoration } from "@/lib/types";

type PublicInvitationProps = {
  mode?: "public" | "editor";
  event: Event;
  design: ResolvedDesign;
  invitationThemeSlug?: string | null;
  isAdminPreview?: boolean;
  from?: string | null;
  invitedGuest?: EventGuest | null;
  invitedGuestRsvp?: Rsvp | null;
  guestToken?: string | null;
  rsvpAction?: ((formData: FormData) => void | Promise<void>) | null;
  rsvpError?: string | null;
  rsvpStatus?: string | null;
  rsvpAttending?: string | null;
  shouldRedirectWhatsApp?: boolean;
  whatsappMessage?: string | null;
  shouldUseWhatsAppRsvp?: boolean;
  calendarUrl: string;
  decorationThemeSlug?: string | null;
  slotDecorations: EventDecorations;
  freeDecorations: VisualDecoration[];
  showRoyalPack: boolean;
  canvasDesign?: CanvasDesign | null;
  renderCanvasLayer?: (sectionId: CanvasSectionId) => ReactNode;
};

const DETAIL_CANVAS_SECTIONS: CanvasSectionId[] = ["presentation", "messages", "details", "church", "dresscode"];

export function PublicInvitation({
  mode = "public",
  event,
  design,
  invitationThemeSlug,
  isAdminPreview = false,
  from,
  invitedGuest,
  invitedGuestRsvp,
  guestToken,
  rsvpAction,
  rsvpError,
  rsvpStatus,
  rsvpAttending,
  shouldRedirectWhatsApp = false,
  whatsappMessage,
  shouldUseWhatsAppRsvp = false,
  calendarUrl,
  decorationThemeSlug,
  slotDecorations,
  freeDecorations,
  showRoyalPack,
  canvasDesign,
  renderCanvasLayer
}: PublicInvitationProps) {
  const isEditor = mode === "editor";
  const isConfirmed = !isEditor && (Boolean(invitedGuestRsvp) || rsvpStatus === "ok");
  const confirmedAttending = invitedGuestRsvp
    ? invitedGuestRsvp.attending
    : rsvpStatus === "ok"
      ? rsvpAttending !== "no"
      : null;

  return (
    <main
      className={[
        "w-full max-w-full overflow-x-hidden",
        design.stageClassName,
        design.designClassName,
        invitationThemeSlug ? `kais-theme-${invitationThemeSlug}` : "",
        invitationThemeSlug ? "kais-theme-active" : ""
      ].filter(Boolean).join(" ")}
      data-font-preset={design.designConfig.fontPreset}
      data-background-variant={design.designConfig.backgroundVariant}
      data-animation-preset={design.designConfig.animationPreset}
      data-decoration-level={design.designConfig.decorationLevel}
      style={invitationThemeSlug
        ? undefined
        : { ["--template-primary" as string]: design.primary, ["--template-secondary" as string]: design.secondary }}
    >
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

      {showRoyalPack && <RoyalWeddingPack />}

      {!isEditor ? (
        <div
          className={[
            "fixed left-3 z-50 sm:left-5",
            isAdminPreview
              ? "top-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem)]"
              : "top-[max(0.75rem,env(safe-area-inset-top))]"
          ].join(" ")}
        >
          <BackButton from={from ?? undefined} />
        </div>
      ) : null}

      <div style={{ position: "relative" }}>
        <EventHero
          event={event}
          calendarUrl={calendarUrl}
          invitedGuestName={invitedGuest?.guest_name}
          themeSlug={decorationThemeSlug}
          decorations={slotDecorations}
          freeDecorations={freeDecorations}
          showMusic={!isEditor && eventHasFeature(event, "music")}
          showScrollCue={!isEditor}
        />
        {canvasDesign && <CanvasRenderer design={canvasDesign} sectionId="hero" />}
        {renderCanvasLayer?.("hero")}
      </div>

      <section className="relative px-5 py-20 sm:py-24 lg:hidden" aria-label="Cuenta regresiva y mensaje">
        <CountdownSectionContent
          event={event}
          calendarUrl={calendarUrl}
          invitedGuestName={invitedGuest?.guest_name ?? null}
        />
        {canvasDesign && <CanvasRenderer design={canvasDesign} sectionId="countdown" />}
        {renderCanvasLayer?.("countdown")}
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
          <PresentationSectionContent event={event} />
          <MessagesSectionContent event={event} />
          <DetailsSectionContent event={event} />
          <ChurchSectionContent event={event} />
          <DresscodeSectionContent event={event} />
        </div>
        {canvasDesign && DETAIL_CANVAS_SECTIONS.map((sectionId) => (
          <CanvasRenderer key={sectionId} design={canvasDesign} sectionId={sectionId} />
        ))}
        {DETAIL_CANVAS_SECTIONS.map((sectionId) => (
          <div key={sectionId}>{renderCanvasLayer?.(sectionId)}</div>
        ))}
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
              {isEditor
                ? "Tu respuesta ayuda a los anfitriones a preparar cada detalle del evento."
                : isAdminPreview
                  ? "Vista previa - el formulario RSVP es solo lectura en modo administrador."
                  : isConfirmed && confirmedAttending === false
                    ? "Tu respuesta quedo registrada."
                    : isConfirmed
                      ? "Tu confirmacion quedo registrada."
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

          <PublicRsvpForm
            event={event}
            isEditor={isEditor}
            isAdminPreview={isAdminPreview}
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
          />
        </div>
        {canvasDesign && <CanvasRenderer design={canvasDesign} sectionId="rsvp" />}
        {renderCanvasLayer?.("rsvp")}
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
        <FooterBrandContent />
        {canvasDesign && <CanvasRenderer design={canvasDesign} sectionId="footer" />}
        {renderCanvasLayer?.("footer")}
      </footer>
    </main>
  );
}

