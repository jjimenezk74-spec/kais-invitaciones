import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CanvasV3PublicRenderer,
  normalizePublicV3Design,
} from "@/app/dashboard/eventos/[id]/canvas-v3/canvas-v3-public-renderer";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    return { title: `Preview V3 · ${slug}` };
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
      .select("id, slug, hosts_names, title, canvas_design")
      .eq("slug", slug)
      .maybeSingle();

    if (dbError) {
      console.error("[preview-v3] db error", dbError);
      return errorUI;
    }

    if (!data) notFound();

    // ── diagnostic log (temporary) ──────────────────────────────────────────
    const rawDesign = data.canvas_design as Record<string, unknown> | null | undefined;
    const rawType = rawDesign === null ? "null" : typeof rawDesign;
    const sectionsCount = Array.isArray(rawDesign?.sections) ? rawDesign!.sections.length : -1;
    const elementsCount = Array.isArray(rawDesign?.elements) ? rawDesign!.elements.length : -1;

    let design = null;
    try {
      design = normalizePublicV3Design(data.canvas_design);
    } catch (normErr) {
      console.error("[preview-v3] normalize error", normErr);
    }

    const normalizedSectionsCount = design?.sections.length ?? -1;
    console.log("[preview-v3]", { slug, rawType, sectionsCount, elementsCount, normalizedSectionsCount, designNull: design === null });

    if (!design) return noDesignUI(slug);

    const eventTitle = data.hosts_names || data.title || "Evento";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f0f17",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 48,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            marginBottom: 20,
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
              border: "1px solid #2a2a3d",
              background: "#16161f",
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

        {/* Canvas renderer */}
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
          <CanvasV3PublicRenderer
            design={design}
            eventTitle={eventTitle}
            eventSlug={data.slug ?? slug}
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
