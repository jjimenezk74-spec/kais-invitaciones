import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorV3 } from "./canvas-v3-editor";
import type { Event } from "@/lib/types";

// Subset of Event columns fetched by this page.
// Typed manually because Supabase cannot infer columns from a runtime-concatenated
// string — using a Pick over the canonical Event type keeps this safe.
type EventV3Row = Pick<
  Event,
  | "id"
  | "slug"
  | "hosts_names"
  | "title"
  | "canvas_design"
  | "event_date"
  | "event_time"
  | "package_key"
  | "enabled_features"
  | "disabled_features"
  | "whatsapp_phone"
  | "google_maps_link"
  | "music_url"
>;

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
  // Single string literal — required for Supabase to infer column types correctly.
  // We cast the result to EventV3Row because the generated DB types may not include
  // every column we added (package_key, etc.) depending on the local type snapshot.
  const { data: rawData } = await admin
    .from("events")
    .select("id, slug, hosts_names, title, canvas_design, event_date, event_time, package_key, enabled_features, disabled_features, whatsapp_phone, google_maps_link, music_url")
    .eq(isUuid(id) ? "id" : "slug", id)
    .maybeSingle();

  if (!rawData) notFound();
  // Single cast — all accesses below are fully typed via EventV3Row.
  const data = rawData as unknown as EventV3Row;

  return (
    <div className="fixed inset-0 z-[9999] h-dvh w-screen overflow-hidden bg-[#0f0f17]">
      <CanvasEditorV3
        eventId={data.id}
        eventSlug={data.slug ?? id}
        eventTitle={data.hosts_names || data.title || "Evento"}
        initialDesign={data.canvas_design ?? null}
        eventDate={data.event_date && data.event_time ? `${data.event_date}T${data.event_time}` : undefined}
        packageKey={data.package_key ?? null}
        enabledFeatures={data.enabled_features ?? []}
        disabledFeatures={data.disabled_features ?? []}
        whatsappPhone={data.whatsapp_phone ?? null}
        googleMapsLink={data.google_maps_link ?? null}
        musicUrl={data.music_url ?? null}
      />
    </div>
  );
}
