import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Camera, ChevronDown, MapPin, Send } from "lucide-react";
import { submitRsvp, trackVisit, uploadEventPhoto } from "@/app/actions/events";
import { Countdown } from "@/components/countdown";
import { EventMusicPlayer } from "@/components/event-music-player";
import { BackButton } from "@/components/back-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Event, EventGuest, EventPhoto, InvitationTemplate, Rsvp } from "@/lib/types";
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
    from?: string | string[];
  }>;
};

export default async function PublicEventPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("slug", slug).maybeSingle();
  const event = data as Event | null;

  if (!event || event.status !== "publicado") {
    return <NotPublishedScreen />;
  }

  const guestToken = normalizeSearchParam(query.guest);
  let invitedGuest: EventGuest | null = null;
  let invitedGuestRsvp: Rsvp | null = null;

  if (event.guest_mode === "lista_invitados") {
    console.info("[KAIS GUEST LINK]", { slug, guestToken, eventId: event.id, guestMode: event.guest_mode });

    if (!guestToken) {
      console.warn("[KAIS GUEST LINK] Invitacion sin token personal", { slug, eventId: event.id });
      return <PersonalLinkRequired />;
    }

    const admin = createAdminClient();
    const { data: guestData, error: guestError } = await admin
      .from("event_guests")
      .select("*")
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
      const { data: rsvpData } = await admin.from("rsvps").select("*").eq("id", invitedGuest.rsvp_id).maybeSingle();
      invitedGuestRsvp = (rsvpData ?? null) as Rsvp | null;
    }
  }

  const headerStore = await headers();
  await trackVisit(event.id, headerStore.get("user-agent"));

  const { data: photosData } = await supabase
    .from("event_photos")
    .select("*")
    .eq("event_id", event.id)
    .eq("status", "aprobada")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  const photos = (photosData ?? []) as EventPhoto[];

  const rsvpAction = submitRsvp.bind(null, event.id);
  const photoAction = uploadEventPhoto.bind(null, event.id, event.slug);
  const calendarUrl = buildCalendarUrl(event);
  const template = event.template_id ? await getInvitationTemplate(event.template_id) : null;
  const primary = template?.config.primary ?? event.theme_color;
  const secondary = template?.config.secondary ?? "#f8fafc";
  const heroImage = event.cover_image_url ?? event.mobile_cover_image_url ?? null;
  const heroImageMobile = event.mobile_cover_image_url ?? event.cover_image_url ?? null;
  const hasHeroCover = Boolean(heroImage || heroImageMobile);

  const rsvpStatus = normalizeSearchParam(query.rsvp);
  const rsvpError = normalizeSearchParam(query.rsvp_error);
  const photoStatus = normalizeSearchParam(query.foto);
  const photoError = normalizeSearchParam(query.foto_error);

  return (
    <main
      className="kais-stage relative font-sans"
      style={{ ["--template-primary" as string]: primary, ["--template-secondary" as string]: secondary }}
    >
      <div className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 sm:left-5">
        <BackButton from={normalizeSearchParam(query.from)} />
      </div>

      <div className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 sm:right-5">
        <EventMusicPlayer url={event.music_url} compact />
      </div>

      <section className="kais-grain relative isolate overflow-hidden" style={{ minHeight: "100svh" }}>
        <div className="absolute inset-0">
          {hasHeroCover ? (
            <>
              {heroImageMobile ? (
                <Image
                  src={heroImageMobile}
                  alt={`Portada de ${event.hosts_names}`}
                  fill
                  priority
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
                  sizes="(min-width: 1024px) 100vw, 0px"
                  className="hidden object-cover object-[68%_center] lg:block"
                />
              ) : null}
            </>
          ) : (
            <div
              className="h-full w-full"
              style={{ background: `linear-gradient(145deg, ${event.theme_color}, #1a0508 55%, #3a0a12)` }}
            />
          )}
          <div className="absolute inset-0 kais-veil-mobile lg:hidden" />
          <div className="absolute inset-0 hidden lg:block kais-veil-desktop" />
        </div>

        <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-[#d4af37]/[0.08] blur-3xl lg:left-[-10%] lg:h-[28rem] lg:w-[28rem]" />
        <div className="pointer-events-none absolute -bottom-20 right-[-10%] h-72 w-72 rounded-full bg-[#3a0a12]/40 blur-3xl" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1500px] flex-col justify-end px-5 pb-16 pt-36 sm:px-7 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-12 lg:pb-0 lg:pt-0">
          <div className="text-center lg:col-span-6 lg:py-24 lg:text-left xl:col-span-5">
            <div className="kais-rise flex items-center justify-center gap-3 lg:justify-start">
              <span className="block h-px w-10 kais-hairline" />
              <p className="kais-eyebrow">{event.event_type}</p>
              <span className="block h-px w-10 kais-hairline lg:hidden" />
            </div>

            {invitedGuest ? (
              <p className="kais-rise-d1 mt-7 hidden text-[0.66rem] font-semibold uppercase tracking-[0.38em] text-[#f5ecd9]/55 sm:text-[0.7rem] lg:block">
                Para {invitedGuest.guest_name}
              </p>
            ) : null}

            <h1
              className="kais-rise-d1 mt-10 font-display font-light italic leading-[0.92] text-[#f5ecd9] drop-shadow-[0_8px_28px_rgba(0,0,0,0.6)] lg:mt-5"
              style={{ fontSize: "clamp(3.4rem, 12vw, 8.5rem)" }}
            >
              {event.hosts_names}
            </h1>

            <div className="kais-rise-d2 mt-10 flex items-center justify-center gap-4 lg:mt-8 lg:justify-start">
              <span className="block h-px w-12 kais-hairline" />
              <p className="font-display text-lg italic text-[#d4af37] sm:text-xl md:text-2xl">
                {formatDate(event.event_date)} <span className="text-[#d4af37]/60">·</span> {event.event_time}
              </p>
              <span className="block h-px w-12 kais-hairline lg:w-auto lg:max-w-[160px] lg:flex-1" />
            </div>

            {event.main_message ? (
              <p className="kais-rise-d2 mt-7 hidden max-w-md text-[0.95rem] leading-[1.95] text-[#f5ecd9]/72 sm:max-w-lg lg:block">
                {event.main_message}
              </p>
            ) : null}

            <div className="kais-rise-d3 mt-10 hidden max-w-md sm:max-w-lg lg:block">
              <Countdown date={event.event_date} time={event.event_time} variant="luxe" />
            </div>

            <div className="kais-rise-d4 mt-14 flex flex-col items-stretch gap-6 lg:mt-12 lg:flex-row lg:items-center">
              <a href="#rsvp" className="kais-cta w-full lg:w-auto">Confirmar asistencia</a>
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

        <a
          href="#detalles"
          aria-label="Bajar a detalles"
          className="kais-scroll-pulse pointer-events-auto absolute inset-x-0 bottom-6 z-10 mx-auto flex w-fit flex-col items-center gap-1 text-[#d4af37]/80 hover:text-[#f5d572]"
        >
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.42em]">Descubrir</span>
          <ChevronDown className="h-4 w-4" />
        </a>
      </section>

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

          {event.main_message ? (
            <>
              <span className="mx-auto mt-14 block h-px w-16 kais-hairline" />
              <p className="mt-10 text-[0.95rem] leading-[1.95] text-[#f5ecd9]/72">{event.main_message}</p>
            </>
          ) : null}

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
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
      </section>

      <section id="detalles" className="kais-section">
        <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#3a0a12]/35 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-16 h-72 w-72 rounded-full bg-[#d4af37]/[0.06] blur-3xl" />

        <div className="relative mx-auto max-w-5xl text-center">
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
            <p className="mx-auto mt-8 max-w-2xl text-[0.95rem] leading-[2] text-[#f5ecd9]/72">{event.main_message}</p>
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

          {event.dress_code ? (
            <div className="mt-16">
              <p className="kais-eyebrow">Código de vestimenta</p>
              <p className="mt-3 font-display text-xl italic text-[#f5ecd9]/85 md:text-2xl">{event.dress_code}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section id="rsvp" className="kais-section bg-[#0a0405]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
        <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#d4af37]/[0.07] blur-3xl" />

        <div className="relative mx-auto grid max-w-5xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
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
              <span className="kais-gold-text kais-shimmer">más bonito.</span>
            </h2>

            <p className="mt-7 max-w-md text-[0.95rem] leading-[1.9] text-[#f5ecd9]/65">
              {invitedGuest
                ? `Hola ${invitedGuest.guest_name}, podés confirmar o editar tu respuesta cuando quieras.`
                : "Tu respuesta ayuda a los anfitriones a preparar cada detalle del evento."}
            </p>

            {rsvpStatus === "ok" ? (
              <p className="mt-7 inline-flex"><span className="kais-status-success">Confirmación recibida</span></p>
            ) : null}
            {rsvpError ? (
              <p className="mt-7 inline-flex"><span className="kais-status-error">{rsvpError}</span></p>
            ) : null}
          </div>

          <div className="kais-glass relative rounded-[2rem] p-7 sm:p-9 md:p-11">
            <form action={rsvpAction} className="grid gap-7">
              <input type="hidden" name="slug" value={event.slug} />
              <input type="hidden" name="guest_token" value={guestToken} />

              <LuxeField label="Nombre">
                <input
                  name="guest_name"
                  required
                  defaultValue={invitedGuest?.guest_name ?? ""}
                  readOnly={Boolean(invitedGuest)}
                  className="kais-input-luxe"
                />
              </LuxeField>

              <div className="grid gap-7 md:grid-cols-2">
                <LuxeField label="Telefono">
                  <input name="phone" defaultValue={invitedGuest?.phone ?? invitedGuestRsvp?.phone ?? ""} className="kais-input-luxe" />
                </LuxeField>
                <LuxeField label="Email">
                  <input name="email" type="email" defaultValue={invitedGuest?.email ?? invitedGuestRsvp?.email ?? ""} className="kais-input-luxe" />
                </LuxeField>
              </div>

              <div className="grid gap-7 md:grid-cols-2">
                <LuxeField label="Asistira?">
                  <select name="attending" defaultValue={invitedGuestRsvp?.attending === false ? "no" : "si"} className="kais-input-luxe">
                    <option value="si">Sí, con gusto</option>
                    <option value="no">No podré asistir</option>
                  </select>
                </LuxeField>
                <LuxeField label="Acompanantes">
                  <input
                    name="companions"
                    type="number"
                    min={0}
                    max={invitedGuest?.max_companions}
                    defaultValue={String(invitedGuestRsvp?.companions ?? 0)}
                    className="kais-input-luxe"
                  />
                </LuxeField>
              </div>

              <LuxeField label="Restriccion alimentaria">
                <input name="dietary_restrictions" placeholder="Opcional" defaultValue={invitedGuestRsvp?.dietary_restrictions ?? ""} className="kais-input-luxe" />
              </LuxeField>

              <LuxeField label="Mensaje para los anfitriones">
                <textarea name="message" rows={3} defaultValue={invitedGuestRsvp?.message ?? ""} className="kais-input-luxe resize-none" />
              </LuxeField>

              <div className="mt-2">
                <button type="submit" className="kais-cta w-full sm:w-fit">
                  <Send className="h-3.5 w-3.5" />
                  Enviar confirmación
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section id="fotos" className="kais-section">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />

        <div className="relative mx-auto grid max-w-5xl gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
              <span className="block h-px w-10 kais-hairline" />
              <p className="kais-eyebrow">Galería · Recuerdos</p>
            </div>

            <h2
              className="mt-7 font-display font-light italic leading-[0.95]"
              style={{ fontSize: "clamp(2.4rem, 4.8vw, 4rem)" }}
            >
              Compartí tus
              <br />
              <span className="kais-gold-text kais-shimmer">momentos.</span>
            </h2>

            <p className="mt-6 max-w-md text-[0.95rem] leading-[1.9] text-[#f5ecd9]/65">
              Subí las fotos que más te gustaron del evento. Aparecerán acá una vez aprobadas.
            </p>

            {photoStatus === "ok" ? (
              <p className="mt-6 inline-flex"><span className="kais-status-success">Foto recibida</span></p>
            ) : null}
            {photoError ? (
              <p className="mt-6 inline-flex"><span className="kais-status-error">{photoError}</span></p>
            ) : null}

            <form action={photoAction} className="kais-glass mt-9 grid gap-6 rounded-[1.6rem] p-6 sm:p-8">
              <LuxeField label="Tu nombre">
                <input name="guest_name" className="kais-input-luxe" />
              </LuxeField>
              <LuxeField label="Foto">
                <input name="photo" type="file" accept="image/*" required className="kais-input-luxe" />
              </LuxeField>
              <button type="submit" className="kais-cta w-full sm:w-fit">
                <Camera className="h-3.5 w-3.5" />
                Subir foto
              </button>
            </form>
          </div>

          <div>
            {photos.length === 0 ? (
              <div className="kais-glass flex min-h-[280px] flex-col items-center justify-center rounded-[1.6rem] p-10 text-center">
                <span className="block h-px w-10 kais-hairline" />
                <p className="kais-eyebrow mt-5">Próximamente</p>
                <p className="mt-4 max-w-xs font-display text-xl italic text-[#f5ecd9]/75">
                  Las fotos aprobadas aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {photos.map((photo, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={photo.public_url}
                    alt=""
                    loading="lazy"
                    className={`w-full object-cover transition-transform duration-700 hover:scale-[1.03] ${
                      i % 3 === 0 ? "aspect-[3/4]" : "aspect-[4/5]"
                    } rounded-2xl border border-[#d4af37]/15`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="relative px-5 py-14 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px kais-hairline" />
        <p className="kais-eyebrow text-[0.62rem]">Una experiencia de</p>
        <p className="mt-4 font-display text-2xl italic">
          <Link href="/" className="kais-gold-text kais-shimmer">KAIS Invitaciones</Link>
        </p>
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
    .select("*")
    .eq("id", templateId)
    .eq("active", true)
    .maybeSingle();
  return (data ?? null) as InvitationTemplate | null;
}

function normalizeSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").trim();
}
