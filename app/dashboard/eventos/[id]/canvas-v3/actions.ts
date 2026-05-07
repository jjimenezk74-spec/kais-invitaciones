"use server";

import { revalidatePath } from "next/cache";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CANVAS_V3_JSON_BYTES = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Returns the first failed check as a string, or null if the design is valid.
 * This replaces the silent boolean validator so we can log why it failed.
 */
function validateCanvasV3Design(value: unknown): string | null {
  if (!isRecord(value)) return "not an object";
  if (value.version !== 3) return `version !== 3 (got ${String(value.version)})`;

  // Width: must be close to 390 (allow minor float drift)
  const w = Number(value.width);
  if (!Number.isFinite(w) || w < 380 || w > 400) {
    return `invalid width: ${String(value.width)}`;
  }

  // Height: must be a positive number — removed the arbitrary ≥844 lower bound
  // because the editor may compute a different value depending on sections.
  const h = Number(value.height);
  if (!Number.isFinite(h) || h <= 0) {
    return `invalid height: ${String(value.height)}`;
  }

  // themeId: string, but tolerate missing (will be defaulted below before saving)
  if (value.themeId !== undefined && typeof value.themeId !== "string") {
    return `invalid themeId type: ${typeof value.themeId}`;
  }

  if (!Array.isArray(value.sections)) return "sections is not an array";
  if (!Array.isArray(value.elements)) return "elements is not an array";
  if (value.sections.length === 0) return "sections is empty";

  for (let i = 0; i < value.sections.length; i++) {
    const s = value.sections[i];
    if (!isRecord(s)) return `section[${i}] is not a record`;
    if (typeof s.id !== "string") return `section[${i}].id is not a string`;
    if (typeof s.label !== "string") return `section[${i}].label is not a string`;
    if (!Number.isFinite(Number(s.y))) return `section[${i}].y is not finite: ${String(s.y)}`;
    if (!Number.isFinite(Number(s.height))) return `section[${i}].height is not finite: ${String(s.height)}`;
    if (typeof s.background !== "string") return `section[${i}].background is not a string`;
  }

  for (let i = 0; i < value.elements.length; i++) {
    const el = value.elements[i];
    if (!isRecord(el)) return `element[${i}] is not a record`;
    if (typeof el.id !== "string") return `element[${i}].id is not a string`;
    if (typeof el.type !== "string") return `element[${i}].type is not a string`;
    if (!Number.isFinite(Number(el.x))) return `element[${i}].x is not finite: ${String(el.x)}`;
    if (!Number.isFinite(Number(el.y))) return `element[${i}].y is not finite: ${String(el.y)}`;
    if (!Number.isFinite(Number(el.width))) return `element[${i}].width is not finite: ${String(el.width)}`;
    // height may be null or a finite number (not undefined)
    if (el.height !== null && el.height !== undefined && !Number.isFinite(Number(el.height))) {
      return `element[${i}].height is invalid: ${String(el.height)}`;
    }
    if (typeof el.locked !== "boolean") return `element[${i}].locked is not boolean`;
    if (typeof el.visible !== "boolean") return `element[${i}].visible is not boolean`;
    if (!Number.isFinite(Number(el.zIndex))) return `element[${i}].zIndex is not finite: ${String(el.zIndex)}`;
  }

  return null; // valid
}

function sanitiseDesign(value: Record<string, unknown>): Record<string, unknown> {
  const sections = (value.sections as Record<string, unknown>[]).map((s) => ({
    ...s,
    y: Number(s.y),
    height: Number(s.height),
  }));

  const elements = (value.elements as Record<string, unknown>[]).map((el) => ({
    ...el,
    x: Number(el.x),
    y: Number(el.y),
    width: Number(el.width),
    height: el.height != null ? Number(el.height) : null,
    zIndex: Number(el.zIndex),
  }));

  return {
    ...value,
    version: 3,
    viewport: "mobile",
    width: 390,
    height: Number(value.height),
    themeId: typeof value.themeId === "string" ? value.themeId : "kais-luxury",
    sections,
    elements,
  };
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

  console.log("[save-v3] saving", {
    eventId,
    version: isRecord(design) ? design.version : undefined,
    width: isRecord(design) ? design.width : undefined,
    height: isRecord(design) ? design.height : undefined,
    themeId: isRecord(design) ? design.themeId : undefined,
    hasSections: isRecord(design) && Array.isArray(design.sections),
    sectionCount: isRecord(design) && Array.isArray(design.sections) ? design.sections.length : 0,
    hasElements: isRecord(design) && Array.isArray(design.elements),
    elementCount: isRecord(design) && Array.isArray(design.elements) ? design.elements.length : 0,
  });

  const validationError = validateCanvasV3Design(design);
  if (validationError) {
    console.error("[save-v3] validation failed:", validationError);
    return { ok: false, error: `Diseno invalido: ${validationError}` };
  }

  const sanitised = sanitiseDesign(design as Record<string, unknown>);

  const json = JSON.stringify(sanitised);
  if (json.length > MAX_CANVAS_V3_JSON_BYTES) {
    return { ok: false, error: "El diseno excede el tamano maximo permitido (500KB)." };
  }

  console.log("[save-v3] json length:", json.length, "bytes");

  const admin = createAdminClient();
  const { error: dbError } = await admin
    .from("events")
    .update({
      canvas_design: sanitised,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (dbError) {
    console.error("[save-v3] supabase update failed", {
      code: dbError.code,
      message: dbError.message,
      details: dbError.details,
    });
    return { ok: false, error: `No se pudo guardar: ${dbError.message}` };
  }

  console.log("[save-v3] saved OK", { eventId });

  revalidatePath(`/dashboard/eventos/${eventId}`);
  revalidatePath(`/dashboard/eventos/${eventId}/canvas-v3`);

  return { ok: true, error: null };
}
