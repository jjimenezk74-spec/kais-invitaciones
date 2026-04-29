import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/app/actions/events";
import { canManageEvents } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Event, Profile } from "@/lib/types";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!canManageEvents(profile)) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: clientsData }, { data: eventsData }, { count: rsvps = 0 }, { count: photos = 0 }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,role,is_active,created_at").order("created_at", { ascending: false }),
    supabase.from("events").select("id,title,hosts_names,status,slug,created_at").order("created_at", { ascending: false }),
    supabase.from("rsvps").select("id", { count: "exact", head: true }),
    supabase.from("event_photos").select("id", { count: "exact", head: true })
  ]);
  const clients = (clientsData ?? []) as Profile[];
  const events = (eventsData ?? []) as Event[];

  return (
    <div className="grid gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Admin</p>
          <h1 className="font-display text-4xl font-bold">Operación KAIS</h1>
        </div>
        <Button asChild>
          <Link href="/dashboard/eventos/nuevo">Crear evento para cliente</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Clientes", clients.length],
          ["Eventos", events.length],
          ["RSVP", rsvps ?? 0],
          ["Fotos", photos ?? 0]
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader><CardTitle>{String(label)}</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{String(value)}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Clientes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr><th className="py-3">Nombre</th><th>Email</th><th>Rol</th><th>Alta</th></tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b">
                  <td className="py-3 font-medium">{client.full_name || "-"}</td>
                  <td>{client.email || "-"}</td>
                  <td>{client.role}</td>
                  <td>{new Date(client.created_at).toLocaleDateString("es-PY")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Todos los eventos</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {events.map((event) => (
            <div key={event.id} className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center">
              <div>
                <p className="font-semibold">{event.title}</p>
                <p className="text-sm text-muted-foreground">{event.hosts_names} · {event.status}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/eventos/${event.id}`}>Gestionar</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
