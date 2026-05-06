import type { CanvasDesign } from "@/lib/types";

export const MOBILE_CANVAS_WIDTH = 390;
export const MOBILE_CANVAS_HEIGHT = 844;

export type NormalizedMobileCanvasDesign = CanvasDesign & {
  version: 1;
  viewport: "mobile";
  width: typeof MOBILE_CANVAS_WIDTH;
  height: typeof MOBILE_CANVAS_HEIGHT;
  refWidth: typeof MOBILE_CANVAS_WIDTH;
  refHeight: typeof MOBILE_CANVAS_HEIGHT;
};

export function normalizeCanvasDesign(value: unknown): NormalizedMobileCanvasDesign {
  const source = isRecord(value) ? value : {};
  const elements = Array.isArray(source.elements) ? source.elements : [];
  const background = isRecord(source.background) ? source.background : { type: "none" };
  const updatedAt = typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString();

  return {
    ...(source as Partial<CanvasDesign>),
    version: 1,
    viewport: "mobile",
    width: MOBILE_CANVAS_WIDTH,
    height: MOBILE_CANVAS_HEIGHT,
    refWidth: MOBILE_CANVAS_WIDTH,
    refHeight: MOBILE_CANVAS_HEIGHT,
    background: background as CanvasDesign["background"],
    elements: elements as CanvasDesign["elements"],
    updatedAt,
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
    Number(height) === MOBILE_CANVAS_HEIGHT
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
