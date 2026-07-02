import Link from "next/link";
import { CalendarDays, Camera, CheckCircle2, ExternalLink, Plus, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getD1Database } from "@/lib/cloudflare/d1";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { canCreateEvents } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { Event } from "@/lib/types";
import { publicEventUrl } from "@/lib/utils";

type DashboardEvent = Pick<Event, "id" | "title" | "status" | "hosts_names" | "event_date" | "event_time" | "slug"> & {
  clients?:
    | {
    name: string;
    contact_name: string | null;
      }
    | {
        name: string;
        contact_name: string | null;
      }[]
    | null;
};

const statusStyles: Record<Event["status"], string> = {
  borrador: "border-amber-200 bg-amber-50 text-amber-800",
  publicado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  inactivo: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; deleted?: string; warning?: string }>;
}) {
  const pagePerf = perfStart("dashboard-main");
  const query = searchParams ? await searchParams : {};
  const { profile } = await getCurrentUserProfile();
  const dashboardData = await getDashboardData();
  const events = dashboardData.events;
  const rsvpsCount = dashboardData.rsvpsCount;
  const liveAlbumsCount = dashboardData.liveAlbumsCount;

  const now = new Date();
  const activeEvents = events.filter((event) => event.status !== "inactivo").length;
  const upcomingEvents = events.filter((event) => {
    const eventDate = parseEventDate(event.event_date, "23:59:59");
    return eventDate ? eventDate >= now : false;
  }).length;
  const metrics = [
    { label: "Eventos activos", value: activeEvents, Icon: Sparkles },
    { label: "Confirmaciones RSVP", value: rsvpsCount ?? 0, Icon: Users },
    { label: "Próximos eventos", value: upcomingEvents, Icon: CalendarDays },
    { label: "Álbumes en vivo", value: liveAlbumsCount ?? 0, Icon: Camera },
  ];

  perfEnd(pagePerf);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <section className="overflow-hidden rounded-2xl border border-[#eadfd2] bg-[linear-gradient(135deg,#fffaf2,#f7efe4)] px-6 py-5 shadow-[0_22px_72px_-58px_rgba(17,24,39,0.75)]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7b1631]">
              Panel KAIS · {profile?.role}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-[#1f1215] md:text-4xl">
              Gestión de eventos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">
              Accede rápido a eventos, confirmaciones y álbumes activos sin ruido operativo.
            </p>
            {query.error ? (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p>
            ) : null}
            {query.deleted ? (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                {query.deleted} fue eliminado correctamente.
              </p>
            ) : null}
            {query.warning ? (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">{query.warning}</p>
            ) : null}
          </div>
          {canCreateEvents(profile) ? (
            <Button asChild className="h-11 bg-[#6f1029] px-5 text-white hover:bg-[#581023]">
              <Link href="/dashboard/eventos/nuevo">
                <Plus className="h-4 w-4" />
                Crear evento
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, Icon }) => (
          <Card key={label} className="border-[#eadfd2] bg-white shadow-[0_16px_56px_-48px_rgba(17,24,39,0.7)]">
            <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
              <CardTitle className="text-sm font-bold text-[#3b1b24]">{label}</CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7efe4] text-[#7b1631]">
                <Icon className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-black leading-none text-[#1f1215]">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7b1631]">Eventos</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#1f1215]">Lista operativa</h2>
          </div>
        </div>

        <div className="grid min-h-0 content-start gap-3 overflow-hidden lg:grid-cols-2">
          {events.map((event) => {
            const publicUrl = publicEventUrl(event.slug);
            const shortUrl = `/evento/${event.slug}`;
            const client = Array.isArray(event.clients) ? event.clients[0] : event.clients;
            const clientName = client?.name ?? event.hosts_names;

            return (
              <Card key={event.id} className="border-[#eadfd2] bg-white shadow-[0_18px_64px_-56px_rgba(17,24,39,0.7)]">
                <CardContent className="grid gap-3 p-4 xl:grid-cols-[1fr_0.95fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-bold text-[#1f1215]">{event.title}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[event.status]}`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-[#6f1029]">{clientName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatEventDate(event.event_date)} · {event.event_time?.slice(0, 5)}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl border border-[#f0e4d8] bg-[#fffaf2] px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Link público</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#3b1b24]">{shortUrl}</p>
                  </div>

                  <div className="flex gap-2 xl:justify-end">
                    <Button size="sm" asChild className="bg-[#6f1029] text-white hover:bg-[#581023]">
                      <Link href={`/dashboard/eventos/${event.id}`}>Gestionar</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/evento/${event.slug}`}>
                        <ExternalLink className="h-4 w-4" />
                        Ver pública
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {events.length === 0 ? (
            <Card className="border-[#eadfd2] bg-white">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[#7b1631]" />
                <p className="mt-4 font-semibold text-[#1f1215]">Todavía no hay eventos.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Crea tu primer evento para generar el enlace público y el QR.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

async function getDashboardData() {
  const db = await getD1Database();
  if (process.env.USE_CLOUDFLARE_AUTH === "1" && db) {
    const eventRows = await db
      .prepare(
        `SELECT
          events.id,
          events.title,
          events.status,
          events.hosts_names,
          events.event_date,
          events.event_time,
          events.slug,
          clients.name AS client_name,
          clients.contact_name AS client_contact_name
        FROM events
        LEFT JOIN clients ON clients.id = events.client_id
        ORDER BY events.event_date ASC`
      )
      .all<{
        id: string;
        title: string;
        status: Event["status"];
        hosts_names: string;
        event_date: string;
        event_time: string;
        slug: string;
        client_name: string | null;
        client_contact_name: string | null;
      }>();

    const events = (eventRows.results ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      status: event.status,
      hosts_names: event.hosts_names,
      event_date: event.event_date,
      event_time: event.event_time,
      slug: event.slug,
      clients: event.client_name
        ? {
            name: event.client_name,
            contact_name: event.client_contact_name
          }
        : null
    })) satisfies DashboardEvent[];

    const [rsvpsRow, liveAlbumsRow] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM rsvps").first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM live_photos").first<{ count: number }>()
    ]);

    return {
      events,
      rsvpsCount: rsvpsRow?.count ?? 0,
      liveAlbumsCount: liveAlbumsRow?.count ?? 0
    };
  }

  const supabase = await createClient();
  const { data: eventsData } = await timed(
    "dashboard-events-summary",
    supabase
      .from("events")
      .select("id,title,status,hosts_names,event_date,event_time,slug,clients(name, contact_name)")
      .order("event_date", { ascending: true })
  );

  const events = (eventsData ?? []) as unknown as DashboardEvent[];
  const eventIds = events.map((event) => event.id);
  const [{ count: rsvpsCount }, { count: liveAlbumsCount }] = await Promise.all([
    eventIds.length
      ? timed("dashboard-rsvps-count", supabase.from("rsvps").select("id", { count: "exact", head: true }).in("event_id", eventIds))
      : Promise.resolve({ count: 0 }),
    eventIds.length
      ? timed("dashboard-live-albums-count", supabase.from("live_photos").select("event_id", { count: "exact", head: true }).in("event_id", eventIds))
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    events,
    rsvpsCount: rsvpsCount ?? 0,
    liveAlbumsCount: liveAlbumsCount ?? 0
  };
}

function parseEventDate(date?: string | null, time = "00:00:00") {
  if (!date) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatEventDate(date?: string | null) {
  const parsed = parseEventDate(date);
  if (!parsed) return "Fecha pendiente";

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
