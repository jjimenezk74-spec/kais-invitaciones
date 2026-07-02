"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  extractCanvasV3TemplateFromEventDesign,
  getCompatibleCanvasV3EventTypes,
  hydrateCanvasV3Template,
  sanitizeCanvasV3TemplateDesign,
  type CanvasV3Template,
  type CanvasV3TemplateScope,
} from "@/lib/canvas-v3/templates";
import {
  isValidCanvasV3Design,
  type CanvasV3EventData,
} from "@/lib/canvas-v3/initial-design";
import {
  normalizeCanvasV3EventType,
  type CanvasV3EventType,
} from "@/lib/canvas-v3/ceremonial-structures";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getD1CanvasV3TemplateById, getD1EventByIdOrSlug, updateD1CanvasDesign } from "@/lib/cloudflare/public-events";
import { isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type CanvasV3TemplateRow = {
  id: string;
  name: string;
  slug: string;
  compatible_event_types: string[];
  visual_category: string | null;
  description: string | null;
  template_scope: CanvasV3TemplateScope;
  design: unknown;
  preview_image_url: string | null;
  thumbnail_url: string | null;
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
  source_event_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ListCanvasV3TemplatesFilters = {
  eventType?: string | null;
  activeOnly?: boolean;
  scope?: CanvasV3TemplateScope | null;
};

export type CreateCanvasV3TemplateInput = {
  name: unknown;
  slug: unknown;
  compatibleEventTypes?: unknown;
  visualCategory?: unknown;
  description?: unknown;
  templateScope?: unknown;
  design: unknown;
  previewImageUrl?: unknown;
  thumbnailUrl?: unknown;
  isPremium?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
  sourceEventId?: unknown;
};

export type UpdateCanvasV3TemplateInput = Partial<CreateCanvasV3TemplateInput>;

export type CreateCanvasV3TemplateFromEventInput = Omit<CreateCanvasV3TemplateInput, "design">;

const TEMPLATE_SELECT = [
  "id",
  "name",
  "slug",
  "compatible_event_types",
  "visual_category",
  "description",
  "template_scope",
  "design",
  "preview_image_url",
  "thumbnail_url",
  "is_premium",
  "is_active",
  "sort_order",
  "source_event_id",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

const CANVAS_V3_EVENT_SELECT = [
  "id",
  "slug",
  "event_type",
  "hosts_names",
  "title",
  "canvas_design",
  "event_date",
  "event_time",
  "address",
  "google_maps_link",
  "main_message",
  "quinceanera_name",
  "parents_names",
  "church_name",
  "church_time",
  "dress_code",
  "color_palette",
  "theme",
  "quince_message",
  "parents_message",
  "graduate_name",
  "graduation_type",
  "institution_name",
  "academic_program",
  "degree_title",
  "promotion_name",
  "academic_ceremony_place",
  "academic_ceremony_time",
  "reception_place",
  "reception_time",
  "family_message",
  "graduate_message",
  "package_key",
  "whatsapp_phone",
].join(", ");

const MAX_TEMPLATE_JSON_BYTES = 500_000;
const TEMPLATE_SCOPES = new Set<CanvasV3TemplateScope>(["full", "section", "component"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanOptionalText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function cleanSlug(value: unknown) {
  return cleanText(value).toLowerCase();
}

function cleanOptionalUrl(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  if (/^(https?:\/\/|\/)/i.test(text) && !/^(data:|blob:)/i.test(text) && text.length <= 2_000) return text;
  return null;
}

function getTemplateScope(value: unknown): CanvasV3TemplateScope {
  const scope = cleanText(value) as CanvasV3TemplateScope;
  return TEMPLATE_SCOPES.has(scope) ? scope : "full";
}

function getSortOrder(value: unknown) {
  const sortOrder = Number(value);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0;
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function getCompatibleEventTypes(value: unknown): CanvasV3EventType[] {
  const rawValues = Array.isArray(value) ? value : [];
  const normalized = rawValues
    .map((item) => normalizeCanvasV3EventType(cleanText(item)))
    .filter((item): item is CanvasV3EventType => Boolean(item));
  return Array.from(new Set(normalized));
}

function mapTemplateRow(row: CanvasV3TemplateRow): CanvasV3Template & {
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    compatibleEventTypes: row.compatible_event_types
      .map((eventType) => normalizeCanvasV3EventType(eventType))
      .filter((eventType): eventType is CanvasV3EventType => Boolean(eventType)),
    visualCategory: row.visual_category ?? undefined,
    description: row.description ?? undefined,
    templateScope: row.template_scope,
    design: row.design as CanvasV3Template["design"],
    previewImageUrl: row.preview_image_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    isPremium: row.is_premium,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    sourceEventId: row.source_event_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthenticatedClient(): Promise<ActionResult<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}>> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, error: "Debes iniciar sesion para gestionar plantillas Canvas V3." };
  }

  return { ok: true, data: { supabase, userId: user.id } };
}

function buildCreatePayload(input: CreateCanvasV3TemplateInput, userId: string) {
  const name = cleanText(input.name);
  const slug = cleanSlug(input.slug);
  if (!name) return { ok: false as const, error: "El nombre de la plantilla es obligatorio." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false as const, error: "El slug debe usar minusculas, numeros y guiones." };
  }

  const design = sanitizeCanvasV3TemplateDesign(input.design);
  if (!design) return { ok: false as const, error: "El design no es un Canvas V3 valido o seguro." };
  if (JSON.stringify(design).length > MAX_TEMPLATE_JSON_BYTES) {
    return { ok: false as const, error: "La plantilla excede el tamano maximo permitido (500KB)." };
  }

  return {
    ok: true as const,
    data: {
      name,
      slug,
      compatible_event_types: getCompatibleEventTypes(input.compatibleEventTypes),
      visual_category: cleanOptionalText(input.visualCategory),
      description: cleanOptionalText(input.description),
      template_scope: getTemplateScope(input.templateScope),
      design,
      preview_image_url: cleanOptionalUrl(input.previewImageUrl),
      thumbnail_url: cleanOptionalUrl(input.thumbnailUrl),
      is_premium: getBoolean(input.isPremium),
      is_active: getBoolean(input.isActive),
      sort_order: getSortOrder(input.sortOrder),
      source_event_id: typeof input.sourceEventId === "string" && isUuid(input.sourceEventId) ? input.sourceEventId : null,
      created_by: userId,
    },
  };
}

function buildUpdatePayload(input: UpdateCanvasV3TemplateInput) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = cleanText(input.name);
    if (!name) return { ok: false as const, error: "El nombre de la plantilla no puede estar vacio." };
    payload.name = name;
  }
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { ok: false as const, error: "El slug debe usar minusculas, numeros y guiones." };
    }
    payload.slug = slug;
  }
  if (input.compatibleEventTypes !== undefined) {
    payload.compatible_event_types = getCompatibleEventTypes(input.compatibleEventTypes);
  }
  if (input.visualCategory !== undefined) payload.visual_category = cleanOptionalText(input.visualCategory);
  if (input.description !== undefined) payload.description = cleanOptionalText(input.description);
  if (input.templateScope !== undefined) payload.template_scope = getTemplateScope(input.templateScope);
  if (input.previewImageUrl !== undefined) payload.preview_image_url = cleanOptionalUrl(input.previewImageUrl);
  if (input.thumbnailUrl !== undefined) payload.thumbnail_url = cleanOptionalUrl(input.thumbnailUrl);
  if (input.isPremium !== undefined) payload.is_premium = getBoolean(input.isPremium);
  if (input.isActive !== undefined) payload.is_active = getBoolean(input.isActive);
  if (input.sortOrder !== undefined) payload.sort_order = getSortOrder(input.sortOrder);
  if (input.design !== undefined) {
    const design = sanitizeCanvasV3TemplateDesign(input.design);
    if (!design) return { ok: false as const, error: "El design no es un Canvas V3 valido o seguro." };
    if (JSON.stringify(design).length > MAX_TEMPLATE_JSON_BYTES) {
      return { ok: false as const, error: "La plantilla excede el tamano maximo permitido (500KB)." };
    }
    payload.design = design;
  }

  return { ok: true as const, data: payload };
}

