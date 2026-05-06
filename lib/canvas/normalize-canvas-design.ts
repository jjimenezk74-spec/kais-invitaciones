import type { CanvasDesign, CanvasElement, CanvasSection, CanvasSectionId } from "@/lib/types";

export const MOBILE_CANVAS_WIDTH = 390;
export const MOBILE_CANVAS_VIEWPORT_HEIGHT = 844;

export const DEFAULT_MOBILE_CANVAS_SECTIONS: CanvasSection[] = [
  { id: "hero", label: "Hero", y: 0, height: 844 },
  { id: "countdown", label: "Cuenta regresiva", y: 844, height: 420 },
  { id: "presentation", label: "Presentación", y: 1264, height: 640 },
  { id: "messages", label: "Mensajes", y: 1904, height: 760 },
  { id: "details", label: "Detalles", y: 2664, height: 680 },
  { id: "church", label: "Iglesia", y: 3344, height: 620 },
  { id: "dresscode", label: "Vestimenta", y: 3964, height: 520 },
  { id: "rsvp", label: "RSVP", y: 4484, height: 620 },
  { id: "footer", label: "Footer", y: 5104, height: 300 },
];

export const MOBILE_CANVAS_HEIGHT =
  DEFAULT_MOBILE_CANVAS_SECTIONS[DEFAULT_MOBILE_CANVAS_SECTIONS.length - 1].y +
  DEFAULT_MOBILE_CANVAS_SECTIONS[DEFAULT_MOBILE_CANVAS_SECTIONS.length - 1].height;

export type NormalizedMobileCanvasDesign = CanvasDesign & {
  version: 1;
  viewport: "mobile";
  width: typeof MOBILE_CANVAS_WIDTH;
  height: number;
  refWidth: typeof MOBILE_CANVAS_WIDTH;
  refHeight: typeof MOBILE_CANVAS_VIEWPORT_HEIGHT;
  sections: CanvasSection[];
  coordinatePx: true;
};

// ─────────────────────────────────────────────────────────────────────────────
// normalizeCanvasDesign
//
// Normalises any stored CanvasDesign (including legacy %-based designs) to the
// canonical form where element.x / element.y are ABSOLUTE PIXELS measured from
// the top-left corner of the canvas document.
//
// Legacy detection: if `source.coordinatePx !== true` the stored x/y values
// are treated as centre-anchored percentages (the old system) and migrated.
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeCanvasDesign(value: unknown): NormalizedMobileCanvasDesign {
  const source = isRecord(value) ? value : {};
  const hasSections = Array.isArray(source.sections) && source.sections.length > 0;
  const sections = hasSections ? normalizeSections(source.sections as unknown[]) : DEFAULT_MOBILE_CANVAS_SECTIONS;
  const height = getDocumentHeight(sections);

  // Detect legacy coordinate system: old designs don't have coordinatePx: true.
  const isLegacyPercent = source.coordinatePx !== true;

  const elements = Array.isArray(source.elements)
    ? normalizeElements(
        source.elements as CanvasElement[],
        sections,
        height,
        !hasSections,    // shouldConvertSectionRelativeY (very old designs)
        isLegacyPercent,
      )
    : [];

  const background = isRecord(source.background) ? source.background : { type: "none" };
  const updatedAt = typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString();

  return {
    ...(source as Partial<CanvasDesign>),
    version: 1,
    viewport: "mobile",
    width: MOBILE_CANVAS_WIDTH,
    height,
    refWidth: MOBILE_CANVAS_WIDTH,
    refHeight: MOBILE_CANVAS_VIEWPORT_HEIGHT,
    background: background as CanvasDesign["background"],
    sections,
    elements,
    updatedAt,
    coordinatePx: true, // mark as migrated — safe to re-store
  };
}

export function hasRenderableMobileCanvasDesign(value: unknown): value is CanvasDesign {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.elements) || value.elements.length === 0) return false;
  const viewport = value.viewport;
  const width = value.width ?? value.refWidth;
  const height = value.height ?? value.refHeight;

  return (
    (viewport === undefined || viewport === "mobile") &&
    Number(width) === MOBILE_CANVAS_WIDTH &&
    Number(height) >= MOBILE_CANVAS_VIEWPORT_HEIGHT
  );
}

