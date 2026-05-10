import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInitialCanvasV3Design, type CanvasV3EventData } from "@/lib/canvas-v3/initial-design";
import { normalizeCanvasV3EventType } from "@/lib/canvas-v3/ceremonial-structures";
import { listCanvasV3Templates } from "@/app/dashboard/canvas-v3/templates/actions";
import { CanvasEditorV3 } from "./canvas-v3-editor";
import type { Event } from "@/lib/types";

// Subset of Event columns fetched by this page.
// Typed manually because Supabase cannot infer columns from a runtime-concatenated
// string — using a Pick over the canonical Event type keeps this safe.
type EventV3Row = Pick<
  Event,
  | "id"
  | "slug"
  | "event_type"
  | "hosts_names"
  | "title"
  | "canvas_design"
  | "event_date"
  | "event_time"
  | "address"
  | "main_message"
  | "quinceanera_name"
  | "parents_names"
  | "church_name"
  | "church_time"
  | "dress_code"
  | "color_palette"
  | "theme"
  | "quince_message"
  | "parents_message"
  | "graduate_name"
  | "graduation_type"
  | "institution_name"
  | "academic_program"
  | "degree_title"
  | "promotion_name"
  | "academic_ceremony_place"
  | "academic_ceremony_time"
  | "reception_place"
  | "reception_time"
  | "family_message"
  | "graduate_message"
  | "package_key"
  | "enabled_features"
  | "disabled_features"
  | "whatsapp_phone"
  | "google_maps_link"
  | "music_url"
  | "updated_at"
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
    .select("id, slug, event_type, hosts_names, title, canvas_design, event_date, event_time, address, google_maps_link, main_message, quinceanera_name, parents_names, church_name, church_time, dress_code, color_palette, theme, quince_message, parents_message, graduate_name, graduation_type, institution_name, academic_program, degree_title, promotion_name, academic_ceremony_place, academic_ceremony_time, reception_place, reception_time, family_message, graduate_message, package_key, enabled_features, disabled_features, whatsapp_phone, music_url, updated_at")
    .eq(isUuid(id) ? "id" : "slug", id)
    .maybeSingle();

  if (!rawData) notFound();
  // Single cast — all accesses below are fully typed via EventV3Row.
  const data = rawData as unknown as EventV3Row;
  const initialDesign = resolveInitialCanvasV3Design(data as unknown as CanvasV3EventData);
  const normalizedEventType = normalizeCanvasV3EventType(data.event_type);
  const templatesResult = await listCanvasV3Templates({ activeOnly: true, scope: "full" });
  const canvasTemplates = templatesResult.ok
    ? templatesResult.data
        .filter((template) => {
          if (!normalizedEventType) return true;
          return template.compatibleEventTypes.length === 0 || template.compatibleEventTypes.includes(normalizedEventType);
        })
        .map((template) => ({
          id: template.id ?? "",
          name: template.name,
          slug: template.slug,
          compatibleEventTypes: template.compatibleEventTypes,
          visualCategory: template.visualCategory ?? null,
          description: template.description ?? null,
          templateScope: template.templateScope,
          previewImageUrl: template.previewImageUrl ?? null,
          thumbnailUrl: template.thumbnailUrl ?? null,
          isPremium: Boolean(template.isPremium),
        }))
        .filter((template) => template.id)
    : [];

  return (
    <div className="fixed inset-0 z-[9999] h-dvh w-screen overflow-hidden bg-[#0f0f17]">
      <CanvasEditorV3
        key={`${data.id}:${data.updated_at ?? ""}`}
        eventId={data.id}
        eventSlug={data.slug ?? id}
        eventTitle={data.hosts_names || data.title || "Evento"}
        initialDesign={initialDesign}
        eventDate={data.event_date && data.event_time ? `${data.event_date}T${data.event_time}` : undefined}
        packageKey={data.package_key ?? null}
        enabledFeatures={data.enabled_features ?? []}
        disabledFeatures={data.disabled_features ?? []}
        whatsappPhone={data.whatsapp_phone ?? null}
        googleMapsLink={data.google_maps_link ?? null}
        musicUrl={data.music_url ?? null}
        canvasTemplates={canvasTemplates}
      />
    </div>
  );
}
