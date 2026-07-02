import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/app/actions/events";
import { canManageEvents } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getD1AdminOverviewCounts, listD1DashboardEvents, listD1Profiles } from "@/lib/cloudflare/public-events";
import { createClient } from "@/lib/supabase/server";
import type { Event, Profile } from "@/lib/types";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!canManageEvents(profile)) redirect("/dashboard");

  const isCloudflareMode = process.env.USE_CLOUDFLARE_AUTH === "1";
  const [{ data: clientsData }, { data: eventsData }, { count: rsvps = 0 }, { count: photos = 0 }] = isCloudflareMode
    ? await Promise.all([
        listD1Profiles(true).then((data) => ({ data })),
        listD1DashboardEvents().then((data) => ({ data })),
        getD1AdminOverviewCounts().then((counts) => ({ count: counts.rsvps })),
        getD1AdminOverviewCounts().then((counts) => ({ count: counts.photos }))
      ])
    : await (async () => {
        const supabase = await createClient();
        return Promise.all([
          supabase.from("profiles").select("id,full_name,email,role,is_active,created_at").order("created_at", { ascending: false }),
          supabase.from("events").select("id,title,hosts_names,status,slug,created_at").order("created_at", { ascending: false }),
          supabase.from("rsvps").select("id", { count: "exact", head: true }),
          supabase.from("event_photos").select("id", { count: "exact", head: true })
        ]);
      })();
  const clients = (clientsData ?? []) as Profile[];
  const events = (eventsData ?? []) as Event[];

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <section className="rounded-3xl border border-[#eadfd2] bg-[#fffaf3] px-8 py-5 shadow-[0_18px_50px_-42px_rgba(74,23,36,0.5)]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">Admin</p>
            <h1 className="font-display text-4xl leading-none text-[#24171b]">Operación KAIS</h1>
          </div>
          <Button className="rounded-xl bg-[#141724] px-5 py-5 text-white hover:bg-[#202436]" asChild>
            <Link href="/dashboard/eventos/nuevo">Crear evento para cliente</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Clientes", clients.length],
          ["Eventos", events.length],
          ["RSVP", rsvps ?? 0],
          ["Fotos", photos ?? 0]
        ].map(([label, value]) => (
          <Card key={String(label)} className="rounded-2xl border-[#eadfd2] bg-white shadow-[0_14px_40px_-36px_rgba(74,23,36,0.45)]">
            <CardContent className="flex items-center justify-between p-4">
              <CardTitle className="text-base text-[#2a1820]">{String(label)}</CardTitle>
              <span className="font-display text-3xl font-semibold leading-none text-[#1e171a]">{String(value)}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border-[#eadfd2] bg-white shadow-[0_18px_45px_-40px_rgba(74,23,36,0.55)]">
          <CardHeader className="border-b border-[#eadfd2] px-5 py-4">
            <CardTitle className="text-lg">Todos los eventos</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 overflow-y-auto p-4">
            <div className="grid gap-2">
              {events.map((event) => (
                <div key={event.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#eadfd2] bg-[#fffaf7] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-[#24171b]">{event.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{event.hosts_names || "Sin anfitrión"} · {event.status}</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg border-[#d9cbbb] px-4" asChild>
                    <Link href={`/dashboard/eventos/${event.id}`}>Gestionar</Link>
                  </Button>
                </div>
              ))}
              {events.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#eadfd2] bg-[#fffaf7] p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay eventos cargados.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border-[#eadfd2] bg-white shadow-[0_18px_45px_-40px_rgba(74,23,36,0.55)]">
          <CardHeader className="border-b border-[#eadfd2] px-5 py-4">
            <CardTitle className="text-lg">Clientes</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 overflow-y-auto p-4">
            <div className="grid gap-2">
              {clients.map((client) => (
                <div key={client.id} className="grid gap-1 rounded-xl border border-[#eadfd2] bg-[#fffaf7] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-bold text-[#24171b]">{client.full_name || "-"}</p>
                    <span className="rounded-full border border-[#eadfd2] bg-white px-2.5 py-1 text-[11px] font-bold text-accent">
                      {client.role}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{client.email || "Sin email"}</p>
                  <p className="text-xs text-muted-foreground">Alta {new Date(client.created_at).toLocaleDateString("es-PY")}</p>
                </div>
              ))}
              {clients.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#eadfd2] bg-[#fffaf7] p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay clientes cargados.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
