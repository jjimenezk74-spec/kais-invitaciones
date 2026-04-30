import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Eye,
  Globe,
  GlobeLock,
  ImageIcon,
  MonitorPlay,
} from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { LiveScreenActions } from "@/components/live-screen-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventTabNav } from "@/components/event-tab-nav";
import { EVENT_TABS } from "@/components/event-tabs";
import { getCurrentUserProfile } from "@/lib/profiles";
import {
  canAccessDashboard,
  canDeleteEvents,
  canEditEventDesign,
  canManageEventAccess,
  canManageEvents,
  canManageGuests,
  canPublishEvents,
  canViewEventDetail,
  canViewRsvps,
} from "@/lib/permissions";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { createAdminClient } from "@/lib/supabase/admin";
import { setEventStatus } from "@/app/actions/event-status";
import type { Client, Event } from "@/lib/types";
import { absoluteUrl, publicEventUrl, shortAlbumUrl, shortPhotoUploadUrl } from "@/lib/utils";
import { DetallesSection } from "@/components/event-sections/detalles-section";
import { AccesoSection } from "@/components/event-sections/acceso-section";
import { GuestSection } from "@/components/event-sections/guest-section";
import { RsvpSection } from "@/components/event-sections/rsvp-section";

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 h-5 w-36 rounded bg-muted" />
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-11 w-full rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 h-5 w-36 rounded bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="mb-3 flex gap-4 border-b pb-3">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-10 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 h-4 w-16 rounded bg-muted" />
            <div className="h-9 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 h-5 w-32 rounded bg-muted" />
        <div className="h-20 w-full rounded-xl bg-muted" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Event["status"] }) {
  const map = {
    borrador:  { label: "Borrador",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    publicado: { label: "Publicado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    inactivo:  { label: "Inactivo",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
  } as const;
  const s = map[status] ?? map.borrador;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

async function MetricsSection({ event }: { event: Event }) {
  const admin = createAdminClient();
  const label = perfStart(`metrics-${event.id}`);
  const [
    { count: rsvpsTotal     = 0 },
    { count: rsvpsAttending = 0 },
    { count: photosCount    = 0 },
    { count: liveTotal      = 0 },
    { count: guestsCount    = 0 },
  ] = await Promise.all([
    timed("m-rsvps",  admin.from("rsvps").select("id", { count: "exact", head: true }).eq("event_id", event.id)),
    timed("m-attend", admin.from("rsvps").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("attending", true)),
    timed("m-photos", admin.from("event_photos").select("id", { count: "exact", head: true }).eq("event_id", event.id)),
    timed("m-live",   admin.from("live_photos").select("id", { count: "exact", head: true }).eq("event_id", event.id)),
    timed("m-guests", admin.from("event_guests").select("id", { count: "exact", head: true }).eq("event_id", event.id)),
  ]);
  perfEnd(label);

  const metrics = [
    { label: "RSVP",      value: rsvpsTotal     ?? 0 },
    { label: "Asisten",   value: rsvpsAttending ?? 0 },
    { label: "Invitados", value: guestsCount    ?? 0 },
    { label: "Fotos",     value: photosCount    ?? 0 },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="mt-2 text-4xl font-bold text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-accent" />
            KAIS Live Album
          </CardTitle>
          <Button asChild size="sm">
            <Link href={`/dashboard/eventos/${event.id}/fotos`}>Gestionar</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/40">
            <div className="flex flex-col items-center gap-0.5 py-4">
              <span className="text-2xl font-bold text-foreground">{liveTotal ?? 0}</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-4">
              <span className="text-2xl font-bold text-amber-500">-</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Pendientes</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-4">
              <span className="text-2xl font-bold text-emerald-600">-</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">Aprobadas</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LiveScreenActions
              livePath={`/evento/${event.slug}/live`}
              liveUrl={absoluteUrl(`/evento/${event.slug}/live`)}
            />
            <Link href={shortPhotoUploadUrl(event.slug)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted">
              <ImageIcon className="h-3.5 w-3.5" />
              Enlace de subida
            </Link>
            <Link href={shortAlbumUrl(event.slug)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted">
              Album publico
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const VALID_TABS = ["resumen", "invitados", "confirmaciones", "publicacion", "acceso", "ajustes"];

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    error?: string;
    saved?: string;
    edit?: string;
    login_username?: string;
    login_password?: string;
    access_existing?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const perfLabel = perfStart(`event-page-${id}`);

  const { user, profile } = await timed("event-page-profile", getCurrentUserProfile());
  if (!user) redirect("/login?error=Inicia sesion para entrar al panel.");
  if (!canAccessDashboard(profile)) {
    redirect("/login?error=Tu usuario interno esta desactivado. Contacta al super admin de KAIS.");
  }
  if (!canViewEventDetail(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para abrir el detalle completo del evento.");
  }

  const permissions = {
    manageEvents: canManageEvents(profile),
    publishEvents: canPublishEvents(profile),
    deleteEvents: canDeleteEvents(profile),
    manageGuests: canManageGuests(profile),
    viewRsvps: canViewRsvps(profile),
    manageEventAccess: canManageEventAccess(profile),
    editEventDesign: canEditEventDesign(profile),
  };

  const availableTabs = EVENT_TABS.filter((tab) => {
    if (tab.key === "resumen") return true;
    if (tab.key === "invitados") return permissions.manageGuests;
    if (tab.key === "confirmaciones") return permissions.viewRsvps;
    if (tab.key === "publicacion") return permissions.publishEvents;
    if (tab.key === "acceso") return permissions.manageEventAccess;
    if (tab.key === "ajustes") return permissions.manageEvents;
    return false;
  });
  const requestedTab = VALID_TABS.includes(query.tab ?? "") ? (query.tab ?? "resumen") : "resumen";
  const activeTab = availableTabs.some((tab) => tab.key === requestedTab) ? requestedTab : "resumen";
  const needsFullEvent = activeTab === "ajustes";
  const eventSelect = needsFullEvent
    ? "*"
    : "id,client_id,title,status,slug,event_date,event_time,guest_mode";

  const admin = createAdminClient();
  const { data: eventData } = await timed("event-page-event", admin.from("events").select(eventSelect).eq("id", id).single());

  const event = eventData as Event | null;
  if (!event) return <p>Evento no encontrado.</p>;

  const eventClient: Client | null = event.client_id
    ? await timed(
        "event-page-client",
        admin
          .from("clients")
          .select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by")
          .eq("id", event.client_id)
          .maybeSingle()
      ).then(({ data }) => (data as Client | null) ?? null)
    : null;

  perfEnd(perfLabel);

  const url            = publicEventUrl(event.slug);
  const clientPanelUrl = absoluteUrl("/evento-login");
  const isDraft        = event.status !== "publicado";
  const previewUrl     = `/evento/${event.slug}?preview=admin`;
  const publishAction  = setEventStatus.bind(null, event.id, isDraft ? "publicado" : "borrador");

  return (
    <div className="grid gap-6">

      {/* Header premium */}
      <div className="rounded-2xl border border-[#eadfd2] bg-[#fffaf3] p-6 shadow-[0_24px_70px_rgba(74,23,36,0.07)]">
        <div className="mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
              KAIS Dashboard - Evento
            </p>
            <h1 className="mt-1 break-words font-display text-3xl font-bold text-[#3b1721] md:text-4xl">
              {event.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <StatusBadge status={event.status} />
              {eventClient && (
                <>
                  <span className="opacity-30">-</span>
                  <span>{eventClient.name}</span>
                </>
              )}
              <span className="opacity-30">-</span>
              <span className="break-all text-xs opacity-70">{url}</span>
            </div>

            {query.error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {query.error}
              </p>
            )}
            {query.saved && (
              <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-foreground">
                {query.saved === "status"
                  ? "Estado actualizado correctamente."
                  : "Evento guardado correctamente."}
              </p>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {isDraft ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={previewUrl} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" />
                  Ver borrador
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/evento/${event.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver invitacion
                </Link>
              </Button>
            )}

            <CopyLinkButton value={url} />

            {permissions.publishEvents && (
              <form action={publishAction}>
                <Button size="sm" variant={isDraft ? "default" : "outline"}>
                  {isDraft ? (
                    <>
                      <Globe className="h-4 w-4" />
                      Publicar
                    </>
                  ) : (
                    <>
                      <GlobeLock className="h-4 w-4" />
                      A borrador
                    </>
                  )}
                </Button>
              </form>
            )}

            {permissions.viewRsvps && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/events/${event.id}/rsvps.csv`}>
                  <Download className="h-4 w-4" />
                  CSV
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <EventTabNav eventId={event.id} activeTab={activeTab} tabs={availableTabs} />

      {/* Tab content */}

      {activeTab === "resumen" && (
        <Suspense fallback={<MetricsSkeleton />}>
          <MetricsSection event={event} />
        </Suspense>
      )}

      {activeTab === "invitados" && permissions.manageGuests && (
        <Suspense fallback={<TableSkeleton />}>
          <GuestSection event={event} />
        </Suspense>
      )}
      {activeTab === "invitados" && !permissions.manageGuests && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Solo administradores KAIS pueden gestionar la lista de invitados.
          </CardContent>
        </Card>
      )}

      {activeTab === "confirmaciones" && permissions.viewRsvps && (
        <Suspense fallback={<TableSkeleton />}>
          <RsvpSection eventId={event.id} />
        </Suspense>
      )}

      {activeTab === "publicacion" && (
        <Suspense fallback={<CardSkeleton rows={4} />}>
          <DetallesSection
            event={event}
            eventClient={eventClient}
            canManage={permissions.manageEvents}
            canPublish={permissions.publishEvents}
            canDelete={permissions.deleteEvents}
            url={url}
            mode="publicacion"
          />
        </Suspense>
      )}

      {activeTab === "acceso" && (
        <Suspense fallback={<CardSkeleton rows={3} />}>
          <AccesoSection
            event={event}
            canManage={permissions.manageEventAccess}
            profileRole={profile?.role}
            loginUsername={query.login_username}
            loginPassword={query.login_password}
            accessExisting={query.access_existing}
            clientPanelUrl={clientPanelUrl}
          />
        </Suspense>
      )}

      {activeTab === "ajustes" && (
        <Suspense fallback={<CardSkeleton rows={5} />}>
          <DetallesSection
            event={event}
            eventClient={eventClient}
            canManage={permissions.manageEvents}
            canPublish={permissions.publishEvents}
            canDelete={permissions.deleteEvents}
            url={url}
            showEditor={query.edit === "1"}
            mode="ajustes"
          />
        </Suspense>
      )}

    </div>
  );
}
