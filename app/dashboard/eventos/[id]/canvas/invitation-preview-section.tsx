"use client";

/**
 * InvitationPreviewSection
 *
 * Renderiza el JSX real de cada sección de la invitación pública, adaptado
 * para el canvas editor (390×844, forceMobile en hero, sin lg:hidden en
 * countdown). Sin mocks — usa datos reales del evento.
 */

import { MapPin, CalendarPlus } from "lucide-react";
import { EventHero } from "@/components/public-invitation/event-hero";
import { Countdown } from "@/components/countdown";
import { ThemeDecorations } from "@/components/theme-decorations";
import { formatDate } from "@/lib/utils";
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

// ── dark background fill ────────────────────────────────────────────────────
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
  // Derive hero props from the full event object
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
    // The public page has lg:hidden on this section — we remove it here so
    // it always renders in the editor (it IS the mobile section).
    case "countdown":
      return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <BG />
          <section
            className="kais-grain relative px-5 py-20"
            style={{ minHeight: "100%" }}
            aria-label="Cuenta regresiva y mensaje"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
            <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#3a0a12]/35 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 bottom-12 h-48 w-48 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />

            <div className="relative mx-auto max-w-md text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="block h-px w-10 kais-hairline" />
                <p className="kais-eyebrow">Faltan</p>
                <span className="block h-px w-10 kais-hairline" />
              </div>

              <div className="mt-10">
                <Countdown date={event.event_date} time={event.event_time} variant="luxe" />
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                <a
                  href={event.google_maps_link ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="kais-ghost-link"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Como llegar
                </a>
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="kais-ghost-link"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Calendario
                </a>
              </div>
            </div>
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
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="block h-px w-10 kais-hairline" />
                <p className="kais-eyebrow">Una noche · Inolvidable</p>
                <span className="block h-px w-10 kais-hairline" />
              </div>

              <h2
                className="mt-9 font-display font-light italic leading-[0.95]"
                style={{ fontSize: "clamp(2.6rem, 6.5vw, 5.5rem)" }}
              >
                <span className="kais-gold-text kais-shimmer">{event.title}</span>
              </h2>

              {event.main_message ? (
                <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">
                  {event.main_message}
                </p>
              ) : null}

              {event.quinceanera_name ? (
                <div className="mx-auto mt-12 max-w-2xl">
                  <p className="kais-eyebrow">Quinceanera</p>
                  <h3 className="mt-3 font-display text-4xl font-light italic text-[#f5ecd9]">
                    {event.quinceanera_name}
                  </h3>
                </div>
              ) : null}

              {event.parents_names ? (
                <div className="mx-auto mt-10 max-w-2xl">
                  <p className="kais-eyebrow">Junto a mis padres</p>
                  <p className="mt-3 font-display text-2xl italic text-[#f5ecd9]/88">
                    {event.parents_names}
                  </p>
                </div>
              ) : null}
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
            <div className="relative z-10 mx-auto max-w-3xl">
              {event.quince_message || event.parents_message ? (
                <div className="grid gap-5">
                  {event.quince_message ? (
                    <div className="kais-glass rounded-3xl p-6 text-left">
                      <p className="kais-eyebrow">Mensaje</p>
                      <p className="mt-4 text-sm leading-7 text-[#f5ecd9]/75">
                        {event.quince_message}
                      </p>
                    </div>
                  ) : null}
                  {event.parents_message ? (
                    <div className="kais-glass rounded-3xl p-6 text-left">
                      <p className="kais-eyebrow">Familia</p>
                      <p className="mt-4 text-sm leading-7 text-[#f5ecd9]/75">
                        {event.parents_message}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-center text-sm italic text-[#f5ecd9]/30">
                  Sin mensajes configurados
                </p>
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
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              <div className="grid grid-cols-1 gap-10">
                {(
                  [
                    ["Fecha", formatDate(event.event_date)],
                    ["Hora", event.event_time],
                    ["Lugar", event.address],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="px-2 py-2">
                    <p className="kais-eyebrow">{label}</p>
                    <p className="mt-4 font-display text-2xl italic text-[#f5ecd9]">{value}</p>
                  </div>
                ))}
              </div>
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
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              {event.church_name ? (
                <>
                  <p className="kais-eyebrow">Ceremonia religiosa</p>
                  <p className="mt-3 font-display text-2xl italic text-[#f5ecd9]">
                    {event.church_name}
                  </p>
                  {event.church_time ? (
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d4af37]/85">
                      {event.church_time}
                    </p>
                  ) : null}
                </>
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
            <div className="relative z-10 mx-auto max-w-3xl text-center">
              {event.dress_code || event.color_palette || event.theme ? (
                <div className="grid gap-10">
                  {event.dress_code ? (
                    <div>
                      <p className="kais-eyebrow">Tenida</p>
                      <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85">
                        {event.dress_code}
                      </p>
                    </div>
                  ) : null}
                  {event.color_palette ? (
                    <div>
                      <p className="kais-eyebrow">Gama de colores</p>
                      <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85">
                        {event.color_palette}
                      </p>
                    </div>
                  ) : null}
                  {event.theme ? (
                    <div>
                      <p className="kais-eyebrow">Tematica</p>
                      <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85">
                        {event.theme}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm italic text-[#f5ecd9]/30">Sin vestimenta configurada</p>
              )}
            </div>
          </section>
        </div>
      );

    // ── RSVP ───────────────────────────────────────────────────────────────
    // Solo preview visual — no formulario interactivo
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
            <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="block h-px w-10 kais-hairline" />
                <p className="kais-eyebrow">RSVP · Asistencia</p>
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
            </div>
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
            <div className="kais-brand-footer relative z-10">
              <p className="kais-brand-footer__eyebrow">Una experiencia de</p>
              <p className="kais-brand-footer__name">KAIS Invitaciones</p>
            </div>
          </footer>
        </div>
      );

    default:
      return null;
  }
}
