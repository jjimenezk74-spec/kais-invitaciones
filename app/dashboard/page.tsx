import Link from "next/link";
import { CalendarDays, Camera, CheckCircle2, ExternalLink, Plus, Sparkles, Users } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { canCreateEvents } from "@/lib/profiles";
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
  const supabase = await createClient();
  const profile = await getCurrentProfile();

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

  const now = new Date();
  const activeEvents = events.filter((event) => event.status !== "inactivo").length;
  const upcomingEvents = events.filter((event) => new Date(`${event.event_date}T23:59:59`) >= now).length;
  const metrics = [
    { label: "Eventos activos", value: activeEvents, Icon: Sparkles },
    { label: "Confirmaciones RSVP", value: rsvpsCount ?? 0, Icon: Users },
    { label: "Próximos eventos", value: upcomingEvents, Icon: CalendarDays },
    { label: "Álbumes en vivo", value: liveAlbumsCount ?? 0, Icon: Camera },
  ];

  perfEnd(pagePerf);

  return (
    <div className="grid gap-8">
      <section className="overflow-hidden rounded-2xl border border-[#eadfd2] bg-[linear-gradient(135deg,#fffaf2,#f7efe4)] p-6 shadow-[0_28px_90px_-64px_rgba(17,24,39,0.75)] md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7b1631]">
              Panel KAIS · {profile?.role}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-[#1f1215] md:text-5xl">
              Gestión de eventos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
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
          {canCreateEvents(profile?.role) ? (
            <Button asChild className="bg-[#6f1029] text-white hover:bg-[#581023]">
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
          <Card key={label} className="border-[#eadfd2] bg-white shadow-[0_20px_70px_-54px_rgba(17,24,39,0.7)]">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="text-sm font-bold text-[#3b1b24]">{label}</CardTitle>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7efe4] text-[#7b1631]">
                <Icon className="h-5 w-5" />
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-4xl font-black text-[#1f1215]">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7b1631]">Eventos</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[#1f1215]">Lista operativa</h2>
          </div>
        </div>

        <div className="grid gap-3">
          {events.map((event) => {
            const publicUrl = publicEventUrl(event.slug);
            const shortUrl = `/evento/${event.slug}`;
            const client = Array.isArray(event.clients) ? event.clients[0] : event.clients;
            const clientName = client?.name ?? event.hosts_names;

            return (
              <Card key={event.id} className="border-[#eadfd2] bg-white shadow-[0_18px_64px_-56px_rgba(17,24,39,0.7)]">
                <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.9fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold text-[#1f1215]">{event.title}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[event.status]}`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#6f1029]">{clientName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatEventDate(event.event_date)} · {event.event_time?.slice(0, 5)}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl border border-[#f0e4d8] bg-[#fffaf2] px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Link público</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#3b1b24]">{shortUrl}</p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
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

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}
