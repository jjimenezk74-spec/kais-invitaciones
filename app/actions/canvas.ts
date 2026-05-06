"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeCanvasDesign } from "@/lib/canvas/normalize-canvas-design";
import { isKaisAdmin } from "@/lib/profiles";
import type { CanvasDesign } from "@/lib/types";

const MAX_CANVAS_JSON_BYTES = 500_000; // 500 KB

// ─────────────────────────────────────────────────────────────────────────────
// saveCanvasDesign
// Persiste el JSON de canvas_design en events. No toca ningún otro campo.
// ─────────────────────────────────────────────────────────────────────────────
export async function saveCanvasDesign(
  eventId: string,
  design: CanvasDesign
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Autorización: solo admins de KAIS pueden editar
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isKaisAdmin(profile.role)) {
    return { error: "Sin permiso para editar el diseño" };
  }

  const normalizedDesign = normalizeCanvasDesign(design);

  // Validar tamaño del JSON
  const json = JSON.stringify(normalizedDesign);
  if (json.length > MAX_CANVAS_JSON_BYTES) {
    return { error: `El diseño excede el tamaño máximo permitido (${MAX_CANVAS_JSON_BYTES / 1000} KB)` };
  }

  // Validar versión mínima del schema
  if (normalizedDesign.version !== 1) {
    return { error: "Versión de diseño no soportada" };
  }

  const { error } = await supabase
    .from("events")
    .update({
      canvas_design: normalizedDesign,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/eventos/${eventId}`);
  // La invitación pública se revalida por slug — se hace desde la UI
  // cuando se conoce el slug, para no requerir un fetch extra aquí.

  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// clearCanvasDesign
// Elimina el canvas_design de un evento, volviendo al modo plantilla/tema.
// ─────────────────────────────────────────────────────────────────────────────
export async function clearCanvasDesign(
  eventId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isKaisAdmin(profile.role)) {
    return { error: "Sin permiso" };
  }

  const { error } = await supabase
    .from("events")
    .update({
      canvas_design: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/eventos/${eventId}`);
  return { error: null };
}
