import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInitialCanvasV3Design, type CanvasV3EventData } from "@/lib/canvas-v3/initial-design";
import { CanvasV3PublicRenderer } from "@/app/dashboard/eventos/[id]/canvas-v3/canvas-v3-public-renderer";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    return { title: `Preview V3 \xc2\xb7 ${slug}` };
  } catch {
    return { title: "Preview V3" };
  }
}

/** Re-throw Next.js framework errors (notFound, redirect, etc.) so they work normally. */
function isNextInternalError(err: unknown): boolean {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_") || err.message === "NEXT_NOT_FOUND") return true;
  }
  return false;
}

const noDesignUI = (slug: string) => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f0f17",
      fontFamily: "Inter, system-ui, sans-serif",
      gap: 16,
      padding: 32,
      textAlign: "center",
    }}
  >
    <span style={{ fontSize: 40, opacity: 0.25 }}>◻</span>
    <p style={{ color: "#8884a8", fontSize: 15, margin: 0, lineHeight: 1.5 }}>
      Este evento aún no tiene diseño V3.
    </p>
    <a
      href={`/evento/${slug}`}
      style={{
        marginTop: 8,
        padding: "8px 20px",
        background: "rgba(124,58,237,0.18)",
        border: "1px solid rgba(124,58,237,0.4)",
        borderRadius: 10,
        color: "#c4b5fd",
        fontSize: 13,
        textDecoration: "none",
      }}
    >
      Ver invitación principal
    </a>
  </div>
);

const errorUI = (
  <div
    style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 14,
    }}
  >
    Error cargando preview V3
  </div>
);

export default async function PreviewV3Page({ params }: Props) {
  const { slug } = await params;

  try {
    const admin = createAdminClient();
    const { data, error: dbError } = await admin
      .from("events")
      .select("id, slug, event_type, hosts_names, title, canvas_design, event_date, event_time, address, google_maps_link, main_message, quinceanera_name, parents_names, church_name, church_time, dress_code, color_palette, theme, quince_message, parents_message, graduate_name, graduation_type, institution_name, academic_program, degree_title, promotion_name, academic_ceremony_place, academic_ceremony_time, reception_place, reception_time, family_message, graduate_message, package_key, whatsapp_phone")
      .eq("slug", slug)
      .maybeSingle();

    if (dbError) {
      console.error("[preview-v3] db error", dbError);
      return errorUI;
    }

    if (!data) notFound();

    const design = resolveInitialCanvasV3Design(data as unknown as CanvasV3EventData);

    const eventTitle = data.hosts_names || data.title || "Evento";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#fff8f0 0%,#f7eadc 55%,#f1dccd 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
          overflowX: "hidden",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            boxSizing: "border-box",
            marginBottom: 0,
            background: "rgba(255,248,240,0.92)",
            borderBottom: "1px solid rgba(184,146,90,0.18)",
          }}
        >
          <a
            href={`/evento/${slug}`}
            style={{
              color: "#8884a8",
              fontSize: 12,
              textDecoration: "none",
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid rgba(184,146,90,0.28)",
              background: "rgba(255,252,247,0.78)",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            ← Invitación principal
          </a>
          <span
            style={{
              color: "#c8a96a",
              fontSize: 11,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "0.08em",
              fontWeight: "600",
            }}
          >
            PREVIEW V3
          </span>
        </div>

        {/* Canvas renderer — el renderer normaliza internamente */}
        <div style={{ width: "100%", maxWidth: "100vw", padding: 0, overflowX: "hidden" }}>
          <CanvasV3PublicRenderer
            design={design}
            eventTitle={eventTitle}
            eventSlug={data.slug ?? slug}
            eventDate={data.event_date && data.event_time ? `${data.event_date}T${data.event_time}` : undefined}
            mode="preview"
          />
        </div>
      </div>
    );
  } catch (error) {
    // Re-throw Next.js framework errors so notFound / redirect work normally
    if (isNextInternalError(error)) throw error;
    console.error("[preview-v3]", error);
    return errorUI;
  }
}
