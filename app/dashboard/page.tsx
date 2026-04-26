import Link from "next/link";
import { Eye, PartyPopper, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/lib/types";
import { publicEventUrl } from "@/lib/utils";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const eventsQuery = supabase.from("events").select("*").order("created_at", { ascending: false });
  const { data: eventsData } = await eventsQuery;
  const events = (eventsData ?? []) as Event[];

  const eventIds = events.map((event) => event.id);
  const [{ count: rsvpsCount }, { count: visitsCount }] = await Promise.all([
    eventIds.length
      ? supabase.from("rsvps").select("*", { count: "exact", head: true }).in("event_id", eventIds)
      : Promise.resolve({ count: 0 }),
    eventIds.length
      ? supabase.from("analytics_visits").select("*", { count: "exact", head: true }).in("event_id", eventIds)
      : Promise.resolve({ count: 0 })
  ]);

  const published = events.filter((event) => event.status === "publicado").length;
  const metrics = [
    { label: "Eventos", value: events.length, Icon: PartyPopper },
    { label: "Publicados", value: published, Icon: Eye },
    { label: "RSVP", value: rsvpsCount ?? 0, Icon: Users },
    { label: "Visitas", value: visitsCount ?? 0, Icon: Eye }
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Panel {profile?.role}</p>
          <h1 className="font-display text-4xl font-bold">Tus eventos</h1>
          {query.error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p> : null}
        </div>
        <Button asChild>
          <Link href="/dashboard/eventos/nuevo">
            <Plus className="h-4 w-4" />
            Crear nuevo evento
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardHeader>
              <Icon className="h-5 w-5 text-accent" />
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{event.title}</p>
                <p className="text-sm text-muted-foreground">
                  {event.hosts_names} · {event.event_date} · {event.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{publicEventUrl(event.slug)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/evento/${event.slug}`}>Ver pública</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/eventos/${event.id}`}>Gestionar</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {events.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">Crea tu primer evento para generar el enlace público y el QR.</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
