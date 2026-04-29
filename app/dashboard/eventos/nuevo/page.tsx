import Link from "next/link";
import { redirect } from "next/navigation";
import { createEvent, getCurrentProfile } from "@/app/actions/events";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canCreateEvents, canManageEvents } from "@/lib/permissions";
import { timed } from "@/lib/perf";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, EventCategory, InvitationTheme } from "@/lib/types";
import { fetchActiveCategories, fetchActiveThemes } from "@/lib/invitation-themes.server";

export default async function NewEventPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  if (!canCreateEvents(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para crear eventos.");
  }
  const [{ data: clientsData }, { data: businessClientsData }, categories, themes] = await Promise.all([
    canManageEvents(profile)
      ? timed(
          "new-event-profile-clients",
          supabase
            .from("profiles")
            .select("id,full_name,email,role,is_active,created_at")
            .eq("role", "cliente")
            .order("created_at", { ascending: false })
        )
      : Promise.resolve({ data: [] }),
    timed(
      "new-event-business-clients",
      admin.from("clients").select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by").eq("status", "activo").order("name", { ascending: true })
    ),
    timed("new-event-categories", fetchActiveCategories()),
    timed("new-event-themes", fetchActiveThemes())
  ]);
  const clients = clientsData ?? [];
  const businessClients = (businessClientsData ?? []) as Client[];
  const activeCategories = categories as EventCategory[];
  const activeThemes = themes as InvitationTheme[];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-[#eadfd2] bg-[#fffaf3] p-6 shadow-[0_24px_70px_rgba(74,23,36,0.08)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">KAIS Dashboard</p>
          <h1 className="mt-2 font-display text-3xl text-[#3b1721]">Crear evento</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Completa solo lo necesario: datos del evento, tema visual, contenido, multimedia y RSVP.
          </p>
          {query.error ? <p className="mt-3 text-sm font-semibold text-red-600">{query.error}</p> : null}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Cancelar / Volver</Link>
        </Button>
      </div>

      <Card className="border-[#eadfd2] shadow-[0_24px_70px_rgba(74,23,36,0.07)]">
        <CardHeader className="border-b border-[#eadfd2] bg-white/70">
          <CardTitle className="font-display text-2xl text-[#3b1721]">Configuracion del evento</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <EventForm action={createEvent} clients={clients} businessClients={businessClients} categories={activeCategories} themes={activeThemes} showOwner={canManageEvents(profile)} />
        </CardContent>
      </Card>
    </div>
  );
}
