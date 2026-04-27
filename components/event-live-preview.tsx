"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { EventHero } from "@/components/public-invitation/event-hero";
import type { EventType } from "@/lib/types";

type EventLivePreviewProps = {
  templateId: string;
  templateSlug?: string;
  title: string;
  hostNames: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  address?: string;
  googleMapsLink?: string | null;
  mainMessage?: string | null;
  musicUrl?: string | null;
  themeColor?: string | null;
  heroImageUrl?: string | null;
};

type PreviewDevice = "desktop" | "mobile";
type PreviewSection = "hero" | "story" | "details" | "rsvp" | "location";

type PreviewEvent = {
  cover_image_url: string | null;
  mobile_cover_image_url: string | null;
  theme_color: string;
  hosts_names: string;
  event_type: EventType;
  event_date: string;
  event_time: string;
  google_maps_link: string | null;
  music_url: string | null;
  title: string;
  address: string;
  main_message: string | null;
};

const previewTabs: { value: PreviewSection; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "story", label: "Historia" },
  { value: "details", label: "Datos" },
  { value: "rsvp", label: "RSVP" },
  { value: "location", label: "Ubicacion" }
];

const previewViewports = {
  desktop: { outerWidth: 520, outerHeight: 320, innerWidth: 1440, innerHeight: 900, scale: 0.361 },
  mobile: { outerWidth: 180, outerHeight: 360, innerWidth: 390, innerHeight: 780, scale: 0.462 }
};

export function EventLivePreview({
  title,
  hostNames,
  eventType,
  eventDate,
  eventTime,
  address,
  googleMapsLink,
  mainMessage,
  musicUrl,
  themeColor,
  heroImageUrl
}: EventLivePreviewProps) {
  const [activeSection, setActiveSection] = useState<PreviewSection>("hero");
  const previewEvent = useMemo<PreviewEvent>(
    () => ({
      cover_image_url: heroImageUrl || null,
      mobile_cover_image_url: heroImageUrl || null,
      theme_color: themeColor || "#3a0a12",
      hosts_names: hostNames || title || "Paloma",
      event_type: toEventType(eventType),
      event_date: eventDate || "2026-12-20",
      event_time: eventTime || "21:00",
      google_maps_link: googleMapsLink || null,
      music_url: musicUrl || null,
      title: title || "Mis 15 Anos",
      address: address || "Salon principal, ciudad",
      main_message:
        mainMessage ||
        "Hace 15 anos comenzo mi historia. Hoy quiero compartir este momento especial con las personas que mas quiero."
    }),
    [address, eventDate, eventTime, eventType, googleMapsLink, heroImageUrl, hostNames, mainMessage, musicUrl, themeColor, title]
  );

  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-4">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Vista previa del diseno</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Usa el mismo lenguaje visual de la invitacion publica, escalado en miniatura.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {previewTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveSection(tab.value)}
            className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition ${
              activeSection === tab.value
                ? "border-accent bg-accent text-accent-foreground shadow-soft"
                : "border-border bg-muted/30 text-muted-foreground hover:border-accent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <ScaledPreviewFrame label="Preview Desktop" device="desktop" section={activeSection} event={previewEvent} />
        <ScaledPreviewFrame label="Preview Mobile" device="mobile" section={activeSection} event={previewEvent} />
      </div>

      <style jsx global>{`
        .kais-preview-viewport .kais-grain {
          min-height: var(--preview-height) !important;
        }
        .kais-preview-viewport .min-h-\\[100svh\\] {
          min-height: var(--preview-height) !important;
        }
        .kais-preview-viewport .kais-section {
          min-height: var(--preview-height) !important;
          padding-top: 7rem !important;
          padding-bottom: 7rem !important;
        }
      `}</style>
    </section>
  );
}

function ScaledPreviewFrame({
  label,
  device,
  section,
  event
}: {
  label: string;
  device: PreviewDevice;
  section: PreviewSection;
  event: PreviewEvent;
}) {
  const viewport = previewViewports[device];

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div
        className="overflow-hidden rounded-lg border bg-[#080304] shadow-soft"
        style={{ width: viewport.outerWidth, height: viewport.outerHeight }}
      >
        <div
          className={`kais-preview-viewport ${device === "desktop" ? "font-sans" : "font-sans"}`}
          style={
            {
              width: viewport.innerWidth,
              height: viewport.innerHeight,
              transform: `scale(${viewport.scale})`,
              transformOrigin: "top left",
              "--preview-height": `${viewport.innerHeight}px`
            } as CSSProperties
          }
        >
          <PreviewCanvas event={event} section={section} />
        </div>
      </div>
    </div>
  );
}