export async function listCanvasV3Templates(
  filters: ListCanvasV3TemplatesFilters = {}
): Promise<ActionResult<CanvasV3Template[]>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;

  let query = auth.data.supabase
    .from("canvas_v3_templates")
    .select(TEMPLATE_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters.activeOnly) query = query.eq("is_active", true);
  if (filters.scope) query = query.eq("template_scope", getTemplateScope(filters.scope));
  if (filters.eventType) {
    const eventType = normalizeCanvasV3EventType(filters.eventType);
    if (eventType) query = query.contains("compatible_event_types", [eventType]);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as unknown as CanvasV3TemplateRow[]).map(mapTemplateRow) };
}

export async function getCanvasV3Template(idOrSlug: string): Promise<ActionResult<CanvasV3Template | null>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;

  const value = cleanText(idOrSlug);
  if (!value) return { ok: false, error: "Identificador de plantilla invalido." };

  const query = auth.data.supabase
    .from("canvas_v3_templates")
    .select(TEMPLATE_SELECT);

  const { data, error } = (isUuid(value)
    ? await query.eq("id", value).maybeSingle()
    : await query.eq("slug", value).maybeSingle());

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ? mapTemplateRow(data as unknown as CanvasV3TemplateRow) : null };
}

export async function createCanvasV3Template(
  input: CreateCanvasV3TemplateInput
): Promise<ActionResult<CanvasV3Template>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;

  const payload = buildCreatePayload(input, auth.data.userId);
  if (!payload.ok) return payload;

  const { data, error } = await auth.data.supabase
    .from("canvas_v3_templates")
    .insert(payload.data)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapTemplateRow(data as unknown as CanvasV3TemplateRow) };
}

