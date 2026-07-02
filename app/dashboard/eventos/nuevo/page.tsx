import Link from "next/link";
import { redirect } from "next/navigation";
import { createEvent, getCurrentProfile } from "@/app/actions/events";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listD1Clients } from "@/lib/cloudflare/public-events";
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
  const profile = await getCurrentProfile();
  const isCloudflareMode = process.env.USE_CLOUDFLARE_AUTH === "1";
  const supabase = isCloudflareMode ? null : await createClient();
  const admin = isCloudflareMode ? null : createAdminClient();
  if (!canCreateEvents(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para crear eventos.");
  }
  const [{ data: clientsData }, { data: businessClientsData }, categories, themes] = isCloudflareMode
    ? await Promise.all([
        Promise.resolve({ data: [] }),
        timed("new-event-business-clients-d1", listD1Clients()).then((data) => ({
          data: data.filter((client) => client.status === "activo"),
        })),
        Promise.resolve([]),
        Promise.resolve([]),
      ])
    : await Promise.all([
        canManageEvents(profile)
          ? timed(
              "new-event-profile-clients",
              supabase!
                .from("profiles")
                .select("id,full_name,email,role,is_active,created_at")
                .eq("role", "cliente")
                .order("created_at", { ascending: false })
            )
          : Promise.resolve({ data: [] }),
        timed(
          "new-event-business-clients",
          admin!.from("clients").select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by").eq("status", "activo").order("name", { ascending: true })
        ),
        timed("new-event-categories", fetchActiveCategories()),
        timed("new-event-themes", fetchActiveThemes())
      ]);
  const clients = clientsData ?? [];
  const businessClients = (businessClientsData ?? []) as Client[];
  const activeCategories = categories as EventCategory[];
  const activeThemes = themes as InvitationTheme[];

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-[#eadfd2] bg-[#fffaf3] px-5 py-2 shadow-[0_22px_72px_-58px_rgba(17,24,39,0.75)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-accent">KAIS Dashboard</p>
          <h1 className="font-display text-xl text-[#3b1721]">Crear evento</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Completa solo lo necesario: datos del evento, tema visual, contenido, multimedia y RSVP.
          </p>
          {query.error ? <p className="mt-3 text-sm font-semibold text-red-600">{query.error}</p> : null}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Cancelar / Volver</Link>
        </Button>
      </div>

      <Card className="min-h-0 border-[#eadfd2] shadow-[0_24px_70px_rgba(74,23,36,0.07)]">
        <CardContent className="h-full p-3">
          <EventForm
            action={isCloudflareMode ? "/api/dashboard/events/create" : createEvent}
            clients={clients}
            businessClients={businessClients}
            categories={activeCategories}
            themes={activeThemes}
            showOwner={canManageEvents(profile)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
