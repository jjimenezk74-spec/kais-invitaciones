import type { Event } from "@/lib/types";
import { createGraduationCanvasV3Design } from "./ceremony-builders/graduation";
import { createQuinceaniosCanvasV3Design } from "./ceremony-builders/quinceanios";
import {
  normalizeCanvasV3EventType,
  type CanvasV3EventType,
  type CeremonySectionKind,
  type CeremonySemanticRole,
} from "./ceremonial-structures";

export type CanvasV3ElementType = "text" | "shape" | "app" | "decoration";
export type CanvasV3AppType = "rsvp" | "whatsapp" | "countdown" | "maps" | "live-album" | "live-screen" | "qr";

export type CanvasV3Element = {
  id: string;
  type: CanvasV3ElementType;
  x: number;
  y: number;
  width: number;
  height: number | null;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right";
  color?: string;
  textShadow?: string;
  letterSpacing?: number;
  lineHeight?: number;
  background?: string;
  borderRadius?: number;
  border?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "none";
  opacity?: number;
  blur?: number;
  appKind?: CanvasV3AppType | "album" | "live";
  appType?: CanvasV3AppType;
  semanticRole?: CeremonySemanticRole;
  dataKey?: keyof CanvasV3EventData;
  lockedContent?: boolean;
  config?: {
    url?: string;
    primaryColor?: string;
    textColor?: string;
    countdownTarget?: string;
    countdownMode?: "event" | "custom";
  };
};

export type CanvasV3Section = {
  id: string;
  label: string;
  y: number;
  height: number;
  background: string;
  kind?: CeremonySectionKind;
  required?: boolean;
  sourceEventType?: CanvasV3EventType;
};

export type CanvasV3Design = {
  version: 3;
  viewport: "mobile";
  width: 390;
  height: number;
  themeId: "kais-luxury" | "romantic-garden" | "elegant-black" | "champagne-classic" | "floral-rose";
  sections: CanvasV3Section[];
  elements: CanvasV3Element[];
};

export type CanvasV3EventData = Pick<
  Event,
  | "id"
  | "slug"
  | "event_type"
  | "title"
  | "hosts_names"
  | "event_date"
  | "event_time"
  | "address"
  | "google_maps_link"
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
  | "whatsapp_phone"
  | "package_key"
  | "canvas_design"
>;

const CANVAS_W = 390;
const VALID_ELEMENT_TYPES = new Set<CanvasV3ElementType>(["text", "shape", "app", "decoration"]);
const VALID_APP_TYPES = new Set<string>(["rsvp", "whatsapp", "countdown", "maps", "live-album", "live-screen", "qr", "album", "live"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown) {
  return Number.isFinite(Number(value));
}

function hasUnsafeInlineAsset(value: unknown) {
  return typeof value === "string" && (value.includes("data:") || value.includes("blob:") || value.length > 12_000);
}

export function isValidCanvasV3Design(value: unknown): value is CanvasV3Design {
  if (!isRecord(value) || value.version !== 3 || value.viewport !== "mobile") return false;
  if (Number(value.width) !== CANVAS_W || !isFiniteNumber(value.height)) return false;
  if (!Array.isArray(value.sections) || value.sections.length === 0) return false;
  if (!Array.isArray(value.elements)) return false;

  for (const section of value.sections) {
    if (!isRecord(section)) return false;
    if (typeof section.id !== "string" || typeof section.label !== "string") return false;
    if (!isFiniteNumber(section.y) || !isFiniteNumber(section.height)) return false;
    if (typeof section.background !== "string" || hasUnsafeInlineAsset(section.background)) return false;
  }

  for (const element of value.elements) {
    if (!isRecord(element)) return false;
    if (typeof element.id !== "string" || !VALID_ELEMENT_TYPES.has(element.type as CanvasV3ElementType)) return false;
    if (!isFiniteNumber(element.x) || !isFiniteNumber(element.y) || !isFiniteNumber(element.width)) return false;
    if (element.height !== null && element.height !== undefined && !isFiniteNumber(element.height)) return false;
    if (typeof element.locked !== "boolean" || typeof element.visible !== "boolean" || !isFiniteNumber(element.zIndex)) return false;
    if (hasUnsafeInlineAsset(element.background) || hasUnsafeInlineAsset(element.content)) return false;
    if (element.type === "app") {
      const appKind = element.appKind ?? element.appType;
      if (appKind != null && !VALID_APP_TYPES.has(String(appKind))) return false;
      if (isRecord(element.config) && hasUnsafeInlineAsset(element.config.url)) return false;
    }
  }

  return true;
}

function normalizeSavedCanvasV3Design(design: CanvasV3Design): CanvasV3Design {
  const hasRsvp = design.elements.some((element) => element.type === "app" && (element.appType ?? element.appKind) === "rsvp");
  return {
    ...design,
    elements: design.elements.flatMap((element) => {
      if (element.type !== "app" || (element.appType ?? element.appKind) !== "whatsapp") {
        return [element];
      }

      if (hasRsvp) {
        return [];
      }

      const next = {
        ...element,
        appType: "rsvp" as const,
        appKind: "rsvp" as const,
        content: "Confirmar asistencia",
        semanticRole: element.semanticRole ?? "rsvp_action",
        lockedContent: element.lockedContent ?? true,
        config: { ...(element.config ?? {}) },
      };

      if (next.config) {
        delete next.config.url;
      }

      return [next];
    }),
  };
}

export function resolveInitialCanvasV3Design(event: CanvasV3EventData): CanvasV3Design {
  if (isValidCanvasV3Design(event.canvas_design)) return normalizeSavedCanvasV3Design(event.canvas_design);
  return createInitialCanvasV3Design(event);
}

export function createInitialCanvasV3Design(event: CanvasV3EventData): CanvasV3Design {
  const eventType = normalizeCanvasV3EventType(event.event_type);

  switch (eventType) {
    case "graduation":
      return createGraduationCanvasV3Design(event);
    case "quinceanios":
      return createQuinceaniosCanvasV3Design(event);
    default:
      return createQuinceaniosCanvasV3Design(event);
  }
}