export async function updateCanvasV3Template(
  id: string,
  input: UpdateCanvasV3TemplateInput
): Promise<ActionResult<CanvasV3Template>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  if (!isUuid(id)) return { ok: false, error: "ID de plantilla invalido." };

  const payload = buildUpdatePayload(input);
  if (!payload.ok) return payload;
  if (Object.keys(payload.data).length === 0) return { ok: false, error: "No hay cambios para guardar." };

  const { data, error } = await auth.data.supabase
    .from("canvas_v3_templates")
    .update(payload.data)
    .eq("id", id)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapTemplateRow(data as unknown as CanvasV3TemplateRow) };
}

export async function toggleCanvasV3TemplateActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<CanvasV3Template>> {
  return updateCanvasV3Template(id, { isActive });
}

export async function deleteCanvasV3Template(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  if (!isUuid(id)) return { ok: false, error: "ID de plantilla invalido." };

  const { error } = await auth.data.supabase
    .from("canvas_v3_templates")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id } };
}

export async function createCanvasV3TemplateFromEvent(
  eventId: string,
  input: CreateCanvasV3TemplateFromEventInput
): Promise<ActionResult<CanvasV3Template>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  if (!isUuid(eventId)) return { ok: false, error: "ID de evento invalido." };

  const { data: event, error: eventError } = await auth.data.supabase
    .from("events")
    .select("id,event_type,canvas_design")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) return { ok: false, error: eventError.message };
  if (!event) return { ok: false, error: "Evento no encontrado." };

  const design = extractCanvasV3TemplateFromEventDesign(event.canvas_design, {
    eventType: event.event_type,
    templateScope: getTemplateScope(input.templateScope),
  });
  if (!design) return { ok: false, error: "El evento no tiene un canvas_design V3 valido para convertir en plantilla." };

  return createCanvasV3Template({
    ...input,
    compatibleEventTypes: getCompatibleEventTypes(input.compatibleEventTypes).length > 0
      ? input.compatibleEventTypes
      : getCompatibleCanvasV3EventTypes(event.event_type),
    design,
    sourceEventId: eventId,
  });
}

