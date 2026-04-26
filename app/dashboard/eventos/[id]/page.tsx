import Link from "next/link";
import { ArrowLeft, Check, Download, ExternalLink, ImageIcon, KeyRound, LayoutDashboard, QrCode, UserCheck, X } from "lucide-react";
import {
  createEventLogin,
  resetEventLoginPassword,
  toggleEventLoginActive,
  updateEventLoginExpiration
} from "@/app/actions/event-logins";
import { approvePhoto, deleteEvent, updateEvent } from "@/app/actions/events";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DeleteEventButton } from "@/components/delete-event-button";
import { EventForm } from "@/components/event-form";
import { QrDownload } from "@/components/qr-download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserProfile, isKaisAdmin } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventLogin, EventPhoto, Rsvp } from "@/lib/types";
import { absoluteUrl, buildCredentialsMessage, publicEventUrl } from "@/lib/utils";

export default async function EventDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    login_username?: string;
    login_password?: string;
    access_existing?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const admin = createAdminClient();
  const { profile } = await getCurrentUserProfile();
  const canManageClientAccess = isKaisAdmin(profile?.role);
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
  const { data: loginData } = canManageClientAccess
    ? await admin.from("event_logins").select("*").eq("event_id", event.id).order("created_at", { ascending: false })
    : { data: [] };
  const eventLogins = (loginData ?? []) as EventLogin[];
  const latestCredentials =
    query.login_username && query.login_password
      ? buildCredentialsMessage(query.login_username, query.login_password)
      : null;

  const url = publicEventUrl(event.slug);
  const clientPanelUrl = absoluteUrl("/evento-login");
  const update = updateEvent.bind(null, event.id);

  return (
    <div className="grid gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Volver a eventos
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Ir al dashboard
              </Link>
            </Button>
          </div>
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
          <CopyLinkButton value={url} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Acceso del cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {!canManageClientAccess ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              Tu sesion esta activa, pero tu rol actual es <span className="font-semibold">{profile?.role ?? "sin perfil"}</span>. Para generar accesos de cliente necesitas rol admin o admin_kais.
            </div>
          ) : null}
          <div className="rounded-lg border bg-background p-4">
            <p className="text-sm font-semibold">Panel del cliente</p>
            <p className="mt-2 break-all text-sm text-muted-foreground">{clientPanelUrl}</p>
          </div>
          {latestCredentials ? (
            <div className="rounded-lg border bg-secondary p-4">
              <p className="font-semibold">Credenciales generadas</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-foreground">{latestCredentials}</pre>
              <div className="mt-3">
                <CopyLinkButton value={latestCredentials} label="Copiar acceso para WhatsApp" copiedLabel="Acceso copiado" />
              </div>
            </div>
          ) : null}
          {query.access_existing ? (
            <div className="rounded-lg border bg-background p-4">
              <p className="font-semibold">Este evento ya tiene acceso creado</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Usuario: <span className="font-semibold text-foreground">{query.access_existing}</span>. Usa resetear contrasena si necesitas enviar una nueva clave.
              </p>
            </div>
          ) : null}

          {canManageClientAccess ? (
            <form action={createEventLogin.bind(null, event.id)}>
              <Button className="w-full sm:w-fit">
                <KeyRound className="h-4 w-4" />
                Generar acceso del cliente
              </Button>
            </form>
          ) : null}

          <div className="grid gap-3">
            {eventLogins.map((login) => (
              <div key={login.id} className="grid gap-4 rounded-lg border bg-background p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="font-semibold">{login.username}</p>
                  <p className="text-sm text-muted-foreground">
                    Estado: {login.active ? "activo" : "desactivado"} · Expira: {login.expires_at ? new Date(login.expires_at).toLocaleString("es-PY") : "sin expiracion"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ultimo ingreso: {login.last_login_at ? new Date(login.last_login_at).toLocaleString("es-PY") : "sin ingresos"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <form action={resetEventLoginPassword.bind(null, login.id, event.id)}>
                    <Button variant="outline" size="sm">Reset contrasena</Button>
                  </form>
                  <form action={toggleEventLoginActive.bind(null, login.id, event.id, !login.active)}>
                    <Button variant={login.active ? "danger" : "outline"} size="sm">
                      {login.active ? "Desactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
                <form action={updateEventLoginExpiration.bind(null, login.id, event.id)} className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
                  <input
                    name="expires_at"
                    type="datetime-local"
                    className="h-10 rounded-md border bg-white px-3 text-sm"
                    defaultValue={login.expires_at ? login.expires_at.slice(0, 16) : ""}
                  />
                  <Button variant="outline" size="sm">Guardar expiracion</Button>
                </form>
              </div>
            ))}
            {eventLogins.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay acceso de cliente para este evento.</p> : null}
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

      {canManageClientAccess ? (
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle>Zona de riesgo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Eliminar este evento borrara tambien sus RSVP, fotos y accesos del cliente. Esta accion no se puede deshacer.
            </p>
            <DeleteEventButton action={deleteEvent.bind(null, event.id)} />
          </CardContent>
        </Card>
      ) : null}

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
                    {photo.is_approved ? "Rechazar" : "Aprobar"}
                  </Button>
                </form>
                <span className="text-xs text-muted-foreground">{photo.status} · {photo.is_public ? "publica" : "privada"}</span>
              </div>
            </div>
          ))}
          {photos.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay fotos.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
