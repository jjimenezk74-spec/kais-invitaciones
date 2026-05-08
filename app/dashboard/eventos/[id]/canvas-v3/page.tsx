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
    .select(
      "id, slug, hosts_names, title, canvas_design, event_date, event_time, " +
      "package_key, enabled_features, disabled_features, " +
      "whatsapp_phone, google_maps_link, music_url"
    )
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
        packageKey={(data as Record<string, unknown>).package_key as string ?? null}
        enabledFeatures={(data as Record<string, unknown>).enabled_features as string[] ?? []}
        disabledFeatures={(data as Record<string, unknown>).disabled_features as string[] ?? []}
        whatsappPhone={(data as Record<string, unknown>).whatsapp_phone as string ?? null}
        googleMapsLink={(data as Record<string, unknown>).google_maps_link as string ?? null}
        musicUrl={(data as Record<string, unknown>).music_url as string ?? null}
      />
    </div>
  );
}
