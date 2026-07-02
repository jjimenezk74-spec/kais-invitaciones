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
  Wand2,
} from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DashboardEventToast } from "@/components/dashboard-event-toast";
import { LiveScreenActions } from "@/components/live-screen-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventTabNav } from "@/components/event-tab-nav";
import { EventPackageSelect } from "@/components/event-package-select";
import { EVENT_TABS } from "@/components/event-tabs";
import { getD1EventByIdOrSlug, getD1EventDashboardCounts } from "@/lib/cloudflare/public-events";
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
import { regenerateCanvasDesignV3 } from "@/app/actions/canvas-v3";
import type { Client, Event } from "@/lib/types";
import { absoluteUrl, publicEventUrl, shortAlbumUrl, shortLiveScreenUrl, shortPhotoUploadUrl } from "@/lib/utils";
import { DetallesSection } from "@/components/event-sections/detalles-section";
import { AccesoSection } from "@/components/event-sections/acceso-section";
import { GuestSection } from "@/components/event-sections/guest-section";
import { RsvpSection } from "@/components/event-sections/rsvp-section";
import { RegenerateCanvasV3Button } from "@/components/regenerate-canvas-v3-button";

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

function getStatusLabel(status: Event["status"]) {
  const labels = {
    borrador: "Borrador",
    publicado: "Publicado",
    inactivo: "Inactivo",
  } as const;
  return labels[status] ?? "Borrador";
}

function formatCompactDate(date?: string | null) {
  if (!date) return "Sin fecha";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
  })
    .format(parsed)
    .replace(".", "");
}

async function MetricsSection({ event }: { event: Event }) {
  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const counts = await getD1EventDashboardCounts(event.id);
    return <MetricsView counts={counts} event={event} />;
  }

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
    { label: "RSVP",      value: rsvpsTotal     ?? 0, helper: "Aun no hay confirmaciones" },
    { label: "Asisten",   value: rsvpsAttending ?? 0, helper: "Nadie confirmo asistencia" },
    { label: "Invitados", value: guestsCount    ?? 0, helper: "Aun no hay invitados" },
    { label: "Fotos",     value: photosCount    ?? 0, helper: "Aun no hay fotos" },
  ];

  return <MetricsView counts={{ rsvpsTotal: rsvpsTotal ?? 0, rsvpsAttending: rsvpsAttending ?? 0, photosCount: photosCount ?? 0, liveTotal: liveTotal ?? 0, guestsCount: guestsCount ?? 0 }} event={event} />;
}

