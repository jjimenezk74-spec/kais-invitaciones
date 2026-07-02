import { NextResponse, type NextRequest } from "next/server";
import { createInitialCanvasV3Design, type CanvasV3EventData } from "@/lib/canvas-v3/initial-design";
import { getCurrentD1UserProfile, isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";
import { createD1Event, getD1PublicEventBySlug, updateD1CanvasDesign } from "@/lib/cloudflare/public-events";
import { uploadFileToR2Media } from "@/lib/cloudflare/r2";
import { canCreateEvents } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import type { EventPackageKey } from "@/lib/types";

const ALLOWED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;
const EVENT_STATUSES = ["borrador", "publicado", "inactivo"] as const;
const GUEST_MODES = ["publico", "lista_invitados"] as const;
const EVENT_PACKAGE_KEYS = ["essential", "premium", "experience", "luxury"] as const;

export async function POST(request: NextRequest) {
  if (!isCloudflareAuthEnabled()) {
    return actionError(request, "/dashboard/eventos/nuevo", "Este flujo solo esta disponible en Cloudflare.");
  }

  const { user, profile } = await getCurrentD1UserProfile();
  if (!user) {
    return actionError(request, "/login", "Tu sesion expiro. Vuelve a ingresar.", 401);
  }
  if (!canCreateEvents(profile)) {
    return actionError(request, "/dashboard", "Tu rol no tiene permisos para crear eventos.", 403);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "Nuevo evento").trim() || "Nuevo evento";
  const requestedSlug = String(formData.get("slug") ?? "").trim();
  const slug = normalizeEventSlug(requestedSlug || `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`);

  if (!slug) {
    return actionError(request, "/dashboard/eventos/nuevo", "El enlace corto es obligatorio.");
  }
  if (await getD1PublicEventBySlug(slug)) {
    return actionError(request, "/dashboard/eventos/nuevo", "Ya existe un evento con ese enlace corto.");
  }

  const coverFile = getOptionalFile(formData.get("cover_image_file"));
  const mobileCoverFile = getOptionalFile(formData.get("mobile_cover_image_file"));
  let coverImageUrl = nullable(formData.get("cover_image_url"));
  let mobileCoverImageUrl = nullable(formData.get("mobile_cover_image_url"));

  try {
    if (coverFile) {
      validateCoverImageFile(coverFile);
      coverImageUrl = await uploadFileToR2Media({
        file: coverFile,
        prefix: `event-photos/covers/${user.id}/desktop`,
        contentType: coverFile.type || getCoverContentType(getFileExtension(coverFile.name)),
        baseUrl: process.env.NEXT_PUBLIC_APP_URL
      });
    }

    if (mobileCoverFile) {
      validateCoverImageFile(mobileCoverFile);
      mobileCoverImageUrl = await uploadFileToR2Media({
        file: mobileCoverFile,
        prefix: `event-photos/covers/${user.id}/mobile`,
        contentType: mobileCoverFile.type || getCoverContentType(getFileExtension(mobileCoverFile.name)),
        baseUrl: process.env.NEXT_PUBLIC_APP_URL
      });
    }
  } catch (error) {
    return actionError(request, "/dashboard/eventos/nuevo", getErrorMessage(error));
  }

  const payload = {
    owner_id: user.id,
    package_key: getPackageKey(formData.get("package_key")),
    title,
    event_type: String(formData.get("event_type") ?? "otro"),
    hosts_names: String(formData.get("hosts_names") ?? title),
    event_date: String(formData.get("event_date") ?? ""),
    event_time: String(formData.get("event_time") ?? ""),
    address: String(formData.get("address") ?? ""),
    google_maps_link: nullable(formData.get("google_maps_link")),
    whatsapp_phone: normalizeParaguayWhatsapp(formData.get("whatsapp_phone")),
    external_photo_album_url: getOptionalUrl(formData.get("external_photo_album_url")),
    main_message: nullable(formData.get("main_message")),
    quinceanera_name: nullable(formData.get("quinceanera_name")),
    parents_names: nullable(formData.get("parents_names")),
    church_name: nullable(formData.get("church_name")),
    church_time: nullable(formData.get("church_time")),
    dress_code: nullable(formData.get("dress_code")),
    color_palette: nullable(formData.get("color_palette")),
    theme: nullable(formData.get("theme")),
    quince_message: nullable(formData.get("quince_message")),
    parents_message: nullable(formData.get("parents_message")),
    graduate_name: nullable(formData.get("graduate_name")),
    graduation_type: nullable(formData.get("graduation_type")),
    institution_name: nullable(formData.get("institution_name")),
    academic_program: nullable(formData.get("academic_program")),
    degree_title: nullable(formData.get("degree_title")),
    promotion_name: nullable(formData.get("promotion_name")),
    academic_ceremony_place: nullable(formData.get("academic_ceremony_place")),
    academic_ceremony_time: nullable(formData.get("academic_ceremony_time")),
    reception_place: nullable(formData.get("reception_place")),
    reception_time: nullable(formData.get("reception_time")),
    family_message: nullable(formData.get("family_message")),
    graduate_message: nullable(formData.get("graduate_message")),
    cover_image_url: coverImageUrl,
    mobile_cover_image_url: mobileCoverImageUrl,
    music_url: nullable(formData.get("music_url")),
    theme_color: String(formData.get("theme_color") || "#111827"),
    status: getEventStatus(formData.get("status")),
    guest_mode: getGuestMode(formData.get("guest_mode")),
    client_id: nullable(formData.get("client_id")),
    template_id: nullable(formData.get("template_id")),
    category_id: nullableUuid(formData.get("category_id")),
    theme_id: nullableUuid(formData.get("theme_id")),
    slug
  };

  try {
    const eventId = await createD1Event(payload);
    const canvasDesign = createInitialCanvasV3Design({ ...payload, id: eventId, canvas_design: null } as CanvasV3EventData);
    await updateD1CanvasDesign(eventId, canvasDesign);
    return actionSuccess(request, `/dashboard/eventos/${eventId}/canvas-v3`, { eventId });
  } catch (error) {
    return actionError(request, "/dashboard/eventos/nuevo", getErrorMessage(error));
  }
}

export function GET(request: NextRequest) {
  return redirectTo(request, "/dashboard/eventos/nuevo", "No se pudo crear el evento. Volve a enviar el formulario.");
}

function redirectTo(request: NextRequest, path: string, error: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function wantsActionJson(request: NextRequest) {
  return request.headers.get("x-kais-fetch-action") === "1";
}

function actionError(request: NextRequest, path: string, error: string, status = 400) {
  if (wantsActionJson(request)) {
    return NextResponse.json({ ok: false, error, redirectTo: path }, { status });
  }

  return redirectTo(request, path, error);
}

function actionSuccess(request: NextRequest, path: string, data: Record<string, string>) {
  if (wantsActionJson(request)) {
    return NextResponse.json({ ok: true, redirectTo: path, ...data });
  }

  return NextResponse.redirect(new URL(path, request.url), 303);
}

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function nullableUuid(value: FormDataEntryValue | null): string | null {
  const str = nullable(value);
  if (!str) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ? str : null;
}

function normalizeEventSlug(value: string) {
  return slugify(value).slice(0, 70);
}

function normalizeParaguayWhatsapp(value: FormDataEntryValue | null) {
  let digits = String(value ?? "").replace(/[\s-]/g, "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("595")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `595${digits}`;
}

function getOptionalUrl(value: FormDataEntryValue | null) {
  const text = nullable(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall through to the shared error below.
  }

  return null;
}

function getOptionalFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function getEventStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "borrador");
  return EVENT_STATUSES.includes(status as (typeof EVENT_STATUSES)[number]) ? status : "borrador";
}

function getGuestMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? "publico");
  return GUEST_MODES.includes(mode as (typeof GUEST_MODES)[number]) ? mode : "publico";
}

function getPackageKey(value: FormDataEntryValue | null): EventPackageKey {
  const packageKey = String(value ?? "essential");
  return EVENT_PACKAGE_KEYS.includes(packageKey as EventPackageKey) ? (packageKey as EventPackageKey) : "essential";
}

function validateCoverImageFile(file: File) {
  const extension = getFileExtension(file.name);
  const hasValidExtension = ALLOWED_COVER_EXTENSIONS.includes(extension);
  const hasValidType = !file.type || ALLOWED_COVER_TYPES.includes(file.type);

  if (file.size > MAX_COVER_FILE_SIZE) {
    throw new Error("La foto de portada no debe superar 5MB.");
  }

  if (!hasValidExtension || !hasValidType) {
    throw new Error("La foto de portada debe ser una imagen valida .jpg, .jpeg, .png o .webp.");
  }
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function getCoverContentType(extension: string) {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  return "image/webp";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la accion.";
}