export function getCanvasSection(
  design: Pick<NormalizedMobileCanvasDesign, "sections">,
  sectionId: CanvasSectionId
) {
  return design.sections.find((section) => section.id === sectionId) ?? design.sections[0];
}

/**
 * @deprecated Use getSectionYPx() for new px-based designs.
 * Kept for backward compatibility.
 */
export function getGlobalYPercent(
  sectionId: CanvasSectionId,
  sectionRelativeYPercent: number,
  sections = DEFAULT_MOBILE_CANVAS_SECTIONS
) {
  const section = sections.find((item) => item.id === sectionId) ?? sections[0];
  const documentHeight = getDocumentHeight(sections);
  return ((section.y + (sectionRelativeYPercent / 100) * section.height) / documentHeight) * 100;
}

/**
 * Returns the absolute Y pixel position at `relativeYPercent` within a section.
 * Use this instead of getGlobalYPercent for px-based designs.
 */
export function getSectionYPx(
  sectionId: CanvasSectionId,
  relativeYPercent: number,
  sections = DEFAULT_MOBILE_CANVAS_SECTIONS
): number {
  const section = sections.find((item) => item.id === sectionId) ?? sections[0];
  return section.y + (relativeYPercent / 100) * section.height;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeSections(value: unknown[]): CanvasSection[] {
  const fallbackById = new Map(DEFAULT_MOBILE_CANVAS_SECTIONS.map((section) => [section.id, section]));
  const sections = value
    .filter(isRecord)
    .map((item) => {
      const id = typeof item.id === "string" ? item.id as CanvasSectionId : "hero";
      const fallback = fallbackById.get(id) ?? fallbackById.get("hero")!;
      return {
        id,
        label: typeof item.label === "string" ? item.label : fallback.label,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : fallback.y,
        height: Number.isFinite(Number(item.height)) ? Number(item.height) : fallback.height,
      };
    });

  return sections.length > 0 ? sections : DEFAULT_MOBILE_CANVAS_SECTIONS;
}

function normalizeElements(
  elements: CanvasElement[],
  sections: CanvasSection[],
  documentHeight: number,
  shouldConvertSectionRelativeY: boolean,
  isLegacyPercent: boolean,
) {
  return elements.map((element) => {
    const sectionId = element.sectionId ?? "hero";
    const section = sections.find((item) => item.id === sectionId) ?? sections[0];

    let rawX = Number.isFinite(Number(element.x)) ? Number(element.x) : 50;
    let rawY = Number.isFinite(Number(element.y)) ? Number(element.y) : 0;

    if (shouldConvertSectionRelativeY) {
      rawY = ((section.y + (rawY / 100) * section.height) / documentHeight) * 100;
    }

    let finalX = rawX;
    let finalY = rawY;

    if (isLegacyPercent) {
      const w = Number.isFinite(Number(element.width)) ? Number(element.width) : 120;
      const h =
        element.height !== null && element.height !== undefined
          ? Number.isFinite(Number(element.height)) ? Number(element.height) : 0
          : 0;

      finalX = Math.max(0, (rawX / 100) * MOBILE_CANVAS_WIDTH - w / 2);
      finalY = Math.max(0, (rawY / 100) * documentHeight - h / 2);
    }

    return {
      ...element,
      sectionId,
      x: finalX,
      y: finalY,
      width: Number.isFinite(Number(element.width)) ? Number(element.width) : 120,
      height: element.height === null ? null : Number.isFinite(Number(element.height)) ? Number(element.height) : null,
      rotation: Number.isFinite(Number(element.rotation)) ? Number(element.rotation) : 0,
      opacity: Number.isFinite(Number(element.opacity)) ? Number(element.opacity) : 1,
      zIndex: Number.isFinite(Number(element.zIndex)) ? Number(element.zIndex) : 1,
      visible: element.visible !== false,
      device: element.device ?? "mobile",
    };
  });
}

function getDocumentHeight(sections: CanvasSection[]) {
  return sections.reduce((max, section) => Math.max(max, section.y + section.height), MOBILE_CANVAS_VIEWPORT_HEIGHT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
