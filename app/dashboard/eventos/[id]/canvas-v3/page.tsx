import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorV3 } from "./canvas-v3-editor";

type Props = { params: Promise<{ id: string }> };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function generateMetadata() {
  return { title: "Canvas V3 · Editor experimental" };
}

export default async function CanvasV3Page({ params }: Props) {
  const { id } = await params;
  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, title, canvas_design, event_date, event_time")
    .eq(isUuid(id) ? "id" : "slug", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="fixed inset-0 z-[9999] h-dvh w-screen overflow-hidden bg-[#0f0f17]">
      <CanvasEditorV3
        eventId={data.id}
        eventSlug={data.slug ?? id}
        eventTitle={data.hosts_names || data.title || "Evento"}
        initialDesign={data.canvas_design ?? null}
        eventDate={data.event_date && data.event_time ? `${data.event_date}T${data.event_time}` : undefined}
      />
    </div>
  );
}
