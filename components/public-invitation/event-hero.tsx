"use client";

import Image from "next/image";
import { CalendarPlus, ChevronDown, MapPin } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { EventMusicPlayer } from "@/components/event-music-player";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/lib/types";

type EventHeroData = Pick<
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
>;

type EventHeroProps = {
  event: EventHeroData;
  calendarUrl: string;
  invitedGuestName?: string | null;
  showMusic?: boolean;
  showScrollCue?: boolean;
};

export function EventHero({
  event,
  calendarUrl,
  invitedGuestName,
  showMusic = true,
  showScrollCue = true
}: EventHeroProps) {
  const heroImage = event.cover_image_url ?? event.mobile_cover_image_url ?? null;
  const heroImageMobile = event.mobile_cover_image_url ?? event.cover_image_url ?? null;
  const hasHeroCover = Boolean(heroImage || heroImageMobile);
  const shouldUnoptimizeMobile = Boolean(heroImageMobile?.startsWith("blob:") || heroImageMobile?.startsWith("data:"));
  const shouldUnoptimizeDesktop = Boolean(heroImage?.startsWith("blob:") || heroImage?.startsWith("data:"));

  return (
    <section className="kais-grain relative isolate overflow-hidden" style={{ minHeight: "100svh" }}>
      {showMusic ? (
        <div className="kais-music-float">
          <EventMusicPlayer url={event.music_url} compact />
        </div>
      ) : null}

      <div className="absolute inset-0">
        {hasHeroCover ? (
          <>
            {heroImageMobile ? (
              <Image
                src={heroImageMobile}
                alt={`Portada de ${event.hosts_names}`}
                fill
                priority
                unoptimized={shouldUnoptimizeMobile}
                sizes="(max-width: 1024px) 100vw, 0px"
                className="object-cover object-[center_28%] lg:hidden"
              />
            ) : null}
            {heroImage ? (
              <Image
                src={heroImage}
                alt={`Portada de ${event.hosts_names}`}
                fill
                priority
                unoptimized={shouldUnoptimizeDesktop}
                sizes="(min-width: 1024px) 100vw, 0px"
                className="hidden object-cover object-[68%_center] lg:block"
              />
            ) : null}
          </>
        ) : (
          <div className="kais-hero-fallback h-full w-full" />
        )}
        <div className="absolute inset-0 kais-veil-mobile lg:hidden" />
        <div className="absolute inset-0 hidden lg:block kais-veil-desktop" />
      </div>

      <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-[#d4af37]/[0.08] blur-3xl lg:left-[-10%] lg:h-[28rem] lg:w-[28rem]" />
      <div className="pointer-events-none absolute -bottom-20 right-[-10%] h-72 w-72 rounded-full bg-[#3a0a12]/40 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1500px] flex-col justify-end px-5 pb-20 pt-40 sm:px-7 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-12 lg:pb-0 lg:pt-0">
        <div className="kais-mobile-hero-copy text-center lg:col-span-6 lg:py-24 lg:text-left xl:col-span-5">
          <div className="kais-rise kais-mobile-text-shadow flex items-center justify-center gap-3 lg:justify-start">
            <span className="block h-px w-10 kais-hairline" />
            <p className="kais-eyebrow">{event.event_type}</p>
            <span className="block h-px w-10 kais-hairline lg:hidden" />
          </div>

          {invitedGuestName ? (
            <p className="kais-rise-d1 mt-7 hidden text-[0.66rem] font-semibold uppercase tracking-[0.38em] text-[#f5ecd9]/55 sm:text-[0.7rem] lg:block">
              Para {invitedGuestName}
            </p>
          ) : null}

          <h1
            className="kais-rise-d1 kais-mobile-title-shadow mt-12 font-display font-light italic leading-[0.92] text-[#f5ecd9] drop-shadow-[0_8px_28px_rgba(0,0,0,0.6)] lg:mt-5"
            style={{ fontSize: "clamp(3.4rem, 12vw, 8.5rem)" }}
          >
            {event.hosts_names}
          </h1>

          <div className="kais-rise-d2 kais-mobile-text-shadow mt-12 flex items-center justify-center gap-4 lg:mt-8 lg:justify-start">
            <span className="block h-px w-12 kais-hairline" />
            <p className="font-display text-lg italic text-[#d4af37] sm:text-xl md:text-2xl">
              {formatDate(event.event_date)} <span className="text-[#d4af37]/60">·</span> {event.event_time}
            </p>
            <span className="block h-px w-12 kais-hairline lg:w-auto lg:max-w-[160px] lg:flex-1" />
          </div>

          <div className="kais-rise-d3 mt-10 hidden max-w-md sm:max-w-lg lg:block">
            <Countdown date={event.event_date} time={event.event_time} variant="luxe" />
          </div>

          <div className="kais-rise-d4 mt-12 flex flex-col items-stretch gap-6 lg:mt-12 lg:flex-row lg:items-center">
            <a href="#rsvp" className="kais-cta kais-mobile-cta-shadow w-full lg:w-auto">Confirmar asistencia</a>
            <div className="hidden flex-wrap items-center gap-x-7 gap-y-4 lg:flex">
              <a href={event.google_maps_link ?? "#detalles"} target="_blank" rel="noreferrer" className="kais-ghost-link">
                <MapPin className="h-3.5 w-3.5" />
                Cómo llegar
              </a>
              <a href={calendarUrl} target="_blank" rel="noreferrer" className="kais-ghost-link">
                <CalendarPlus className="h-3.5 w-3.5" />
                Calendario
              </a>
            </div>
          </div>
        </div>

        <div aria-hidden className="hidden lg:col-span-6 lg:block xl:col-span-7" />
      </div>

      {showScrollCue ? (
        <a
          href="#detalles"
          aria-label="Bajar a detalles"
          className="kais-scroll-pulse pointer-events-auto absolute inset-x-0 bottom-6 z-10 mx-auto flex w-fit flex-col items-center gap-1 text-[#d4af37]/80 hover:text-[#f5d572]"
        >
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.42em]">Descubrir</span>
          <ChevronDown className="h-4 w-4" />
        </a>
      ) : null}
    </section>
  );
}