function MetricsView({
  counts,
  event,
}: {
  counts: {
    rsvpsTotal: number;
    rsvpsAttending: number;
    photosCount: number;
    liveTotal: number;
    guestsCount: number;
  };
  event: Event;
}) {
  const metrics = [
    { label: "RSVP",      value: counts.rsvpsTotal,     helper: "Aun no hay confirmaciones" },
    { label: "Asisten",   value: counts.rsvpsAttending, helper: "Nadie confirmo asistencia" },
    { label: "Invitados", value: counts.guestsCount,    helper: "Aun no hay invitados" },
    { label: "Fotos",     value: counts.photosCount,    helper: "Aun no hay fotos" },
  ];

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-rows-[auto_minmax(0,1fr)]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border-[#eadfd2] bg-white shadow-[0_14px_45px_rgba(74,23,36,0.05)]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-3xl font-bold leading-none text-foreground">{m.value}</p>
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                {m.value === 0 ? m.helper : "Actividad registrada"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="min-h-0 overflow-hidden border-[#d9b66a]/40 bg-[radial-gradient(circle_at_top_left,rgba(217,182,106,0.18),transparent_32%),linear-gradient(135deg,#3b1721,#15080c)] text-white shadow-[0_24px_70px_rgba(74,23,36,0.22)]">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <MonitorPlay className="h-5 w-5 text-[#f1cf79]" />
              KAIS Live Album
            </CardTitle>
            <p className="mt-1 text-xs text-white/70">
              Comparte fotos en tiempo real durante el evento.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/dashboard/eventos/${event.id}/fotos`}>Gestionar</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-center">
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.08] backdrop-blur">
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-xl font-bold text-white">{counts.liveTotal}</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-white/60">Total</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-xl font-bold text-[#f1cf79]">-</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-white/60">Pendientes</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-xl font-bold text-emerald-300">-</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-white/60">Aprobadas</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <LiveScreenActions
              livePath={`/l/${event.slug}`}
              liveUrl={shortLiveScreenUrl(event.slug)}
            />
            <Link href={shortPhotoUploadUrl(event.slug)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white">
              <ImageIcon className="h-3.5 w-3.5" />
              Enlace de subida
            </Link>
            <Link href={shortAlbumUrl(event.slug)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white">
              Álbum público
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const VALID_TABS = ["resumen", "invitados", "confirmaciones", "publicacion", "diseno-v3", "acceso", "ajustes"];

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
    if (tab.key === "diseno-v3") return permissions.editEventDesign;
    if (tab.key === "acceso") return permissions.manageEventAccess;
    if (tab.key === "ajustes") return permissions.manageEvents;
    return false;
  });
  const requestedTab = VALID_TABS.includes(query.tab ?? "") ? (query.tab ?? "resumen") : "resumen";
  const activeTab = availableTabs.some((tab) => tab.key === requestedTab) ? requestedTab : "resumen";
  const needsFullEvent = activeTab === "ajustes";
  const isCloudflareMode = process.env.USE_CLOUDFLARE_AUTH === "1";
  const eventSelect = needsFullEvent
    ? "*"
    : "id,client_id,package_key,title,status,slug,event_date,event_time,guest_mode,theme_id";

  const event = isCloudflareMode
    ? await timed("event-page-event-d1", getD1EventByIdOrSlug(id))
    : ((await timed(
        "event-page-event",
        createAdminClient().from("events").select(eventSelect).eq("id", id).single()
      )).data as Event | null);

  if (!event) return <p>Evento no encontrado.</p>;

  const admin = isCloudflareMode ? null : createAdminClient();
  const [eventClient, eventTheme] = isCloudflareMode ? [null, null] : await Promise.all([
    event.client_id && admin
      ? timed(
          "event-page-client",
          admin
            .from("clients")
            .select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by")
            .eq("id", event.client_id)
            .maybeSingle()
        ).then(({ data }) => (data as Client | null) ?? null)
      : Promise.resolve(null),
    event.theme_id && admin
      ? timed(
          "event-page-theme",
          admin
            .from("invitation_themes")
            .select("name")
            .eq("id", event.theme_id)
            .maybeSingle()
        ).then(({ data }) => (data as { name: string } | null)?.name ?? null)
      : Promise.resolve(null),
  ]);

  perfEnd(perfLabel);

  const url            = publicEventUrl(event.slug);
  const clientPanelUrl = absoluteUrl("/evento-login");
  const isDraft        = event.status !== "publicado";
  const previewUrl     = `/evento/${event.slug}?preview=admin`;
  const publishAction  = setEventStatus.bind(null, event.id, isDraft ? "publicado" : "borrador");
  const regenerateV3Action = regenerateCanvasDesignV3.bind(null, event.id);
  const savedToast     = query.saved
    ? query.saved === "status"
      ? "Estado actualizado correctamente."
      : "Evento guardado correctamente."
    : undefined;
  const compactMeta    = [
    getStatusLabel(event.status),
    formatCompactDate(event.event_date),
    eventTheme ?? "Tema sin asignar",
  ].join(" · ");

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <DashboardEventToast message={savedToast} />

      {/* Header premium */}
      <div className="rounded-2xl border border-[#eadfd2] bg-[#fffaf3] px-5 py-4 shadow-[0_18px_54px_-42px_rgba(74,23,36,0.7)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Link>
              </Button>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
                KAIS Dashboard - Evento
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <h1 className="truncate font-display text-3xl font-bold leading-none text-[#3b1721]">
                  {event.title}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#6f2339]">{compactMeta}</p>
              </div>
            </div>
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

            <div className="mt-3 flex flex-wrap items-center gap-2">
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
                    Ver invitación
                  </Link>
                </Button>
              )}

              <CopyLinkButton value={url} />

              {permissions.viewRsvps && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/api/events/${event.id}/rsvps.csv`}>
                    <Download className="h-4 w-4" />
                    CSV
                  </a>
                </Button>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-[#eadfd2] bg-white/75 p-3 shadow-[0_14px_35px_rgba(74,23,36,0.05)]">
            {permissions.manageEvents ? (
              <EventPackageSelect
                eventId={event.id}
                defaultValue={event.package_key}
              />
            ) : (
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Paquete contratado
                </p>
                <p className="rounded-md border border-[#eadfd2] bg-white px-3 py-2 text-sm font-semibold text-[#3b1721]">
                  {event.package_key}
                </p>
              </div>
            )}
          </aside>
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

      {activeTab === "diseno-v3" && permissions.editEventDesign && (
        <Card className="border-[#eadfd2] bg-white shadow-[0_18px_55px_rgba(74,23,36,0.06)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#3b1721]">
              <Wand2 className="h-5 w-5 text-[#b8862b]" />
              KAIS Studio
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <p className="text-sm font-medium text-[#3b1721]">
                Diseñador conectado a los datos actuales del evento.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Recrear reemplaza el diseño actual con una estructura nueva basada en nombre, fecha, mensajes, misa, ubicación y RSVP.
              </p>
              {query.error && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {query.error}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/eventos/${event.id}/canvas-v3`}>
                  <Wand2 className="h-4 w-4" />
                  Abrir Studio
                </Link>
              </Button>
              <RegenerateCanvasV3Button action={regenerateV3Action} />
            </div>
          </CardContent>
        </Card>
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
