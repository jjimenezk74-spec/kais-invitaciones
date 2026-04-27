import Link from "next/link";
import { redirect } from "next/navigation";
import { createEvent, getCurrentProfile } from "@/app/actions/events";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canCreateEvents, isKaisAdmin } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client } from "@/lib/types";

export default async function NewEventPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  if (!canCreateEvents(profile?.role)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para crear eventos.");
  }
  const [{ data: clientsData }, { data: businessClientsData }] = await Promise.all([
    isKaisAdmin(profile?.role)
      ? supabase.from("profiles").select("*").eq("role", "cliente").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("clients").select("*").eq("status", "activo").order("name", { ascending: true })
  ]);
  const clients = clientsData ?? [];
  const businessClients = (businessClientsData ?? []) as Client[];

  return (
    <Card>
      <CardHeader>
        <div className="mb-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Cancelar / Volver</Link>
          </Button>
        </div>
        <CardTitle className="font-display text-3xl">Crear evento</CardTitle>
        {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
      </CardHeader>
      <CardContent>
        <EventForm action={createEvent} clients={clients} businessClients={businessClients} showOwner={isKaisAdmin(profile?.role)} />
      </CardContent>
    </Card>
  );
}
