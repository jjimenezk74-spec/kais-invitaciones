import {
  normalizeCanvasV3EventType,
  type CanvasV3EventType,
  type CeremonySemanticRole,
} from "./ceremonial-structures";
import type {
  CanvasV3AppType,
  CanvasV3Design,
  CanvasV3Element,
  CanvasV3EventData,
  CanvasV3Section,
} from "./initial-design";

export type CanvasV3TemplateScope = "full" | "section" | "component";

export type CanvasV3Template = {
  id?: string;
  name: string;
  slug: string;
  compatibleEventTypes: CanvasV3EventType[];
  visualCategory?: string;
  description?: string;
  design: CanvasV3Design;
  previewImageUrl?: string;
  thumbnailUrl?: string;
  isPremium?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  sourceEventId?: string;
  templateScope: CanvasV3TemplateScope;
};

export type ExtractCanvasV3TemplateOptions = {
  eventType?: string | null;
  templateScope?: CanvasV3TemplateScope;
};

const CANVAS_W = 390;
const MAX_SAFE_STRING_LENGTH = 12_000;
const VALID_ELEMENT_TYPES = new Set(["text", "shape", "app", "decoration"]);
const VALID_APP_TYPES = new Set<CanvasV3AppType | "album" | "live">([
  "rsvp",
  "whatsapp",
  "countdown",
  "maps",
  "live-album",
  "live-screen",
  "qr",
  "album",
  "live",
]);
const VALID_THEME_IDS = new Set<CanvasV3Design["themeId"]>([
  "kais-luxury",
  "romantic-garden",
  "elegant-black",
  "champagne-classic",
  "floral-rose",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isProbablyBase64(value: string) {
  return value.length > 2_000 && /^[A-Za-z0-9+/=\s]+$/.test(value);
}

function isUnsafeString(value: unknown) {
  return typeof value === "string" && (
    value.includes("data:") ||
    value.includes("blob:") ||
    value.length > MAX_SAFE_STRING_LENGTH ||
    isProbablyBase64(value)
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return isUnsafeString(value) ? fallback : value;
}

function safeExternalUrl(value: unknown) {
  const raw = cleanText(value);
  if (!raw || isUnsafeString(raw)) return "";
  return /^(https?:\/\/|\/)/i.test(raw) ? raw : "";
}

function normalizeAppType(element: CanvasV3Element): CanvasV3AppType | null {
  const raw = element.appType ?? element.appKind;
  if (raw === "album") return "live-album";
  if (raw === "live") return "live-screen";
  return raw && VALID_APP_TYPES.has(raw) ? raw as CanvasV3AppType : null;
}

function eventDateTime(event: CanvasV3EventData) {
  return event.event_date && event.event_time ? `${event.event_date}T${event.event_time}` : undefined;
}

function whatsappUrl(phone?: string | null) {
  const digits = cleanText(phone).replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function formatDateLabel(date?: string | null, time?: string | null) {
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T00:00:00`);
  const label = Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("es-PY", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
  return time ? `${label} - ${time} hs` : label;
}

function placeholderForDataKey(dataKey?: keyof CanvasV3EventData) {
  switch (dataKey) {
    case "title":
    case "hosts_names":
      return "Nombre del evento";
    case "event_type":
      return "Tipo de evento";
    case "event_date":
      return "Fecha por confirmar";
    case "event_time":
      return "Hora por confirmar";
    case "address":
      return "Direccion por confirmar";
    case "google_maps_link":
      return "Ubicacion por confirmar";
    case "main_message":
      return "Mensaje principal del evento.";
    case "quinceanera_name":
      return "Nombre de la quinceanera";
    case "parents_names":
      return "Nombres de los padres";
    case "church_name":
      return "Lugar de ceremonia por confirmar";
    case "church_time":
      return "Horario de ceremonia por confirmar";
    case "dress_code":
      return "Vestimenta por confirmar";
    case "color_palette":
      return "Paleta del evento";
    case "theme":
      return "Tematica del evento";
    case "quince_message":
      return "Mensaje de la quinceanera.";
    case "parents_message":
    case "family_message":
      return "Mensaje de la familia.";
    case "graduate_name":
      return "Nombre del graduado";
    case "graduation_type":
      return "Graduacion";
    case "institution_name":
      return "Institucion por confirmar";
    case "academic_program":
      return "Programa academico";
    case "degree_title":
      return "Titulo obtenido";
    case "promotion_name":
      return "Promocion";
    case "academic_ceremony_place":
      return "Lugar del acto academico";
    case "academic_ceremony_time":
      return "Hora del acto academico";
    case "reception_place":
      return "Lugar de recepcion";
    case "reception_time":
      return "Hora de recepcion";
    case "graduate_message":
      return "Mensaje del graduado.";
    case "whatsapp_phone":
      return "WhatsApp del evento";
    case "package_key":
      return "Confirmacion habilitada";
    default:
      return "Contenido del evento";
  }
}

function placeholderForSemanticRole(role?: CeremonySemanticRole) {
  switch (role) {
    case "event_type":
      return "Tipo de evento";
    case "honoree_name":
    case "event_title":
    case "birthday_person_name":
    case "baby_name":
    case "couple_names":
    case "company_name":
      return "Nombre del evento";
    case "graduate_name":
      return "Nombre del graduado";
    case "graduation_subtype":
      return "Graduacion";
    case "parents_names":
      return "Nombres de los padres";
    case "parents_message":
      return "Mensaje de la familia.";
    case "main_message":
    case "honoree_message":
      return "Mensaje principal del evento.";
    case "event_date":
      return "Fecha por confirmar";
    case "event_time":
      return "Hora por confirmar";
    case "ceremony_place":
    case "academic_ceremony":
      return "Lugar de ceremonia por confirmar";
    case "ceremony_time":
      return "Horario de ceremonia por confirmar";
    case "reception_place":
      return "Lugar de recepcion";
    case "event_address":
      return "Direccion por confirmar";
    case "dress_code":
      return "Vestimenta por confirmar";
    case "color_palette":
      return "Paleta del evento";
    case "theme":
      return "Tematica del evento";
    case "institution_name":
      return "Institucion por confirmar";
    case "graduation_program":
      return "Logro academico";
    case "rsvp_action":
      return "Confirmar asistencia";
    case "whatsapp_action":
      return "WhatsApp";
    case "maps_link":
      return "Ver ubicacion";
    case "countdown":
      return "";
    case "package_note":
      return "Confirmacion habilitada";
    default:
      return "Contenido del evento";
  }
}

function getEventValueForDataKey(event: CanvasV3EventData, dataKey?: keyof CanvasV3EventData) {
  if (!dataKey) return "";
  if (dataKey === "event_date") return formatDateLabel(event.event_date, event.event_time);
  if (dataKey === "event_time") return event.event_time ? `${event.event_time} hs` : "";
  if (dataKey === "package_key") return event.package_key ? `Confirmacion ${event.package_key}` : "";
  const value = event[dataKey];
  return typeof value === "string" ? cleanText(value) : "";
}

function getEventValueForSemanticRole(event: CanvasV3EventData, role?: CeremonySemanticRole) {
  switch (role) {
    case "event_type":
      return cleanText(event.event_type);
    case "event_title":
      return cleanText(event.title) || cleanText(event.hosts_names);
    case "honoree_name":
      return cleanText(event.quinceanera_name) || cleanText(event.hosts_names) || cleanText(event.title);
    case "graduate_name":
      return cleanText(event.graduate_name) || cleanText(event.hosts_names) || cleanText(event.title);
    case "graduation_subtype":
      return cleanText(event.graduation_type);
    case "main_message":
      return cleanText(event.main_message);
    case "honoree_message":
      return cleanText(event.quince_message) || cleanText(event.graduate_message) || cleanText(event.main_message);
    case "parents_names":
      return cleanText(event.parents_names);
    case "parents_message":
      return cleanText(event.parents_message) || cleanText(event.family_message);
    case "event_date":
      return formatDateLabel(event.event_date, event.event_time);
    case "event_time":
      return event.event_time ? `${event.event_time} hs` : "";
    case "ceremony_place":
      return cleanText(event.church_name) || cleanText(event.academic_ceremony_place);
    case "ceremony_time":
      return cleanText(event.church_time) || cleanText(event.academic_ceremony_time);
    case "academic_ceremony":
      return cleanText(event.academic_ceremony_place);
    case "reception_place":
      return cleanText(event.reception_place);
    case "event_address":
      return cleanText(event.address);
    case "dress_code":
      return cleanText(event.dress_code);
    case "color_palette":
      return cleanText(event.color_palette);
    case "theme":
      return cleanText(event.theme);
    case "institution_name":
      return cleanText(event.institution_name);
    case "graduation_program":
      return cleanText(event.degree_title) || cleanText(event.academic_program) || cleanText(event.promotion_name);
    case "rsvp_action":
      return "Confirmar asistencia";
    case "whatsapp_action":
      return "WhatsApp";
    case "maps_link":
      return "Ver ubicacion";
    case "package_note":
      return event.package_key ? `Confirmacion ${event.package_key}` : "";
    default:
      return "";
  }
}

function inferTemplateMetadata(element: CanvasV3Element): Pick<CanvasV3Element, "dataKey" | "semanticRole" | "lockedContent"> {
  const id = element.id.toLowerCase();
  const content = cleanText(element.content).toLowerCase();
  const metadata: Pick<CanvasV3Element, "dataKey" | "semanticRole" | "lockedContent"> = {};

  const set = (dataKey: keyof CanvasV3EventData | undefined, semanticRole: CeremonySemanticRole) => {
    metadata.dataKey = dataKey;
    metadata.semanticRole = semanticRole;
    metadata.lockedContent = true;
  };

  if (element.type === "app") {
    const appType = normalizeAppType(element);
    if (appType === "countdown") set("event_date", "countdown");
    if (appType === "maps") set("google_maps_link", "maps_link");
    if (appType === "whatsapp") set("whatsapp_phone", "whatsapp_action");
    if (appType === "rsvp") set(undefined, "rsvp_action");
    return metadata;
  }

  if (element.type !== "text") return metadata;

  if (id.startsWith("grad-")) {
    if (id.includes("hero-name")) set("graduate_name", "graduate_name");
    else if (id.includes("hero-type")) set("graduation_type", "graduation_subtype");
    else if (id.includes("date")) set("event_date", "event_date");
    else if (id.includes("institution") || id.includes("-inst")) set("institution_name", "institution_name");
    else if (id.includes("promotion")) set("promotion_name", "graduation_program");
    else if (id.includes("achievement-degree")) set("degree_title", "graduation_program");
    else if (id.includes("ceremony-place")) set("academic_ceremony_place", "academic_ceremony");
    else if (id.includes("ceremony-time")) set("academic_ceremony_time", "academic_ceremony");
    else if (id.includes("reception-place")) set("reception_place", "reception_place");
    else if (id.includes("reception-time")) set("reception_time", "reception_place");
    else if (id.includes("message-family") || id.includes("presentation-support")) set("family_message", "parents_message");
    else if (id.includes("graduate-message") || id.includes("message-copy")) set("graduate_message", "honoree_message");
    else if (id.includes("location-copy")) set("address", "event_address");
    else if (id.includes("dress")) set("dress_code", "dress_code");
    else if (id.includes("package")) set("package_key", "package_note");
    else if (id.includes("footer-title")) set("title", "event_title");
    else if (id.includes("presentation-copy") || id.includes("hero-invitation")) set("main_message", "main_message");
    return metadata;
  }

  if (id.includes("quince-message") || id.includes("hero-message") || id.includes("s4-message")) set("quince_message", "honoree_message");
  else if (id.includes("parents-message") || id.includes("parents") || id.includes("family")) set(id.includes("grad-") ? "family_message" : "parents_message", "parents_message");
  else if (id.includes("hero-title") || id.includes("presentation-title") || id.includes("footer-title") || id.includes("s1-name") || id.includes("s3-name") || id.includes("s8-name")) set("quinceanera_name", "honoree_name");
  else if (id.includes("hero-date") || id.includes("date") || id.includes("details-day") || id.includes("details-month")) set("event_date", "event_date");
  else if (id.includes("event-time") || id.endsWith("-time")) set("event_time", "event_time");
  else if (id.includes("church-details") || id.includes("church-name") || id.includes("s6-venue")) set("church_name", "ceremony_place");
  else if (id.includes("church-time")) set("church_time", "ceremony_time");
  else if (id.includes("address") || id.includes("location-copy")) set("address", "event_address");
  else if (id.includes("dress")) set("dress_code", "dress_code");
  else if (id.includes("swatch") || id.includes("palette")) set("color_palette", "color_palette");
  else if (id.includes("theme")) set("theme", "theme");
  else if (id.includes("package")) set("package_key", "package_note");
  else if (id.includes("grad-hero-name")) set("graduate_name", "graduate_name");
  else if (id.includes("grad-hero-type")) set("graduation_type", "graduation_subtype");
  else if (id.includes("institution") || id.includes("-inst")) set("institution_name", "institution_name");
  else if (id.includes("promotion")) set("promotion_name", "graduation_program");
  else if (id.includes("achievement-degree")) set("degree_title", "graduation_program");
  else if (id.includes("ceremony-place")) set("academic_ceremony_place", "academic_ceremony");
  else if (id.includes("ceremony-time")) set("academic_ceremony_time", "academic_ceremony");
  else if (id.includes("reception-place")) set("reception_place", "reception_place");
  else if (id.includes("reception-time")) set("reception_time", "reception_place");
  else if (id.includes("graduate-message") || id.includes("grad-message-copy")) set("graduate_message", "honoree_message");
  else if (id.includes("main-message") || id.includes("presentation-copy") || id.includes("hero-invitation")) set("main_message", "main_message");
  else if (id.includes("title") && (content.includes("confirm") || content.includes("asistencia"))) set(undefined, "rsvp_action");

  return metadata;
}

function findCurrentElement(currentDesign: CanvasV3Design | undefined, templateElement: CanvasV3Element) {
  if (!currentDesign) return undefined;
  if (templateElement.dataKey) {
    const byDataKey = currentDesign.elements.find((element) => element.dataKey === templateElement.dataKey);
    if (byDataKey) return byDataKey;
  }
  if (templateElement.semanticRole) {
    return currentDesign.elements.find((element) => element.semanticRole === templateElement.semanticRole);
  }
  const appType = normalizeAppType(templateElement);
  if (appType) {
    return currentDesign.elements.find((element) => normalizeAppType(element) === appType);
  }
  return undefined;
}

function sanitizeSection(section: unknown): CanvasV3Section | null {
  if (!isRecord(section)) return null;
  const y = finiteNumber(section.y);
  const height = finiteNumber(section.height);
  if (typeof section.id !== "string" || typeof section.label !== "string" || y == null || height == null) return null;
  return {
    ...section,
    id: safeString(section.id),
    label: safeString(section.label, "Seccion"),
    y,
    height,
    background: safeString(section.background, "transparent"),
  } as CanvasV3Section;
}

function sanitizeAppConfig(element: CanvasV3Element, mode: "template" | "hydrated", source?: CanvasV3Element, event?: CanvasV3EventData) {
  const appType = normalizeAppType(element);
  const currentConfig = isRecord(source?.config) ? source?.config : undefined;
  const templateConfig = isRecord(element.config) ? element.config : undefined;
  const base = {
    primaryColor: safeString(templateConfig?.primaryColor),
    textColor: safeString(templateConfig?.textColor),
  };

  if (mode === "template") {
    return {
      ...base,
      countdownMode: appType === "countdown" ? "event" as const : undefined,
    };
  }

  if (appType === "maps") {
    return {
      ...base,
      url: safeExternalUrl(event?.google_maps_link) || safeExternalUrl(currentConfig?.url),
    };
  }
  if (appType === "whatsapp") {
    return {
      ...base,
      url: whatsappUrl(event?.whatsapp_phone) || safeExternalUrl(currentConfig?.url),
    };
  }
  if (appType === "countdown") {
    return {
      ...base,
      countdownMode: "event" as const,
      countdownTarget: eventDateTime(event as CanvasV3EventData) || safeString(currentConfig?.countdownTarget),
    };
  }
  return {
    ...base,
    url: safeExternalUrl(currentConfig?.url),
  };
}

function sanitizeElement(element: unknown, mode: "template" | "hydrated", event?: CanvasV3EventData, currentDesign?: CanvasV3Design): CanvasV3Element | null {
  if (!isRecord(element)) return null;
  const x = finiteNumber(element.x);
  const y = finiteNumber(element.y);
  const width = finiteNumber(element.width);
  const height = element.height == null ? null : finiteNumber(element.height);
  const zIndex = finiteNumber(element.zIndex);
  if (
    typeof element.id !== "string" ||
    typeof element.type !== "string" ||
    !VALID_ELEMENT_TYPES.has(element.type) ||
    x == null ||
    y == null ||
    width == null ||
    height === undefined ||
    zIndex == null ||
    typeof element.locked !== "boolean" ||
    typeof element.visible !== "boolean"
  ) {
    return null;
  }

  const typedElement = {
    ...element,
    id: safeString(element.id),
    type: element.type,
    x,
    y,
    width,
    height,
    locked: element.locked,
    visible: element.visible,
    zIndex,
    content: safeString(element.content),
    background: safeString(element.background),
  } as CanvasV3Element;

  const inferred = inferTemplateMetadata(typedElement);
  typedElement.dataKey = typedElement.dataKey ?? inferred.dataKey;
  typedElement.semanticRole = typedElement.semanticRole ?? inferred.semanticRole;
  typedElement.lockedContent = typedElement.lockedContent ?? inferred.lockedContent;

  const source = findCurrentElement(currentDesign, typedElement);

  if (mode === "template" && typedElement.type === "text" && (typedElement.dataKey || typedElement.semanticRole || typedElement.lockedContent)) {
    typedElement.content = placeholderForDataKey(typedElement.dataKey) || placeholderForSemanticRole(typedElement.semanticRole);
  }

  if (mode === "hydrated" && typedElement.type === "text") {
    const eventValue =
      getEventValueForDataKey(event as CanvasV3EventData, typedElement.dataKey) ||
      getEventValueForSemanticRole(event as CanvasV3EventData, typedElement.semanticRole);
    const currentValue = safeString(source?.content);
    typedElement.content = eventValue || currentValue || placeholderForDataKey(typedElement.dataKey) || placeholderForSemanticRole(typedElement.semanticRole);
  }

  if (typedElement.type === "app") {
    const appType = normalizeAppType(typedElement);
    if (appType && !VALID_APP_TYPES.has(appType)) return null;
    typedElement.appType = appType ?? typedElement.appType;
    typedElement.config = sanitizeAppConfig(typedElement, mode, source, event);
    if (mode === "template") {
      if (appType === "maps") typedElement.content = "Ver ubicacion";
      if (appType === "whatsapp") typedElement.content = "WhatsApp";
      if (appType === "rsvp") typedElement.content = "Confirmar asistencia";
    }
  }

  return typedElement;
}

function normalizeCanvasV3Design(value: unknown, mode: "template" | "hydrated", event?: CanvasV3EventData, currentDesign?: CanvasV3Design): CanvasV3Design | null {
  if (!isRecord(value) || value.version !== 3) return null;
  const width = finiteNumber(value.width);
  const height = finiteNumber(value.height);
  if (width !== CANVAS_W || height == null || height <= 0) return null;
  if (!Array.isArray(value.sections) || !Array.isArray(value.elements)) return null;

  const sections = value.sections.map(sanitizeSection);
  if (sections.some((section) => section == null)) return null;
  const elements = value.elements.map((element) => sanitizeElement(element, mode, event, currentDesign));
  if (elements.some((element) => element == null)) return null;

  const themeId = typeof value.themeId === "string" && VALID_THEME_IDS.has(value.themeId as CanvasV3Design["themeId"])
    ? value.themeId as CanvasV3Design["themeId"]
    : "kais-luxury";

  return {
    version: 3,
    viewport: "mobile",
    width: CANVAS_W,
    height,
    themeId,
    sections: sections as CanvasV3Section[],
    elements: elements as CanvasV3Element[],
  };
}

export function sanitizeCanvasV3TemplateDesign(design: unknown): CanvasV3Design | null {
  return normalizeCanvasV3Design(design, "template");
}

export function extractCanvasV3TemplateFromEventDesign(
  design: unknown,
  _options: ExtractCanvasV3TemplateOptions = {}
): CanvasV3Design | null {
  return sanitizeCanvasV3TemplateDesign(design);
}

export function hydrateCanvasV3Template(
  templateDesign: unknown,
  eventData: CanvasV3EventData,
  currentDesign?: CanvasV3Design
): CanvasV3Design | null {
  return normalizeCanvasV3Design(templateDesign, "hydrated", eventData, currentDesign);
}

export function getCompatibleCanvasV3EventTypes(value?: string | null): CanvasV3EventType[] {
  const normalized = normalizeCanvasV3EventType(value);
  return normalized ? [normalized] : ["quinceanios"];
}
