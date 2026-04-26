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
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Event, EventPhoto } from "@/lib/types";

export default async function PublicEventPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsvp?: string; rsvp_error?: string; foto?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
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

  return (
    <main className="bg-background">
      <div className="fixed left-3 top-3 z-50">
        <BackButton />
      </div>
      <section
        className="relative flex min-h-[92vh] items-end overflow-hidden px-4 py-6 text-white shadow-soft"
        style={!event.cover_image_url ? { background: `linear-gradient(145deg, ${event.theme_color}, #155e75 58%, #e11d48)` } : undefined}
      >
        {event.cover_image_url ? (
          <>
            <Image
              src={event.cover_image_url}
              alt={`Foto de portada de ${event.hosts_names}`}
              fill
              priority
              sizes="100vw"
              className="object-cover transition-transform duration-700 ease-out"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
          </>
        ) : null}
        <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-8 pb-8 text-center md:text-left">
          <div className="mx-auto max-w-3xl md:mx-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/75">{event.event_type}</p>
            <h1 className="mt-4 font-display text-6xl font-bold leading-none drop-shadow md:text-8xl">{event.hosts_names}</h1>
            <p className="mt-4 text-lg font-semibold text-white/90">{formatDate(event.event_date)} · {event.event_time}</p>
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
      </section>

      <section className="section" id="detalles">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            ["Fecha", formatDate(event.event_date)],
            ["Hora", event.event_time],
            ["Lugar", event.address]
          ].map(([label, value]) => (
            <Card key={label}>
              <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground">{value}</CardContent>
            </Card>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Mensaje especial</p>
          <h2 className="mt-3 font-display text-4xl font-bold">{event.title}</h2>
          <p className="mt-5 leading-8 text-muted-foreground">{event.main_message}</p>
          {event.dress_code ? <p className="mt-5 font-semibold">Código de vestimenta: {event.dress_code}</p> : null}
        </div>
      </section>

      <section className="section bg-white" id="rsvp">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">RSVP</p>
            <h2 className="mt-3 font-display text-4xl font-bold">Confirma tu asistencia</h2>
            <p className="mt-4 text-muted-foreground">Tu respuesta ayuda a los anfitriones a preparar cada detalle.</p>
            {query.rsvp === "ok" ? <p className="mt-4 rounded-md bg-secondary p-3 text-sm font-semibold">Confirmación recibida.</p> : null}
            {query.rsvp_error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{query.rsvp_error}</p> : null}
          </div>
          <Card>
            <CardContent className="p-6">
              <form action={rsvpAction} className="grid gap-4">
                <input type="hidden" name="slug" value={event.slug} />
                <Field label="Nombre">
                  <Input name="guest_name" required />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Teléfono">
                    <Input name="phone" />
                  </Field>
                  <Field label="Email">
                    <Input name="email" type="email" />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="¿Asistirá?">
                    <Select name="attending" defaultValue="si">
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </Select>
                  </Field>
                  <Field label="Acompañantes">
                    <Input name="companions" type="number" min="0" defaultValue="0" />
                  </Field>
                </div>
                <Field label="Restricción alimentaria">
                  <Input name="dietary_restrictions" placeholder="Opcional" />
                </Field>
                <Field label="Mensaje">
                  <Textarea name="message" />
                </Field>
                <Button>
                  <Send className="h-4 w-4" />
                  Enviar confirmación
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section bg-muted/60" id="fotos">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Galería</p>
            <h2 className="mt-3 font-display text-4xl font-bold">Comparte fotos del evento</h2>
            {query.foto === "ok" ? <p className="mt-4 rounded-md bg-white p-3 text-sm font-semibold">Foto recibida para moderación.</p> : null}
            <form action={photoAction} className="mt-6 grid gap-4 rounded-lg border bg-white p-5">
              <Field label="Tu nombre">
                <Input name="guest_name" />
              </Field>
              <Field label="Foto">
                <Input name="photo" type="file" accept="image/*" required />
              </Field>
              <Button>
                <Camera className="h-4 w-4" />
                Subir fotos
              </Button>
            </form>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <img key={photo.id} src={photo.public_url} alt="" className="aspect-[4/3] rounded-lg object-cover" />
            ))}
            {photos.length === 0 ? <p className="text-sm text-muted-foreground">Las fotos aprobadas aparecerán aquí.</p> : null}
          </div>
        </div>
      </section>

      <footer className="border-t bg-white px-4 py-8 text-center text-sm text-muted-foreground">
        Powered by <Link href="/" className="font-bold text-foreground">KAIS INVITACIONES</Link>
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
