import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ExternalLink, ImageIcon, Lock, QrCode, UserCheck, X } from "lucide-react";
import {
  approveEventPhoto,
  eventLoginSignOut,
  makeEventPhotoPrivate,
  rejectEventPhoto
} from "@/app/actions/event-logins";
import { CopyLinkButton } from "@/components/copy-link-button";
import { QrDownload } from "@/components/qr-download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventLoginSession } from "@/lib/event-login-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventPhoto, Rsvp } from "@/lib/types";
import { formatDate, publicEventUrl } from "@/lib/utils";

export default async function PanelEventoPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [login, query] = await Promise.all([getEventLoginSession(), searchParams]);

  if (!login) {
    redirect("/evento-login?error=Inicia sesion para entrar al panel.");
  }

  const admin = createAdminClient();
  const [{ data: event }, { data: rsvpsData }, { data: photosData }] = await Promise.all([
    admin.from("events").select("*").eq("id", login.event_id).single(),
    admin.from("rsvps").select("*").eq("event_id", login.event_id).order("created_at", { ascending: false }),
    admin.from("event_photos").select("*").eq("event_id", login.event_id).order("created_at", { ascending: false })
  ]);

  if (!event) {
    redirect("/evento-login?error=Evento no encontrado.");
  }

  const typedEvent = event as Event;
  const typedRsvps = (rsvpsData ?? []) as Rsvp[];
  const typedPhotos = (photosData ?? []) as EventPhoto[];
  const url = publicEventUrl(typedEvent.slug);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/panel-evento" className="text-sm font-black tracking-[0.22em]">
            KAIS INVITACIONES
          </Link>
          <form action={eventLoginSignOut}>
            <Button variant="outline" size="sm">
              <Lock className="h-4 w-4" />
              Cerrar sesion
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Panel del evento</p>
          <h1 className="font-display text-4xl font-bold">{typedEvent.title}</h1>
          <p className="mt-2 text-muted-foreground">
            {typedEvent.hosts_names} · {formatDate(typedEvent.event_date)} · {typedEvent.event_time}
          </p>
          {query.error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p> : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invitacion publica</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="break-all text-sm text-muted-foreground">{url}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={`/evento/${typedEvent.slug}`}>
                  <ExternalLink className="h-4 w-4" />
                  Ver invitacion publica
                </Link>
              </Button>
              <CopyLinkButton value={url} />
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-4 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-accent" />
                <p className="font-semibold">Descargar QR</p>
              </div>
              <QrDownload value={url} filename={`kais-${typedEvent.slug}`} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>RSVP</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{typedRsvps.length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Asisten</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{typedRsvps.filter((rsvp) => rsvp.attending).length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Fotos</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{typedPhotos.length}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" /> Confirmaciones</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="mb-4">
              <Button variant="outline" asChild>
                <a href="/api/panel-evento/rsvps.csv">Descargar CSV</a>
              </Button>
            </div>
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
                {typedRsvps.map((rsvp) => (
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
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Moderar fotos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {typedPhotos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-lg border bg-background">
                <img src={photo.public_url} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="grid gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{photo.guest_name || "Invitado"}</p>
                    <p className="text-muted-foreground">Estado: {photo.status} · {photo.is_public ? "publica" : "privada"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={approveEventPhoto.bind(null, photo.id)}>
                      <Button size="sm">
                        <Check className="h-4 w-4" />
                        Aprobar
                      </Button>
                    </form>
                    <form action={makeEventPhotoPrivate.bind(null, photo.id)}>
                      <Button size="sm" variant="outline">Privada</Button>
                    </form>
                    <form action={rejectEventPhoto.bind(null, photo.id)}>
                      <Button size="sm" variant="danger">
                        <X className="h-4 w-4" />
                        Rechazar
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
            {typedPhotos.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay fotos subidas.</p> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
