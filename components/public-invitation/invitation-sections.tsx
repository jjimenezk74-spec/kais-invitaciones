import { MapPin, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// CountdownSectionContent
// Inner content of the mobile countdown section (blobs + max-w-md card).
// Public page wraps with: <section className="... lg:hidden">
// Editor wraps with:      <section className="kais-grain ... ">
// ─────────────────────────────────────────────────────────────────────────────

type CountdownContentProps = {
  event: Pick<Event, "event_date" | "event_time" | "google_maps_link">;
  calendarUrl: string;
  invitedGuestName?: string | null;
};

export function CountdownSectionContent({ event, calendarUrl, invitedGuestName }: CountdownContentProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#3a0a12]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-12 h-48 w-48 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />

      <div className="relative mx-auto max-w-md text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="block h-px w-10 kais-hairline" />
          <p className="kais-eyebrow">{invitedGuestName ? `Para ${invitedGuestName}` : "Faltan"}</p>
          <span className="block h-px w-10 kais-hairline" />
        </div>

        <div className="mt-10">
          <Countdown date={event.event_date} time={event.event_time} variant="luxe" />
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <a
            href={event.google_maps_link ?? "#detalles"}
            target="_blank"
            rel="noreferrer"
            className="kais-ghost-link"
          >
            <MapPin className="h-3.5 w-3.5" />
            Como llegar
          </a>
          <a href={calendarUrl} target="_blank" rel="noreferrer" className="kais-ghost-link">
            <CalendarPlus className="h-3.5 w-3.5" />
            Calendario
          </a>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PresentationSectionContent
// Inner content: eyebrow line + title + main_message + quinceanera + parents.
// Rendered inside <div className="relative z-10 mx-auto max-w-5xl text-center">
// ─────────────────────────────────────────────────────────────────────────────

type PresentationContentProps = {
  event: Pick<Event, "title" | "main_message" | "quinceanera_name" | "parents_names">;
};

export function PresentationSectionContent({ event }: PresentationContentProps) {
  return (
    <>
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
        <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">
          {event.main_message}
        </p>
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
          <p className="mt-3 font-display text-2xl italic text-[#f5ecd9]/88 md:text-3xl">
            {event.parents_names}
          </p>
        </div>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MessagesSectionContent
// Messages grid (quince + parents cards). Returns null when empty.
// Includes its own mx-auto mt-12 wrapper so it flows correctly in #detalles.
// ─────────────────────────────────────────────────────────────────────────────

type MessagesContentProps = {
  event: Pick<Event, "quince_message" | "parents_message">;
};

export function MessagesSectionContent({ event }: MessagesContentProps) {
  if (!event.quince_message && !event.parents_message) return null;
  return (
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailsSectionContent
// Date / time / address grid with md:grid-cols-3 and dividers.
// Includes its own mt-16 so it flows after messages in #detalles.
// ─────────────────────────────────────────────────────────────────────────────

type DetailsContentProps = {
  event: Pick<Event, "event_date" | "event_time" | "address">;
};

export function DetailsSectionContent({ event }: DetailsContentProps) {
  return (
    <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0">
      {(
        [
          ["Fecha", formatDate(event.event_date)],
          ["Hora", event.event_time],
          ["Lugar", event.address],
        ] as [string, string][]
      ).map(([label, value], i) => (
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChurchSectionContent
// Religious ceremony block. Returns null when church_name is absent.
// Includes mt-16 to flow after details in #detalles.
// ─────────────────────────────────────────────────────────────────────────────

type ChurchContentProps = {
  event: Pick<Event, "church_name" | "church_time">;
};

export function ChurchSectionContent({ event }: ChurchContentProps) {
  if (!event.church_name) return null;
  return (
    <div className="mx-auto mt-16 max-w-2xl">
      <p className="kais-eyebrow">Ceremonia religiosa</p>
      <p className="mt-3 font-display text-2xl italic text-[#f5ecd9] md:text-3xl">{event.church_name}</p>
      {event.church_time ? (
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d4af37]/85">
          {event.church_time}
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DresscodeSectionContent
// Dress code / color palette / theme block. Returns null when all absent.
// Includes mt-16 to flow after church in #detalles.
// ─────────────────────────────────────────────────────────────────────────────

type DresscodeContentProps = {
  event: Pick<Event, "dress_code" | "color_palette" | "theme">;
};

export function DresscodeSectionContent({ event }: DresscodeContentProps) {
  if (!event.dress_code && !event.color_palette && !event.theme) return null;
  return (
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FooterBrandContent
// The KAIS brand block used in both public footer and editor footer tab.
// ─────────────────────────────────────────────────────────────────────────────

export function FooterBrandContent() {
  return (
    <div className="kais-brand-footer relative z-10">
      <p className="kais-brand-footer__eyebrow">Una experiencia de</p>
      <Link href="/" className="kais-brand-footer__name">
        KAIS Invitaciones
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RsvpPreviewContent
// Visual-only RSVP preview for the canvas editor (all inputs disabled).
// Matches the public page layout: left heading + right disabled form.
// ─────────────────────────────────────────────────────────────────────────────

export function RsvpPreviewContent() {
  return (
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
          Tu respuesta ayuda a los anfitriones a preparar cada detalle del evento.
        </p>
      </div>

      <div className="kais-glass relative rounded-[2rem] p-6 sm:p-9 md:p-11">
        <div className="grid gap-5 md:gap-7">
          <RsvpLuxeField label="Nombre">
            <input disabled className="kais-input-luxe" />
          </RsvpLuxeField>

          <div className="grid gap-5 md:grid-cols-2 md:gap-7">
            <RsvpLuxeField label="Telefono">
              <input disabled className="kais-input-luxe" />
            </RsvpLuxeField>
            <RsvpLuxeField label="Email">
              <input disabled type="email" className="kais-input-luxe" />
            </RsvpLuxeField>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:gap-7">
            <RsvpLuxeField label="Asistira?">
              <select disabled className="kais-input-luxe">
                <option>Si, con gusto</option>
              </select>
            </RsvpLuxeField>
            <RsvpLuxeField label="Acompanantes">
              <input disabled type="number" defaultValue={0} className="kais-input-luxe" />
            </RsvpLuxeField>
          </div>

          <RsvpLuxeField label="Restriccion alimentaria">
            <input disabled placeholder="Opcional" className="kais-input-luxe" />
          </RsvpLuxeField>

          <RsvpLuxeField label="Mensaje para los anfitriones">
            <textarea disabled rows={3} className="kais-input-luxe resize-none" />
          </RsvpLuxeField>
        </div>
      </div>
    </div>
  );
}

function RsvpLuxeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">{label}</span>
      <div className="mt-2.5">{children}</div>
    </label>
  );
}
