import Link from "next/link";
import { Check, Download, ExternalLink, ImageIcon, QrCode, UserCheck, X } from "lucide-react";
import { approvePhoto, updateEvent } from "@/app/actions/events";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EventForm } from "@/components/event-form";
import { QrDownload } from "@/components/qr-download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Event, EventPhoto, Rsvp } from "@/lib/types";
import { publicEventUrl } from "@/lib/utils";

export default async function EventDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", id).single();
  const event = data as Event | null;
  if (!event) return <p>Evento no encontrado.</p>;

  const [{ data: rsvpsData }, { data: photosData }, { count: visits = 0 }] = await Promise.all([
    supabase.from("rsvps").select("*").eq("event_id", event.id).order("created_at", { ascending: false }),
    supabase.from("event_photos").select("*").eq("event_id", event.id).order("created_at", { ascending: false }),
    supabase.from("analytics_visits").select("*", { count: "exact", head: true }).eq("event_id", event.id)
  ]);
  const rsvps = (rsvpsData ?? []) as Rsvp[];
  const photos = (photosData ?? []) as EventPhoto[];

  const url = publicEventUrl(event.slug);
  const update = updateEvent.bind(null, event.id);

  return (
    <div className="grid gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Evento</p>
          <h1 className="font-display text-4xl font-bold">{event.title}</h1>
          <p className="mt-2 break-all text-sm text-muted-foreground">{url}</p>
          {query.error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p> : null}
          {query.saved ? <p className="mt-3 rounded-md bg-secondary p-3 text-sm font-semibold">Evento guardado correctamente.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/evento/${event.slug}`}>
              <ExternalLink className="h-4 w-4" />
              Ver invitacion publica
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/events/${event.id}/rsvps.csv`}>
              <Download className="h-4 w-4" />
              CSV
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publicacion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-[0.75fr_1.25fr] md:items-center">
            <div>
              <p className="text-sm text-muted-foreground">Estado actual</p>
              <p className="mt-1 text-2xl font-bold capitalize">{event.status}</p>
              {event.status === "publicado" ? (
                <p className="mt-2 text-sm text-muted-foreground">La invitacion publica esta disponible para compartir.</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Cambia el estado a publicado para compartir la invitacion con invitados.</p>
              )}
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">URL publica completa</p>
              <p className="mt-2 break-all text-sm text-muted-foreground">{url}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href={`/evento/${event.slug}`}>
                    <ExternalLink className="h-4 w-4" />
                    Ver invitacion publica
                  </Link>
                </Button>
                <CopyLinkButton value={url} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <div className="mb-4 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-accent" />
              <p className="font-semibold">Descargar QR</p>
            </div>
            <QrDownload value={url} filename={`kais-${event.slug}`} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>RSVP</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{rsvps.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Asisten</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{rsvps.filter((r) => r.attending).length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Fotos</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{photos.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Visitas</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{visits ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editar datos</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm action={update} event={event} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" /> Confirmaciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-3">Nombre</th>
                <th>Asistira</th>
                <th>Acompanantes</th>
                <th>Contacto</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {rsvps.map((rsvp) => (
                <tr key={rsvp.id} className="border-b">
                  <td className="py-3 font-medium">{rsvp.guest_name}</td>
                  <td>{rsvp.attending ? "Si" : "No"}</td>
                  <td>{rsvp.companions}</td>
                  <td>{rsvp.email || rsvp.phone || "-"}</td>
                  <td>{rsvp.message || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Fotos subidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg border bg-background">
              <img src={photo.public_url} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between p-3 text-sm">
                <span>{photo.guest_name || "Invitado"}</span>
                <form action={approvePhoto.bind(null, photo.id, event.id, !photo.is_approved)}>
                  <Button size="sm" variant={photo.is_approved ? "outline" : "default"}>
                    {photo.is_approved ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {photo.is_approved ? "Ocultar" : "Aprobar"}
                  </Button>
                </form>
              </div>
            </div>
          ))}
          {photos.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay fotos.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