export async function applyCanvasV3TemplateToEvent(
  eventId: string,
  templateId: string
): Promise<ActionResult<{ eventId: string; eventSlug: string | null; templateId: string }>> {
  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) {
    return { ok: false, error: "Tu rol no tiene permisos para editar el diseno del evento." };
  }
  if (!isUuid(eventId)) return { ok: false, error: "ID de evento invalido." };
  if (!isUuid(templateId)) return { ok: false, error: "ID de plantilla invalido." };

  if (isCloudflareAuthEnabled()) {
    const [template, event] = await Promise.all([
      getD1CanvasV3TemplateById(templateId),
      getD1EventByIdOrSlug(eventId)
    ]);

    if (!template) return { ok: false, error: "Plantilla Canvas V3 no encontrada." };
    if (template.templateScope !== "full") {
      return { ok: false, error: "Solo se pueden aplicar plantillas completas a un evento." };
    }
    if (!event) return { ok: false, error: "Evento no encontrado." };

    const eventType = normalizeCanvasV3EventType(event.event_type);
    if (template.compatibleEventTypes.length > 0 && eventType && !template.compatibleEventTypes.includes(eventType)) {
      return { ok: false, error: `La plantilla no es compatible con eventos ${eventType}.` };
    }

    const currentDesign = isValidCanvasV3Design(event.canvas_design) ? event.canvas_design : undefined;
    const hydratedDesign = hydrateCanvasV3Template(template.design, event as unknown as CanvasV3EventData, currentDesign);
    if (!hydratedDesign) {
      return { ok: false, error: "No se pudo hidratar la plantilla con los datos del evento." };
    }

    await updateD1CanvasDesign(eventId, hydratedDesign);

    revalidatePath(`/dashboard/eventos/${eventId}`);
    revalidatePath(`/dashboard/eventos/${eventId}/canvas-v3`);
    if (event.slug) {
      revalidatePath(`/evento/${event.slug}`);
      revalidatePath(`/evento/${event.slug}/preview-v3`);
    }

    return { ok: true, data: { eventId, eventSlug: event.slug ?? null, templateId } };
  }

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;

  const { data: templateRow, error: templateError } = await auth.data.supabase
    .from("canvas_v3_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) return { ok: false, error: templateError.message };
  if (!templateRow) return { ok: false, error: "Plantilla Canvas V3 no encontrada." };

  const template = templateRow as unknown as CanvasV3TemplateRow;
  if (template.template_scope !== "full") {
    return { ok: false, error: "Solo se pueden aplicar plantillas de scope full a un evento completo." };
  }

  const admin = createAdminClient();
  const { data: eventRow, error: eventError } = await admin
    .from("events")
    .select(CANVAS_V3_EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) return { ok: false, error: eventError.message };
  if (!eventRow) return { ok: false, error: "Evento no encontrado." };

  const event = eventRow as unknown as CanvasV3EventData;
  const eventType = normalizeCanvasV3EventType(event.event_type);
  const compatibleTypes = getCompatibleEventTypes(template.compatible_event_types);
  if (compatibleTypes.length > 0 && eventType && !compatibleTypes.includes(eventType)) {
    return { ok: false, error: `La plantilla no es compatible con eventos ${eventType}.` };
  }

  const currentDesign = isValidCanvasV3Design(event.canvas_design) ? event.canvas_design : undefined;
  const hydratedDesign = hydrateCanvasV3Template(template.design, event, currentDesign);
  if (!hydratedDesign) {
    return { ok: false, error: "No se pudo hidratar la plantilla con los datos del evento." };
  }

  const { error: updateError } = await admin
    .from("events")
    .update({
      canvas_design: hydratedDesign,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath(`/dashboard/eventos/${eventId}`);
  revalidatePath(`/dashboard/eventos/${eventId}/canvas-v3`);
  if (event.slug) {
    revalidatePath(`/evento/${event.slug}`);
    revalidatePath(`/evento/${event.slug}/preview-v3`);
  }

  return { ok: true, data: { eventId, eventSlug: event.slug ?? null, templateId } };
}
