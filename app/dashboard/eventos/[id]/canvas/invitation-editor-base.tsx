// Server Component — renders the REAL invitation layout for the canvas editor.
// This is the WYSIWYG base: it uses the same components as the public page so
// what you see in the editor matches /evento/[slug] exactly.
//
// Each section is wrapped in a `data-canvas-section` div with position:relative
// so SectionCanvasLayer elements anchor correctly.
// Interactive elements (links, form) are suppressed via pointer-events:none.

import { Send } from "lucide-react";
import { EventHero } from "@/components/public-invitation/event-hero";
import { Countdown } from "@/components/countdown";
import { ThemeDecorations } from "@/components/theme-decorations";
import { RoyalWeddingPack, RoyalWeddingDivider } from "@/components/decorations/royal-wedding-pack";
import { SectionCanvasLayer } from "./section-canvas-layer";
import { formatDate } from "@/lib/utils";
import type { Event, EventDecorations, VisualDecoration } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InvitationEditorBaseProps = {
  event: Pick<
    Event,
    | "cover_image_url"
    | "mobile_cover_image_url"
    | "theme_color"
    | "hosts_names"
    | "event_type"
    | "event_date"
    | "event_time"
    | "google_maps_link"
    | "music_url"
    | "title"
    | "main_message"
    | "quinceanera_name"
    | "parents_names"
    | "quince_message"
    | "parents_message"
    | "address"
    | "church_name"
    | "church_time"
    | "dress_code"
    | "color_palette"
    | "theme"
    | "whatsapp_phone"
  >;
  themeSlug: string | null;
  /** Slug used to resolve ThemeDecorations (same as public page decorationThemeSlug) */
  decorationThemeSlug: string | null;
  slotDecorations: EventDecorations;
  freeDecorations: VisualDecoration[];
  showRoyalPack: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// InvitationEditorBase
// ─────────────────────────────────────────────────────────────────────────────

export function InvitationEditorBase({
  event,
  themeSlug,
  decorationThemeSlug,
  slotDecorations,
  freeDecorations,
  showRoyalPack,
}: InvitationEditorBaseProps) {
  const hasChurch = Boolean(event.church_name);
  const hasDresscode = Boolean(event.dress_code || event.color_palette || event.theme);

  return (
    <>
      {/* Royal Wedding SVG overlay — matches public page exactly */}
      {showRoyalPack && <RoyalWeddingPack />}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div data-canvas-section="hero" style={{ position: "relative" }}>
        <div style={{ pointerEvents: "none" }}>
          <EventHero
            event={event}
            calendarUrl="#"
            themeSlug={themeSlug}
            decorations={slotDecorations}
            freeDecorations={freeDecorations}
            showMusic={false}
            showScrollCue={false}
          />
        </div>
        <SectionCanvasLayer sectionId="hero" />
      </div>

      {/* ── CUENTA REGRESIVA ───────────────────────────────────────────────── */}
      {/* The public page shows this section only on mobile (lg:hidden).
          At 390px preview we always render it — correct for mobile WYSIWYG.
          Media queries evaluate against the browser viewport, not the zoomed
          element, so we skip lg:hidden here to keep it always visible. */}
      <div data-canvas-section="countdown" style={{ position: "relative" }}>
        <div style={{ pointerEvents: "none" }}>
          <section className="relative px-5 py-20 sm:py-24" aria-label="Cuenta regresiva">
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
            </div>
          </section>
        </div>
        <SectionCanvasLayer sectionId="countdown" />
      </div>

      {/* ── DETALLES — all granular sub-sections share this coordinate space ─ */}
      {/* presentation / messages / details / church / dresscode all live here */}
      <div data-canvas-section="details" style={{ position: "relative" }}>
        <div style={{ pointerEvents: "none" }}>
          <section id="detalles" className="kais-section relative overflow-hidden">
            {/* ThemeDecorations — same as public page */}
            <ThemeDecorations
              themeSlug={decorationThemeSlug}
              section="info"
              decorations={slotDecorations}
              freeDecorations={freeDecorations}
            />
            <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#3a0a12]/35 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-16 h-72 w-72 rounded-full bg-[#d4af37]/[0.06] blur-3xl" />

            <div className="relative z-10 mx-auto max-w-5xl text-center">
              {/* Eyebrow */}
              <div className="flex items-center justify-center gap-3">
                <span className="block h-px w-10 kais-hairline" />
                <p className="kais-eyebrow">Una noche . Inolvidable</p>
                <span className="block h-px w-10 kais-hairline" />
              </div>

              {/* Event title */}
              <h2
                className="mt-9 font-display font-light italic leading-[0.95]"
                style={{ fontSize: "clamp(2.6rem, 6.5vw, 5.5rem)" }}
              >
                <span className="kais-gold-text kais-shimmer">{event.title}</span>
              </h2>

              {/* Main message */}
              {event.main_message ? (
                <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">
                  {event.main_message}
                </p>
              ) : null}

              {/* Quinceañera */}
              {event.quinceanera_name ? (
                <div className="mx-auto mt-12 max-w-2xl">
                  <p className="kais-eyebrow">Quinceañera</p>
                  <h3 className="mt-3 font-display text-4xl font-light italic text-[#f5ecd9] md:text-5xl">
                    {event.quinceanera_name}
                  </h3>
                </div>
              ) : null}

              {/* Parents names */}
              {event.parents_names ? (
                <div className="mx-auto mt-10 max-w-2xl">
                  <p className="kais-eyebrow">Junto a mis padres</p>
                  <p className="mt-3 font-display text-2xl italic text-[#f5ecd9]/88 md:text-3xl">
                    {event.parents_names}
                  </p>
                </div>
              ) : null}

              {/* Message cards */}
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

              {/* Fecha / Hora / Lugar */}
              <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0">
                {[
                  ["Fecha", formatDate(event.event_date)],
                  ["Hora", event.event_time],
                  ["Lugar", event.address],
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

              {/* Church */}
              {hasChurch ? (
                <div className="mx-auto mt-16 max-w-2xl">
                  <p className="kais-eyebrow">Ceremonia religiosa</p>
                  <p className="mt-3 font-display text-2xl italic text-[#f5ecd9] md:text-3xl">
                    {event.church_name}
                  </p>
                  {event.church_time ? (
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d4af37]/85">
                      {event.church_time}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Dresscode */}
              {hasDresscode ? (
                <div className="mx-auto mt-16 grid max-w-3xl gap-5 md:grid-cols-3">
                  {event.dress_code ? (
                    <div>
                      <p className="kais-eyebrow">Tenida</p>
                      <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">
                        {event.dress_code}
                      </p>
                    </div>
                  ) : null}
                  {event.color_palette ? (
                    <div>
                      <p className="kais-eyebrow">Gama de colores</p>
                      <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">
                        {event.color_palette}
                      </p>
                    </div>
                  ) : null}
                  {event.theme ? (
                    <div>
                      <p className="kais-eyebrow">Temática</p>
                      <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">
                        {event.theme}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* All granular detail sub-sections share this coordinate space */}
        <SectionCanvasLayer sectionId="presentation" />
        <SectionCanvasLayer sectionId="messages" />
        <SectionCanvasLayer sectionId="details" />
        <SectionCanvasLayer sectionId="church" />
        <SectionCanvasLayer sectionId="dresscode" />
      </div>

      {/* Royal Wedding divider between details and RSVP */}
      {showRoyalPack && <RoyalWeddingDivider />}

      {/* ── RSVP ──────────────────────────────────────────────────────────── */}
      <div data-canvas-section="rsvp" style={{ position: "relative" }}>
        <div style={{ pointerEvents: "none" }}>
          <section id="rsvp" className="kais-section relative overflow-hidden bg-[#0a0405]">
            {/* ThemeDecorations — same as public page */}
            <ThemeDecorations
              themeSlug={decorationThemeSlug}
              section="rsvp"
              decorations={slotDecorations}
              freeDecorations={freeDecorations}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
            <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />

            <div className="relative z-10 mx-auto grid max-w-5xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-20">
              {/* Left: heading — identical to public page */}
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

              {/* Right: real form fields — same markup as public page, all disabled.
                  This is WYSIWYG: the disabled inputs render identically to the
                  enabled ones visually (same kais-input-luxe class) so the editor
                  preview matches the published invitation exactly. */}
              <div className="kais-glass relative rounded-[2rem] p-6 sm:p-9 md:p-11">
                <div className="grid gap-5 md:gap-7">
                  {/* Nombre */}
                  <label className="block">
                    <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">Nombre</span>
                    <div className="mt-2.5">
                      <input disabled className="kais-input-luxe" />
                    </div>
                  </label>

                  {/* Teléfono + Email */}
                  <div className="grid gap-5 md:grid-cols-2 md:gap-7">
                    <label className="block">
                      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">Teléfono</span>
                      <div className="mt-2.5"><input disabled className="kais-input-luxe" /></div>
                    </label>
                    <label className="block">
                      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">Email</span>
                      <div className="mt-2.5"><input disabled className="kais-input-luxe" /></div>
                    </label>
                  </div>

                  {/* Asistirá + Acompañantes */}
                  <div className="grid gap-5 md:grid-cols-2 md:gap-7">
                    <label className="block">
                      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">¿Asistirá?</span>
                      <div className="mt-2.5">
                        <select disabled className="kais-input-luxe">
                          <option>Si, con gusto</option>
                        </select>
                      </div>
                    </label>
                    <label className="block">
                      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">¿Cuántos acompañantes?</span>
                      <div className="mt-2.5">
                        <input disabled type="number" defaultValue={0} className="kais-input-luxe" />
                      </div>
                    </label>
                  </div>

                  {/* Restricción alimentaria */}
                  <label className="block">
                    <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">Restriccion alimentaria</span>
                    <div className="mt-2.5">
                      <input disabled placeholder="Opcional" className="kais-input-luxe" />
                    </div>
                  </label>

                  {/* Mensaje */}
                  <label className="block">
                    <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">Mensaje para los anfitriones</span>
                    <div className="mt-2.5">
                      <textarea disabled rows={3} className="kais-input-luxe resize-none" />
                    </div>
                  </label>

                  {/* Submit — visual only */}
                  <div className="mt-2">
                    <button type="button" disabled className="kais-cta w-full sm:w-fit">
                      <Send className="h-3.5 w-3.5" />
                      Enviar confirmacion
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <SectionCanvasLayer sectionId="rsvp" />
      </div>

      {/* Royal Wedding divider between RSVP and footer */}
      {showRoyalPack && <RoyalWeddingDivider />}

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <div data-canvas-section="footer" style={{ position: "relative" }}>
        <div style={{ pointerEvents: "none" }}>
          <footer className="relative overflow-hidden px-5 py-14 text-center">
            {/* ThemeDecorations — same as public page */}
            <ThemeDecorations
              themeSlug={decorationThemeSlug}
              section="footer"
              decorations={slotDecorations}
              freeDecorations={freeDecorations}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
            <div className="kais-brand-footer relative z-10">
              <p className="kais-brand-footer__eyebrow">Una experiencia de</p>
              <p className="kais-brand-footer__name">KAIS Invitaciones</p>
            </div>
          </footer>
        </div>
        <SectionCanvasLayer sectionId="footer" />
      </div>
    </>
  );
}
