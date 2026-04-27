import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Camera, MapPin, Send } from "lucide-react";
import { submitRsvp, trackVisit, uploadEventPhoto } from "@/app/actions/events";
import { Countdown } from "@/components/countdown";
import { EventMusicPlayer } from "@/components/event-music-player";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Event, EventGuest, EventPhoto, InvitationTemplate, Rsvp } from "@/lib/types";

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
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  const event = data as Event | null;

  if (!event || event.status !== "publicado") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">KAIS INVITACIONES</p>
          <h1 className="mt-3 font-display text-4xl font-bold">Esta invitacion aun no esta publicada</h1>
          <p className="mt-3 text-muted-foreground">Cuando el evento este en estado publicado, podras ver y compartir esta invitacion.</p>
        </div>
      </main>
    );
  }

  const guestToken = normalizeSearchParam(query.guest);
  let invitedGuest: EventGuest | null = null;
  let invitedGuestRsvp: Rsvp | null = null;

  if (event.guest_mode === "lista_invitados") {
    console.info("[KAIS GUEST LINK]", {
      slug,
      guestToken,
      eventId: event.id,
      guestMode: event.guest_mode
    });

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

    await admin.from("event_guests").update({ last_opened_at: new Date().toISOString() }).eq("id", invitedGuest.id);

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
  const isRedRoses = template?.slug === "rosas-rojas-15";
  const primary = template?.config.primary ?? event.theme_color;
  const secondary = template?.config.secondary ?? "#f8fafc";
  const hasHeroCover = Boolean(event.cover_image_url || event.mobile_cover_image_url);

  return (
    <main
      className="bg-[#080506] text-[#fff7ed]"
      style={{ ["--template-primary" as string]: primary, ["--template-secondary" as string]: secondary }}
    >
      <div className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 sm:left-4">
        <BackButton from={normalizeSearchParam(query.from)} />
      </div>
      <section
        className={`relative min-h-[100svh] overflow-hidden bg-[#080506] text-white shadow-soft md:flex md:min-h-[92vh] md:items-end md:px-4 md:py-6 lg:px-0 lg:py-0 ${isRedRoses ? "border-b border-[#d4af37]/35" : ""}`}
        style={!hasHeroCover ? { background: isRedRoses ? "linear-gradient(145deg, #170607, #4c0710 55%, #8b0000)" : `linear-gradient(145deg, ${event.theme_color}, #155e75 58%, #e11d48)` } : undefined}
      >
        {isRedRoses ? (
          <div className="hidden md:block lg:hidden">
            <RedRosesFrame />
          </div>
        ) : null}
        {event.mobile_cover_image_url || event.cover_image_url ? (
          <>
            {event.mobile_cover_image_url ? (
              <Image
                src={event.mobile_cover_image_url}
                alt={`Foto de portada movil de ${event.hosts_names}`}
                fill
                priority
                sizes="100vw"
                style={{ objectPosition: "center top" }}
                className={`hidden object-cover transition-transform duration-700 ease-out md:block lg:hidden ${event.cover_image_url ? "md:hidden" : ""}`}
              />
            ) : null}
            {event.cover_image_url ? (
              <Image
                src={event.cover_image_url}
                alt={`Foto de portada de ${event.hosts_names}`}
                fill
                priority
                sizes="100vw"
                className={`hidden object-cover transition-transform duration-700 ease-out md:block lg:hidden ${event.mobile_cover_image_url ? "md:block" : ""}`}
              />
            ) : null}
            <div className={`absolute inset-0 hidden md:block lg:hidden ${isRedRoses ? "bg-black/45" : "bg-black/40"}`} />
            <div className={`absolute inset-0 hidden md:block lg:hidden ${isRedRoses ? "bg-gradient-to-t from-[#170607] via-black/35 to-[#8b0000]/20" : "bg-gradient-to-t from-black/80 via-black/35 to-black/15"}`} />
          </>
        ) : null}
        <div
          className="absolute inset-0 min-h-[100svh] overflow-hidden md:hidden"
          style={!hasHeroCover ? { background: isRedRoses ? "linear-gradient(145deg, #170607, #4c0710 55%, #8b0000)" : `linear-gradient(145deg, ${event.theme_color}, #155e75 58%, #e11d48)` } : undefined}
        >
          {event.mobile_cover_image_url || event.cover_image_url ? (
            <Image
              src={event.mobile_cover_image_url ?? event.cover_image_url ?? ""}
              alt={`Foto de portada de ${event.hosts_names}`}
              fill
              priority
              sizes="100vw"
              style={{ objectPosition: "center top" }}
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-[#080506]/92" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#080506] via-[#170607]/70 to-transparent" />
        </div>
        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-4 pb-7 pt-24 text-center md:hidden">
          <div className="pointer-events-none absolute bottom-40 left-4 h-28 w-28 rounded-full bg-[#8b0000]/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-24 right-3 h-24 w-24 rounded-full bg-[#d4af37]/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-8 bottom-3 h-px bg-gradient-to-r from-transparent via-[#d4af37]/70 to-transparent" />
          <div className="relative z-10 kais-fade-up">
          <p className={`text-[0.68rem] font-bold uppercase tracking-[0.32em] drop-shadow ${isRedRoses ? "text-[#d4af37]" : "text-[#facc15]"}`}>{event.event_type}</p>
          {invitedGuest ? <p className="mx-auto mt-3 max-w-xs text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Hola, {invitedGuest.guest_name}</p> : null}
          <h1 className={`mx-auto mt-4 line-clamp-2 max-w-[21rem] font-display text-[clamp(3.2rem,15vw,5rem)] font-bold leading-[0.86] drop-shadow-[0_8px_26px_rgba(0,0,0,0.72)] ${isRedRoses ? "text-[#fff7ed]" : "text-white"}`}>
            {event.hosts_names}
          </h1>
          <p className={`mt-4 text-base font-semibold ${isRedRoses ? "text-[#facc15]" : "text-white/90"}`}>{formatDate(event.event_date)} · {event.event_time}</p>
          <p className="mx-auto mt-4 line-clamp-2 max-w-sm text-sm leading-7 text-white/82 drop-shadow">{event.main_message}</p>
          <div className="mt-6 rounded-2xl border border-white/18 bg-black/20 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md">
            <Countdown date={event.event_date} time={event.event_time} compact />
          </div>
          <div className="mt-4">
            <EventMusicPlayer url={event.music_url} compact />
          </div>

          <div className="mt-5 grid gap-3">
            <Button asChild className="border border-[#facc15]/30 bg-[#d4af37] text-[#170607] shadow-[0_12px_28px_rgba(212,175,55,0.22)] hover:bg-[#facc15]">
              <a href="#rsvp">Confirmar asistencia</a>
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" asChild className="bg-[#fff7ed] text-[#3f080d] hover:bg-white">
                <a href={event.google_maps_link ?? "#detalles"} target="_blank">
                  <MapPin className="h-4 w-4" />
                  Cómo llegar
                </a>
              </Button>
              <Button variant="outline" className="border-[#d4af37]/35 bg-white/10 text-white backdrop-blur hover:bg-white/20" asChild>
                <a href={calendarUrl} target="_blank">
                  <CalendarPlus className="h-4 w-4" />
                  Calendario
                </a>
              </Button>
            </div>
          </div>
        </div>
        </div>
        <div className="relative z-10 mx-auto hidden w-full max-w-5xl gap-8 pb-8 text-center md:grid md:text-left lg:hidden">
          <div className="mx-auto max-w-3xl md:mx-0">
            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isRedRoses ? "text-[#d4af37]" : "text-white/75"}`}>{event.event_type}</p>
            <h1 className={`mt-4 font-display text-6xl font-bold leading-none drop-shadow md:text-8xl ${isRedRoses ? "text-[#fff7ed]" : ""}`}>{event.hosts_names}</h1>
            <p className={`mt-4 text-lg font-semibold ${isRedRoses ? "text-[#facc15]" : "text-white/90"}`}>{formatDate(event.event_date)} · {event.event_time}</p>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/80 md:mx-0">{event.main_message}</p>
          </div>
          <Countdown date={event.event_date} time={event.event_time} />
          <EventMusicPlayer url={event.music_url} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Button asChild>
              <a href="#rsvp">Confirmar asistencia</a>
            </Button>
            <Button variant="secondary" asChild>
              <a href={event.google_maps_link ?? "#detalles"} target="_blank">
                <MapPin className="h-4 w-4" />
                Cómo llegar
              </a>
            </Button>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" asChild>
              <a href={calendarUrl} target="_blank">
                <CalendarPlus className="h-4 w-4" />
                Agregar al calendario
              </a>
            </Button>
          </div>
        </div>
        <div className="relative z-10 mx-auto hidden min-h-[100vh] w-full max-w-[1500px] grid-cols-[0.82fr_1.18fr] items-center gap-12 px-10 py-12 lg:grid xl:gap-16">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-[54%] bg-gradient-to-r from-black/95 via-[#170607]/82 to-transparent" />
          <div className="pointer-events-none absolute left-12 top-16 h-52 w-52 rounded-full bg-[#8b0000]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-16 left-1/3 h-36 w-36 rounded-full bg-[#d4af37]/14 blur-3xl" />
          <div className="relative z-10 max-w-2xl kais-fade-up">
            <p className={`text-xs font-bold uppercase tracking-[0.28em] ${isRedRoses ? "text-[#d4af37]" : "text-white/70"}`}>{event.event_type}</p>
            {invitedGuest ? <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Hola, {invitedGuest.guest_name}</p> : null}
            <h1 className={`mt-5 max-w-2xl font-display text-[clamp(5rem,8vw,9rem)] font-bold leading-[0.84] drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)] ${isRedRoses ? "text-[#fff7ed]" : "text-white"}`}>
              {event.hosts_names}
            </h1>
            <p className={`mt-6 text-xl font-semibold ${isRedRoses ? "text-[#facc15]" : "text-white/90"}`}>{formatDate(event.event_date)} · {event.event_time}</p>
            <p className="mt-5 line-clamp-2 max-w-xl text-base leading-8 text-white/72">{event.main_message}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="border border-[#facc15]/35 bg-[#d4af37] px-7 text-[#170607] shadow-[0_18px_45px_rgba(212,175,55,0.2)] hover:bg-[#facc15]">
                <a href="#rsvp">Confirmar asistencia</a>
              </Button>
              <Button variant="secondary" asChild>
                <a href={event.google_maps_link ?? "#detalles"} target="_blank">
                  <MapPin className="h-4 w-4" />
                  Cómo llegar
                </a>
              </Button>
              <Button variant="outline" className="border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20" asChild>
                <a href={calendarUrl} target="_blank">
                  <CalendarPlus className="h-4 w-4" />
                  Calendario
                </a>
              </Button>
            </div>

            <div className="mt-8 max-w-xl rounded-2xl border border-white/15 bg-white/10 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <Countdown date={event.event_date} time={event.event_time} compact />
            </div>
            <div className="mt-5 max-w-2xl">
              <EventMusicPlayer url={event.music_url} compact />
            </div>
          </div>

          <div className="relative z-10 h-[84vh] min-h-[620px] overflow-hidden rounded-[2rem] border border-[#d4af37]/18 bg-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.48)] kais-fade-up-delay kais-soft-float">
            {event.cover_image_url || event.mobile_cover_image_url ? (
              <Image
                src={event.cover_image_url ?? event.mobile_cover_image_url ?? ""}
                alt={`Foto de portada de ${event.hosts_names}`}
                fill
                priority
                sizes="52vw"
                className="object-cover transition-transform duration-[1600ms] hover:scale-[1.025]"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: isRedRoses ? "linear-gradient(145deg, #170607, #4c0710 55%, #8b0000)" : `linear-gradient(145deg, ${event.theme_color}, #155e75 58%, #e11d48)` }}
              />
            )}
          </div>
        </div>
      </section>

      <section className="section relative overflow-hidden bg-[#080506] text-[#fff7ed]" id="detalles">
        <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-[#8b0000]/18 blur-3xl" />
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            ["Fecha", formatDate(event.event_date)],
            ["Hora", event.event_time],
            ["Lugar", event.address]
          ].map(([label, value]) => (
            <Card key={label} className="kais-luxury-panel rounded-2xl bg-transparent text-[#fff7ed] transition-transform duration-300 hover:-translate-y-1">
              <CardHeader><CardTitle className="text-sm uppercase tracking-[0.22em] text-[#d4af37]">{label}</CardTitle></CardHeader>
              <CardContent className="text-[#fff7ed]/78">{value}</CardContent>
            </Card>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d4af37]">Mensaje especial</p>
          <h2 className="mt-4 font-display text-4xl font-bold md:text-6xl">{event.title}</h2>
          <p className="mt-6 leading-8 text-[#fff7ed]/72">{event.main_message}</p>
          {event.dress_code ? <p className="mt-5 font-semibold">Código de vestimenta: {event.dress_code}</p> : null}
        </div>
      </section>

      <section className="section bg-[#120708] text-[#fff7ed]" id="rsvp">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d4af37]">RSVP</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">Confirma tu asistencia</h2>
            <p className="mt-4 text-[#fff7ed]/70">
              {invitedGuest ? `Hola, ${invitedGuest.guest_name}. Puedes confirmar o editar tu respuesta.` : "Tu respuesta ayuda a los anfitriones a preparar cada detalle."}
            </p>
            {normalizeSearchParam(query.rsvp) === "ok" ? <StatusMessage variant="success">Confirmación recibida.</StatusMessage> : null}
            {normalizeSearchParam(query.rsvp_error) ? <StatusMessage variant="error">{normalizeSearchParam(query.rsvp_error)}</StatusMessage> : null}
          </div>
          <Card className="kais-luxury-panel rounded-2xl bg-transparent text-[#fff7ed]">
            <CardContent className="p-6">
              <form action={rsvpAction} className="grid gap-4">
                <input type="hidden" name="slug" value={event.slug} />
                <input type="hidden" name="guest_token" value={guestToken} />
                <Field label="Nombre">
                  <Input name="guest_name" required defaultValue={invitedGuest?.guest_name ?? ""} readOnly={Boolean(invitedGuest)} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Teléfono">
                    <Input name="phone" defaultValue={invitedGuest?.phone ?? invitedGuestRsvp?.phone ?? ""} />
                  </Field>
                  <Field label="Email">
                    <Input name="email" type="email" defaultValue={invitedGuest?.email ?? invitedGuestRsvp?.email ?? ""} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="¿Asistirá?">
                    <Select name="attending" defaultValue={invitedGuestRsvp?.attending === false ? "no" : "si"}>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </Select>
                  </Field>
                  <Field label="Acompañantes">
                    <Input name="companions" type="number" min="0" max={invitedGuest?.max_companions} defaultValue={String(invitedGuestRsvp?.companions ?? 0)} />
                  </Field>
                </div>
                <Field label="Restricción alimentaria">
                  <Input name="dietary_restrictions" placeholder="Opcional" defaultValue={invitedGuestRsvp?.dietary_restrictions ?? ""} />
                </Field>
                <Field label="Mensaje">
                  <Textarea name="message" defaultValue={invitedGuestRsvp?.message ?? ""} />
                </Field>
                <Button className="bg-[#d4af37] text-[#170607] hover:bg-[#facc15]">
                  <Send className="h-4 w-4" />
                  Enviar confirmación
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section bg-[#080506] text-[#fff7ed]" id="fotos">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d4af37]">Galería</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">Comparte fotos del evento</h2>
            {normalizeSearchParam(query.foto) === "ok" ? <StatusMessage variant="success">Foto recibida para moderación.</StatusMessage> : null}
            {normalizeSearchParam(query.foto_error) ? <StatusMessage variant="error">{normalizeSearchParam(query.foto_error)}</StatusMessage> : null}
            <form action={photoAction} className="kais-luxury-panel mt-6 grid gap-4 rounded-2xl p-5">
              <Field label="Tu nombre">
                <Input name="guest_name" />
              </Field>
              <Field label="Foto">
                <Input name="photo" type="file" accept="image/*" required />
              </Field>
              <Button className="bg-[#d4af37] text-[#170607] hover:bg-[#facc15]">
                <Camera className="h-4 w-4" />
                Subir fotos
              </Button>
            </form>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <img key={photo.id} src={photo.public_url} alt="" className="aspect-[4/3] rounded-2xl border border-[#d4af37]/15 object-cover shadow-2xl" />
            ))}
            {photos.length === 0 ? <p className="text-sm text-[#fff7ed]/65">Las fotos aprobadas aparecerán aquí.</p> : null}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d4af37]/15 bg-[#080506] px-4 py-8 text-center text-sm text-[#fff7ed]/55">
        Powered by <Link href="/" className="font-bold text-[#d4af37]">KAIS INVITACIONES</Link>
      </footer>
    </main>
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
  const { data } = await admin.from("invitation_templates").select("*").eq("id", templateId).eq("active", true).maybeSingle();
  return (data ?? null) as InvitationTemplate | null;
}

