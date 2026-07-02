/**
 * DetallesSection -- deferred async Server Component
 *
 * mode="publicacion"  -> solo card de publicacion (URL, QR, estado, pub/unpub)
 * mode="ajustes"      -> editar datos + zona de riesgo
 * (sin mode / "full") -> ambas (legacy)
 *
 * eventClient puede pasarse desde la pagina para evitar fetch extra.
 */
import Link from "next/link";
import { ExternalLink, Eye, GlobeLock, Globe, Pencil, QrCode } from "lucide-react";
import { updateEvent, deleteEvent } from "@/app/actions/events";
import { setEventStatus } from "@/app/actions/event-status";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DeleteEventButton } from "@/components/delete-event-button";
import { DeleteEventForm } from "@/components/delete-event-form";
import { QrDownload } from "@/components/qr-download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";
import { listD1Clients, listD1EventCategories, listD1InvitationThemes } from "@/lib/cloudflare/public-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActiveCategories, fetchActiveThemes } from "@/lib/invitation-themes.server";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { eventHasFeature } from "@/lib/event-features";
import type { Client, Event, EventCategory, InvitationTheme } from "@/lib/types";
import {
  getAlbumShareMessage,
  getInvitationShareMessage,
  getPhotoUploadShareMessage,
  getWhatsAppUrl
} from "@/lib/share-messages";
import { shortAlbumUrl, shortPhotoUploadUrl } from "@/lib/utils";

type Mode = "publicacion" | "ajustes" | "full";

type Props = {
  event: Event;
  eventClient?: Client | null;
  canManage: boolean;
  canPublish?: boolean;
  canDelete?: boolean;
  url: string;
  showEditor?: boolean;
  mode?: Mode;
};

