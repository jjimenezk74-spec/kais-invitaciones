"use client";

/**
 * InvitationPreviewSection
 *
 * Renderiza los mismos componentes reales que app/evento/[slug]/page.tsx,
 * adaptados para el canvas editor (390x844, forceMobile en hero).
 * Sin mocks — sin JSX duplicado — misma fuente de verdad.
 */

import { EventHero } from "@/components/public-invitation/event-hero";
import { ThemeDecorations } from "@/components/theme-decorations";
import {
  CountdownSectionContent,
  PresentationSectionContent,
  MessagesSectionContent,
  DetailsSectionContent,
  ChurchSectionContent,
  DresscodeSectionContent,
  RsvpPreviewContent,
  FooterBrandContent,
} from "@/components/public-invitation/invitation-sections";
import type { CanvasSectionId, Event, EventDecorations, VisualDecoration } from "@/lib/types";
import type { EventHeroData } from "@/components/public-invitation/event-hero";

type Props = {
  sectionId: CanvasSectionId;
  event: Event;
  decorationThemeSlug: string | null;
  slotDecorations: EventDecorations;
  freeDecorations: VisualDecoration[];
  calendarUrl: string;
};

// Dark background fill shared by all non-hero sections
const BG = () => (
  <div style={{ position: "absolute", inset: 0, background: "#0a0405" }} />
);

export function InvitationPreviewSection({
  sectionId,
  event,
  decorationThemeSlug,
  slotDecorations,
  freeDecorations,
  calendarUrl,
}: Props) {
  const heroEvent: EventHeroData = {
    cover_image_url:        event.cover_image_url,
    mobile_cover_image_url: event.mobile_cover_image_url,
    theme_color:            event.theme_color,
    hosts_names:            event.hosts_names,
    event_type:             event.event_type,
    event_date:             event.event_date,
    event_time:             event.event_time,
    google_maps_link:       event.google_maps_link,
    music_url:              event.music_url,
  };

  switch (sectionId) {

    // ── HERO ───────────────────────────────────────────────────────────────
    case "hero":
      return (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <EventHero
            event={heroEvent}
            calendarUrl={calendarUrl}
            themeSlug={decorationThemeSlug}
            decorations={slotDecorations}
            freeDecorations={freeDecorations}
            showMusic={false}
            showScrollCue
            forceMobile
          />
        </div>
      );

    // ── COUNTDOWN ──────────────────────────────────────────────────────────
    // Public page hides this section on desktop (lg:hidden).
    // In the editor it always shows — same inner JSX, just no lg:hidden.
    case "countdown":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <section
            className="kais-grain relative px-5 py-20"
            style={{ minHeight: "100%" }}
            aria-label="Cuenta regresiva y mensaje"
          >
            <CountdownSectionContent event={event} calendarUrl={calendarUrl} />
          </section>
        </div>
      );

    // ── PRESENTACIÓN ───────────────────────────────────────────────────────
    case "presentation":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <ThemeDecorations
            themeSlug={decorationThemeSlug}
            section="info"
            decorations={slotDecorations}
            freeDecorations={freeDecorations}
          />
          <section className="kais-grain kais-section relative" style={{ minHeight: "100%" }}>
            <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#3a0a12]/35 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-16 h-72 w-72 rounded-full bg-[#d4af37]/[0.06] blur-3xl" />
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              <PresentationSectionContent event={event} />
            </div>
          </section>
        </div>
      );

    // ── MENSAJES ───────────────────────────────────────────────────────────
    case "messages":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <section className="kais-grain kais-section relative" style={{ minHeight: "100%" }}>
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              {event.quince_message || event.parents_message ? (
                <MessagesSectionContent event={event} />
              ) : (
                <p className="text-center text-sm italic text-[#f5ecd9]/30">Sin mensajes configurados</p>
              )}
            </div>
          </section>
        </div>
      );

    // ── DETALLES ───────────────────────────────────────────────────────────
    case "details":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <ThemeDecorations
            themeSlug={decorationThemeSlug}
            section="info"
            decorations={slotDecorations}
            freeDecorations={freeDecorations}
          />
          <section className="kais-grain kais-section relative" style={{ minHeight: "100%" }}>
            <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#3a0a12]/35 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-16 h-72 w-72 rounded-full bg-[#d4af37]/[0.06] blur-3xl" />
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              <DetailsSectionContent event={event} />
            </div>
          </section>
        </div>
      );

    // ── IGLESIA ────────────────────────────────────────────────────────────
    case "church":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <section className="kais-grain kais-section relative" style={{ minHeight: "100%" }}>
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              {event.church_name ? (
                <ChurchSectionContent event={event} />
              ) : (
                <p className="text-sm italic text-[#f5ecd9]/30">Sin iglesia configurada</p>
              )}
            </div>
          </section>
        </div>
      );

    // ── VESTIMENTA ─────────────────────────────────────────────────────────
    case "dresscode":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <section className="kais-grain kais-section relative" style={{ minHeight: "100%" }}>
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              {event.dress_code || event.color_palette || event.theme ? (
                <DresscodeSectionContent event={event} />
              ) : (
                <p className="text-sm italic text-[#f5ecd9]/30">Sin vestimenta configurada</p>
              )}
            </div>
          </section>
        </div>
      );

    // ── RSVP ───────────────────────────────────────────────────────────────
    case "rsvp":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <ThemeDecorations
            themeSlug={decorationThemeSlug}
            section="rsvp"
            decorations={slotDecorations}
            freeDecorations={freeDecorations}
          />
          <section
            className="kais-grain kais-section relative overflow-hidden bg-[#0a0405]"
            style={{ minHeight: "100%" }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
            <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />
            <RsvpPreviewContent />
          </section>
        </div>
      );

    // ── FOOTER ─────────────────────────────────────────────────────────────
    case "footer":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <ThemeDecorations
            themeSlug={decorationThemeSlug}
            section="footer"
            decorations={slotDecorations}
            freeDecorations={freeDecorations}
          />
          <footer
            className="kais-grain relative overflow-hidden px-5 py-14 text-center"
            style={{ minHeight: "100%" }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
            <FooterBrandContent />
          </footer>
        </div>
      );

    default:
      return null;
  }
}