function RedRosesFrame() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[#170607] to-transparent" />
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-44 w-44 rounded-br-full border-b border-r border-[#d4af37]/25 bg-[radial-gradient(circle_at_25%_25%,#991b1b_0_12%,transparent_13%),radial-gradient(circle_at_50%_35%,#7f1d1d_0_10%,transparent_11%)] opacity-80" />
      <div className="pointer-events-none absolute bottom-0 right-0 z-10 h-52 w-52 rounded-tl-full border-l border-t border-[#d4af37]/25 bg-[radial-gradient(circle_at_75%_75%,#b91c1c_0_11%,transparent_12%),radial-gradient(circle_at_55%_60%,#7f1d1d_0_10%,transparent_11%)] opacity-80" />
    </>
  );
}

function normalizeSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").trim();
}

function StatusMessage({ children, variant }: { children: string; variant: "success" | "error" }) {
  const styles =
    variant === "success"
      ? "border-green-200 bg-green-50 text-green-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <p className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${styles}`}>
      {children}
    </p>
  );
}

function PersonalLinkRequired() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">KAIS INVITACIONES</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Esta invitacion requiere enlace personal.</h1>
        <p className="mt-3 text-muted-foreground">Abre el enlace que recibiste por WhatsApp para confirmar asistencia.</p>
      </div>
    </main>
  );
}

function InvalidPersonalLink() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">KAIS INVITACIONES</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Este enlace personal no es válido.</h1>
        <p className="mt-3 text-muted-foreground">Verifica que abriste el enlace completo enviado por WhatsApp.</p>
      </div>
    </main>
  );
}

function InactivePersonalLink() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">KAIS INVITACIONES</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Este enlace ya no esta activo.</h1>
        <p className="mt-3 text-muted-foreground">Contacta a los anfitriones si necesitas ayuda con tu invitacion.</p>
      </div>
    </main>
  );
}