function EventStatusBadge({ status }: { status: Event["status"] }) {
  const map = {
    borrador:  { label: "Borrador",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    publicado: { label: "Publicado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    inactivo:  { label: "Inactivo",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
  } as const;
  const s = map[status] ?? map.borrador;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function PublicacionCard({
  event,
  eventClient,
  canPublish,
  url,
}: {
  event: Event;
  eventClient?: Client | null;
  canPublish: boolean;
  url: string;
}) {
  const isDraft = event.status !== "publicado";
  const previewUrl = `/evento/${event.slug}?preview=admin`;
  const photoUploadUrl = shortPhotoUploadUrl(event.slug);
  const albumUrl = shortAlbumUrl(event.slug);
  const invitationMessage = getInvitationShareMessage(event, url);
  const photoMessage = getPhotoUploadShareMessage(event, photoUploadUrl);
  const albumMessage = getAlbumShareMessage(event, albumUrl);
  const publishAction = setEventStatus.bind(null, event.id, isDraft ? "publicado" : "borrador");
  const hasExternalPhotoAlbum = eventHasFeature(event, "external_photo_album") && Boolean(event.external_photo_album_url);
  const photoQrUrl = hasExternalPhotoAlbum ? event.external_photo_album_url! : photoUploadUrl;
  const photoQrTitle = hasExternalPhotoAlbum ? "QR album externo" : "QR subida de fotos";
  const photoQrDescription = hasExternalPhotoAlbum ? "Escaneable para abrir el album." : "Escaneable para recibir fotos.";
  const photoQrFilename = hasExternalPhotoAlbum ? `kais-album-externo-${event.slug}` : `kais-fotos-${event.slug}`;
  const photoQrCopyLabel = hasExternalPhotoAlbum ? "Copiar album" : "Copiar fotos";
  const photoQrMessage = hasExternalPhotoAlbum
    ? `Subi tus fotos al album de ${event.title}:\n${event.external_photo_album_url}`
    : photoMessage;

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-[#eadfd2]">
      <CardHeader className="border-b border-border px-4 py-2.5">
        <CardTitle>Publicacion</CardTitle>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(540px,0.78fr)]">
        <div className="grid min-h-0 content-start gap-2.5">
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado actual</p>
                <EventStatusBadge status={event.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isDraft ? "Publica para habilitar el acceso." : "La invitacion publica esta disponible."}
              </p>
            </div>
            {canPublish ? (
              <form action={publishAction}>
                <Button size="sm" variant={isDraft ? "default" : "outline"}>
                  {isDraft ? (
                    <>
                      <Globe className="h-4 w-4" />
                      Publicar evento
                    </>
                  ) : (
                    <>
                      <GlobeLock className="h-4 w-4" />
                      Volver a borrador
                    </>
                  )}
                </Button>
              </form>
            ) : null}
          </div>

          {eventClient ? (
            <div className="rounded-xl border bg-background px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente asociado</p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {eventClient.name}
                {eventClient.contact_name ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {" - "}{eventClient.contact_name}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">URL publica completa</p>
            <p className="mt-1.5 break-all text-sm text-muted-foreground">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isDraft ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={previewUrl} target="_blank" rel="noreferrer">
                    <Eye className="h-4 w-4" />
                    Ver borrador
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href={`/evento/${event.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Ver invitacion
                  </Link>
                </Button>
              )}
              <CopyLinkButton value={url} label="Copiar enlace" />
              <CopyLinkButton value={invitationMessage} label="Copiar mensaje" copiedLabel="Mensaje copiado" />
              <Button size="sm" variant="outline" asChild>
                <a href={getWhatsAppUrl(invitationMessage)} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="min-w-0 rounded-xl border bg-background p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subida de fotos</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{photoUploadUrl}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyLinkButton value={photoUploadUrl} label="Copiar fotos" />
                <Button size="sm" variant="outline" asChild>
                  <a href={getWhatsAppUrl(photoMessage)} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
            <div className="min-w-0 rounded-xl border bg-background p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {hasExternalPhotoAlbum ? "Album externo" : "Album corto"}
              </p>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {hasExternalPhotoAlbum ? event.external_photo_album_url : albumUrl}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyLinkButton value={hasExternalPhotoAlbum ? event.external_photo_album_url! : albumUrl} label="Copiar album" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 content-start gap-3 md:grid-cols-2 xl:grid-cols-2">
          <div className="rounded-xl border bg-background p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">QR de invitacion</p>
                <p className="text-xs text-muted-foreground">Para invitados.</p>
              </div>
            </div>
            <QrDownload value={url} filename={`kais-${event.slug}`} />
          </div>

          <div className="rounded-xl border bg-background p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{photoQrTitle}</p>
                <p className="text-xs text-muted-foreground">{photoQrDescription}</p>
              </div>
            </div>
            <QrDownload value={photoQrUrl} filename={photoQrFilename} />
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyLinkButton value={photoQrUrl} label={photoQrCopyLabel} />
              <Button size="sm" variant="outline" asChild>
                <a href={getWhatsAppUrl(photoQrMessage)} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function EditarCard({
  event,
  showEditor,
  editorData,
}: {
  event: Event;
  showEditor: boolean;
  editorData: {
    businessClients: Client[];
    activeCategories: EventCategory[];
    activeThemes: InvitationTheme[];
  };
}) {
  const update   = updateEvent.bind(null, event.id);
  const editHref = `/dashboard/eventos/${event.id}?tab=ajustes&edit=1`;
  const EventFormComponent = showEditor
    ? (await import("@/components/event-form")).EventForm
    : null;

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Editar datos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {showEditor ? (
          <div className="grid gap-5">
            <div>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/eventos/${event.id}?tab=ajustes`}>
                  Cerrar edicion
                </Link>
              </Button>
            </div>
            {EventFormComponent ? (
              <EventFormComponent
              action={update}
              event={event}
              businessClients={editorData.businessClients}
              categories={editorData.activeCategories}
              themes={editorData.activeThemes}
            />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Modifica datos, tema visual, multimedia y RSVP del evento.
            </p>
            <Button asChild>
              <Link href={editHref}>Editar evento</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ZonaRiesgoCard({ event }: { event: Event }) {
  const deleteAction = isCloudflareAuthEnabled()
    ? `/api/dashboard/events/${event.id}/delete`
    : deleteEvent.bind(null, event.id);

  return (
    <Card className="border-red-100">
      <CardHeader className="border-b border-red-100">
        <CardTitle className="text-red-700">Zona de riesgo</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-5">
        <p className="text-sm text-muted-foreground">
          Eliminar este evento borrara tambien sus RSVP, fotos y accesos del cliente. Esta
          accion no se puede deshacer.
        </p>
        {typeof deleteAction === "string" ? (
          <DeleteEventForm endpoint={deleteAction} />
        ) : (
          <form action={deleteAction} method="post">
            <DeleteEventButton />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

async function loadEditorData() {
  if (isCloudflareAuthEnabled()) {
    const [businessClients, activeCategories, activeThemes] = await Promise.all([
      listD1Clients(),
      listD1EventCategories(),
      listD1InvitationThemes()
    ]);

    return {
      businessClients: businessClients as Client[],
      activeCategories,
      activeThemes
    };
  }

  const admin = createAdminClient();
  const [{ data: clientsData }, categories, themes] = await Promise.all([
    timed(
      "[KAIS PERF] detalles clients editor",
      admin
        .from("clients")
        .select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by")
        .order("name", { ascending: true })
    ),
    timed("[KAIS PERF] detalles categories editor", fetchActiveCategories()),
    timed("[KAIS PERF] detalles themes editor", fetchActiveThemes()),
  ]);
  return {
    businessClients: (clientsData ?? []) as Client[],
    activeCategories: categories as EventCategory[],
    activeThemes: themes as InvitationTheme[],
  };
}

async function loadEventClient(clientId: string): Promise<Client | null> {
  if (isCloudflareAuthEnabled()) {
    const clients = (await listD1Clients()) as Client[];
    return clients.find((client) => client.id === clientId) ?? null;
  }

  const admin = createAdminClient();
  const { data } = await timed(
    "[KAIS PERF] detalles client-by-id",
    admin
      .from("clients")
      .select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by")
      .eq("id", clientId)
      .maybeSingle()
  );
  return (data as Client | null) ?? null;
}

export async function DetallesSection({
  event,
  eventClient: eventClientProp,
  canManage,
  canPublish = canManage,
  canDelete = canManage,
  url,
  showEditor = false,
  mode,
}: Props) {
  const sectionLabel = perfStart(`detalles-section-${event.id}`);

  const resolvedMode: Mode = mode ?? "full";

  const needClientFetch =
    eventClientProp === undefined &&
    event.client_id != null &&
    resolvedMode !== "ajustes";

  const eventClient: Client | null = needClientFetch
    ? await loadEventClient(event.client_id!)
    : (eventClientProp ?? null);

  const emptyEditorData = {
    businessClients:  [] as Client[],
    activeCategories: [] as EventCategory[],
    activeThemes:     [] as InvitationTheme[],
  };
  const editorData =
    resolvedMode !== "publicacion" && showEditor
      ? await loadEditorData()
      : emptyEditorData;

  perfEnd(sectionLabel);

  const showPub     = resolvedMode === "publicacion" || resolvedMode === "full";
  const showAjustes = resolvedMode === "ajustes"     || resolvedMode === "full";

  return (
    <>
      {showPub && (
        <PublicacionCard event={event} eventClient={eventClient} canPublish={canPublish} url={url} />
      )}
      {showAjustes && (
        <>
          {canManage ? <EditarCard event={event} showEditor={showEditor} editorData={editorData} /> : null}
          {canDelete && <ZonaRiesgoCard event={event} />}
        </>
      )}
    </>
  );
}

