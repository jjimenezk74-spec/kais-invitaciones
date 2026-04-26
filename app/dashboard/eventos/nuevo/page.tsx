import { createEvent, getCurrentProfile } from "@/app/actions/events";
import { EventForm } from "@/components/event-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function NewEventPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const { data: clientsData } =
    profile?.role === "admin"
      ? await supabase.from("profiles").select("*").eq("role", "cliente").order("created_at", { ascending: false })
      : { data: [] };
  const clients = clientsData ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-3xl">Crear evento</CardTitle>
        {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
      </CardHeader>
      <CardContent>
        <EventForm action={createEvent} clients={clients} showOwner={profile?.role === "admin"} />
      </CardContent>
    </Card>
  );
}
