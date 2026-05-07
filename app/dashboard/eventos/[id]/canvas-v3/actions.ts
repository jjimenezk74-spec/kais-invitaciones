"use server";

import { revalidatePath } from "next/cache";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CANVAS_V3_JSON_BYTES = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanvasV3Design(value: unknown) {
  if (!isRecord(value)) return false;
  if (value.version !== 3) return false;
  if (value.width !== 390 || typeof value.height !== "number" || value.height < 844) return false;
  if (typeof value.themeId !== "string") return false;
  if (!Array.isArray(value.elements)) return false;
  if (!Array.isArray(value.sections)) return false;

  const sectionsAreValid = value.sections.every((section) => {
    if (!isRecord(section)) return false;
    return (
      typeof section.id === "string" &&
      typeof section.label === "string" &&
      typeof section.y === "number" &&
      typeof section.height === "number" &&
      typeof section.background === "string"
    );
  });

  if (!sectionsAreValid) return false;

  return value.elements.every((element) => {
    if (!isRecord(element)) return false;
    return (
      typeof element.id === "string" &&
      typeof element.type === "string" &&
      typeof element.x === "number" &&
      typeof element.y === "number" &&
      typeof element.width === "number" &&
      (typeof element.height === "number" || element.height === null) &&
      typeof element.locked === "boolean" &&
      typeof element.visible === "boolean" &&
      typeof element.zIndex === "number"
    );
  });
}

export async function saveCanvasDesignV3(
  eventId: string,
  design: unknown
): Promise<{ ok: boolean; error: string | null }> {
  const { profile } = await getCurrentUserProfile();

  if (!canEditEventDesign(profile)) {
    return { ok: false, error: "No tenes permisos para editar el diseno del evento." };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
    return { ok: false, error: "Evento invalido." };
  }

  if (!isCanvasV3Design(design)) {
    return { ok: false, error: "El diseno V3 no tiene un formato valido." };
  }

  const json = JSON.stringify(design);
  if (json.length > MAX_CANVAS_V3_JSON_BYTES) {
    return { ok: false, error: "El diseno excede el tamano maximo permitido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({
      canvas_design: design,
      updated_at: new Date().toISOString()
    })
    .eq("id", eventId);

  if (error) {
    console.error("[CANVAS V3] save failed", error);
    return { ok: false, error: "No se pudo guardar el diseno." };
  }

  revalidatePath(`/dashboard/eventos/${eventId}`);
  revalidatePath(`/dashboard/eventos/${eventId}/canvas-v3`);

  return { ok: true, error: null };
}
