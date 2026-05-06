// ─── Canvas V2 Types ─────────────────────────────────────────────────────────
// Self-contained types for the isolated canvas-v2 editor.
// Do NOT import from lib/types to keep this editor fully isolated.

export type V2ElementType = "text" | "image" | "decoration";

export interface V2BaseElement {
  id: string;
  type: V2ElementType;
  /** Left position as px within the 390px canvas */
  x: number;
  /** Top position as px within the canvas document */
  y: number;
  /** Width in px */
  width: number;
  /** Height in px */
  height: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
}

export interface V2TextElement extends V2BaseElement {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "300" | "400" | "500" | "600" | "700";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  color: string;
  lineHeight: number;
  letterSpacing: number;
}

export interface V2ImageElement extends V2BaseElement {
  type: "image";
  url: string;
  objectFit: "cover" | "contain";
  borderRadius: number;
}

export interface V2DecorationElement extends V2BaseElement {
  type: "decoration";
  /** SVG string or CSS class name */
  svgContent: string;
  color: string;
  rotation: number;
}

export type V2Element = V2TextElement | V2ImageElement | V2DecorationElement;

export interface V2CanvasDesign {
  /** Fixed mobile viewport */
  width: 390;
  height: number;
  background: string;
  elements: V2Element[];
}
