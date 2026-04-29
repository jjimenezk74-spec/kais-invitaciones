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
import { PhotoUploadQrCard } from "@/components/photo-upload-qr-card";
import { QrDownload } from "@/components/qr-download";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActiveCategories, fetchActiveThemes } from "@/lib/invitation-themes.server";
import { perfEnd, perfStart, timed } from "@/lib/perf";
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
  const isDraft       = event.status !== "publicado";
  const previewUrl    = `/evento/${event.slug}?preview=admin`;
  const photoUploadUrl = shortPhotoUploadUrl(event.slug);
  const albumUrl = shortAlbumUrl(event.slug);
  const invitationMessage = getInvitationShareMessage(event, url);
  const photoMessage = getPhotoUploadShareMessage(event, photoUploadUrl);
  const albumMessage = getAlbumShareMessage(event, albumUrl);
  const publishAction = setEventStatus.bind(null, event.id, isDraft ? "publicado" : "borrador");

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Publicacion</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado actual</p>
            <div className="mt-1.5">
              <EventStatusBadge status={event.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isDraft
                ? "Cambia el estado a publicado para que los invitados puedan acceder."
                : "La invitacion publica esta disponible para compartir."}
            </p>
          </div>
          {canPublish ? (
            <form action={publishAction}>
              <Button variant={isDraft ? "default" : "outline"}>
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
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente asociado</p>
            <p className="mt-1.5 font-medium text-foreground">
              {eventClient.name}
              {eventClient.contact_name ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {" · "}{eventClient.contact_name}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">URL publica completa</p>
          <p className="mt-1.5 break-all text-sm text-muted-foreground">{url}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isDraft ? (
              <Button asChild variant="outline">
                <Link href={previewUrl} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" />
                  Ver borrador
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/evento/${event.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver invitacion publica
                </Link>
              </Button>
            )}
            <CopyLinkButton value={url} label="Copiar enlace" />
            <CopyLinkButton value={invitationMessage} label="Copiar mensaje" copiedLabel="Mensaje copiado" />
            <Button variant="outline" asChild>
              <a href={getWhatsAppUrl(invitationMessage)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-3 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">Descargar QR</p>
          </div>
          <QrDownload value={url} filename={`kais-${event.slug}`} />
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-4 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-accent" />
            <div>
              <p className="text-sm font-semibold">QR Fotos</p>
              <p className="text-xs text-muted-foreground">Para que los invitados suban fotos del evento.</p>
            </div>
          </div>
          <PhotoUploadQrCard
            url={photoUploadUrl}
            filename={`kais-fotos-${event.slug}`}
            shareMessage={photoMessage}
          />
          <div className="mt-3 rounded-xl border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Album corto</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">{albumUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyLinkButton value={albumUrl} label="Copiar enlace album" />
              <CopyLinkButton value={albumMessage} label="Copiar mensaje album" copiedLabel="Mensaje copiado" />
              <Button variant="outline" asChild>
                <a href={getWhatsAppUrl(albumMessage)} target="_blank" rel="noreferrer">
                  WhatsApp album
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
        <DeleteEventButton action={deleteEvent.bind(null, event.id)} />
      </CardContent>
    </Card>
  );
}

async function loadEditorData() {
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