function PreviewCanvas({ event, section }: { event: PreviewEvent; section: PreviewSection }) {
  const calendarUrl = "#";

  return (
    <main
      className="kais-stage relative min-h-full font-sans"
      style={{ ["--template-primary" as string]: event.theme_color, ["--template-secondary" as string]: "#d4af37" }}
    >
      {section === "hero" ? (
        <EventHero event={event} calendarUrl={calendarUrl} showMusic={false} showScrollCue={false} />
      ) : null}
      {section === "story" ? <StorySection event={event} /> : null}
      {section === "details" ? <DetailsSection event={event} /> : null}
      {section === "rsvp" ? <RsvpSection event={event} /> : null}
      {section === "location" ? <LocationSection event={event} /> : null}
    </main>
  );
}

function StorySection({ event }: { event: PreviewEvent }) {
  return (
    <section id="detalles" className="kais-section">
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#3a0a12]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-16 h-72 w-72 rounded-full bg-[#d4af37]/[0.06] blur-3xl" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="block h-px w-10 kais-hairline" />
          <p className="kais-eyebrow">Una noche · Inolvidable</p>
          <span className="block h-px w-10 kais-hairline" />
        </div>
        <h2 className="mt-9 font-display font-light italic leading-[0.95]" style={{ fontSize: "clamp(2.6rem, 6.5vw, 5.5rem)" }}>
          <span className="kais-gold-text kais-shimmer">{event.title}</span>
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">{event.main_message}</p>
      </div>
    </section>
  );
}

function DetailsSection({ event }: { event: PreviewEvent }) {
  return (
    <section className="kais-section">
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="block h-px w-10 kais-hairline" />
          <p className="kais-eyebrow">Detalles</p>
          <span className="block h-px w-10 kais-hairline" />
        </div>
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0">
          {[
            ["Fecha", event.event_date],
            ["Hora", event.event_time],
            ["Lugar", event.address]
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`relative px-2 py-2 ${
                index > 0
                  ? "md:before:absolute md:before:inset-y-3 md:before:left-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#d4af37]/35 md:before:to-transparent"
                  : ""
              }`}
            >
              <p className="kais-eyebrow">{label}</p>
              <p className="mt-4 font-display text-2xl italic text-[#f5ecd9] md:text-3xl">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RsvpSection({ event }: { event: PreviewEvent }) {
  return (
    <section id="rsvp" className="kais-section bg-[#0a0405]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
      <div className="relative mx-auto grid max-w-5xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-20">
        <div>
          <div className="flex items-center gap-3">
            <span className="block h-px w-10 kais-hairline" />
            <p className="kais-eyebrow">RSVP · Asistencia</p>
          </div>
          <h2 className="mt-7 font-display font-light italic leading-[0.95]" style={{ fontSize: "clamp(2.4rem, 4.8vw, 4.4rem)" }}>
            Tu presencia
            <br />
            es el regalo
            <br />
            <span className="kais-gold-text kais-shimmer">mas bonito.</span>
          </h2>
          <p className="mt-7 max-w-md text-[0.95rem] leading-[1.9] text-[#f5ecd9]/65">
            Tu respuesta ayuda a preparar cada detalle del evento.
          </p>
        </div>
        <div className="kais-glass relative rounded-[2rem] p-6 sm:p-9 md:p-11">
          <div className="grid gap-5 md:gap-7">
            <PreviewLuxeField label="Nombre" value={event.hosts_names} />
            <div className="grid gap-5 md:grid-cols-2 md:gap-7">
              <PreviewLuxeField label="Telefono" value="+595 ..." />
              <PreviewLuxeField label="Asistira?" value="Si, con gusto" />
            </div>
            <button type="button" className="kais-cta w-full sm:w-fit">Enviar confirmacion</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LocationSection({ event }: { event: PreviewEvent }) {
  return (
    <section className="kais-section">
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="block h-px w-10 kais-hairline" />
          <p className="kais-eyebrow">Ubicacion · Calendario</p>
          <span className="block h-px w-10 kais-hairline" />
        </div>
        <h2 className="mt-9 font-display font-light italic leading-[0.95]" style={{ fontSize: "clamp(2.6rem, 6.5vw, 5.5rem)" }}>
          <span className="kais-gold-text kais-shimmer">Te esperamos</span>
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">{event.address}</p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <span className="kais-ghost-link">Como llegar</span>
          <span className="kais-ghost-link">Calendario</span>
        </div>
      </div>
    </section>
  );
}

function PreviewLuxeField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">{label}</span>
      <div className="mt-2.5 kais-input-luxe">{value}</div>
    </label>
  );
}

function toEventType(value: string): EventType {
  const validTypes: EventType[] = ["boda", "cumpleaños", "quinceaños", "bautizo", "baby shower", "corporativo", "graduación", "otro"];
  return validTypes.includes(value as EventType) ? (value as EventType) : "quinceaños";
}
