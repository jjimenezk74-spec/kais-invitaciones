"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { saveCanvasDesignV3 } from "./actions";
import {
  CANVAS_V3_THEMES,
  DEFAULT_CANVAS_V3_THEME_ID,
  getCanvasV3Theme,
  type CanvasV3Theme
} from "./themes-v3";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ElType = "text" | "shape" | "app" | "decoration";
type V3AppType = "rsvp" | "whatsapp" | "countdown" | "maps" | "live-album" | "live-screen" | "qr";

interface V3Element {
  id: string;
  type: ElType;
  x: number;
  y: number;
  width: number;
  height: number | null;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  // text
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
  // shape / decoration
  background?: string;
  borderRadius?: number;
  border?: string;       // legacy shorthand — prefer the three fields below
  borderColor?: string;
  borderWidth?: number;  // px, 0 = no border
  borderStyle?: "solid" | "dashed" | "none";
  opacity?: number;
  blur?: number;
  // app
  appKind?: V3AppType | "album" | "live";
  appType?: V3AppType;
  config?: {
    url?: string;
    primaryColor?: string;
    textColor?: string;
  };
}

type V3Section = {
  id: string;
  label: string;
  y: number;
  height: number;
  background: string;
};

type CanvasV3Design = {
  version: 3;
  viewport: "mobile";
  width: number;
  height: number;
  themeId: CanvasV3Theme["id"];
  sections: V3Section[];
  elements: V3Element[];
};

type ToolId =
  | "templates"
  | "elements"
  | "text"
  | "uploaded"
  | "apps"
  | "projects";

type InspectorGroup =
  | "content"
  | "typography"
  | "fill"
  | "stroke"
  | "shadow"
  | "spacing"
  | "action"
  | "visibility";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & initial design
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 390;
const HERO_H = 844;

const cx = (w: number) => Math.round((CANVAS_W - w) / 2);

const DEFAULT_SECTION_TEMPLATES: Omit<V3Section, "y">[] = [
  { id: "hero", label: "Hero", height: 844, background: "linear-gradient(180deg,#1a0a18 0%,#3d1535 45%,#180a14 100%)" },
  { id: "countdown", label: "Cuenta regresiva", height: 420, background: "linear-gradient(180deg,#180a14,#211129)" },
  { id: "presentation", label: "Presentacion", height: 560, background: "linear-gradient(180deg,#211129,#160f1f)" },
  { id: "messages", label: "Mensajes", height: 640, background: "linear-gradient(180deg,#160f1f,#241125)" },
  { id: "details", label: "Detalles", height: 620, background: "linear-gradient(180deg,#241125,#18121f)" },
  { id: "church", label: "Iglesia", height: 520, background: "linear-gradient(180deg,#18121f,#20101c)" },
  { id: "dresscode", label: "Vestimenta", height: 460, background: "linear-gradient(180deg,#20101c,#17111c)" },
  { id: "rsvp", label: "RSVP", height: 560, background: "linear-gradient(180deg,#17111c,#241225)" },
  { id: "footer", label: "Footer", height: 280, background: "linear-gradient(180deg,#241225,#0f0f17)" }
];

function buildSections(templates = DEFAULT_SECTION_TEMPLATES): V3Section[] {
  let y = 0;
  return templates.map((section) => {
    const next = { ...section, y };
    y += section.height;
    return next;
  });
}

const DEFAULT_SECTIONS = buildSections();

/** Recalculate y offsets after reorder / insert / delete so sections stack without gaps. */
function recalcSectionY(secs: V3Section[]): V3Section[] {
  let y = 0;
  return secs.map((s) => { const n = { ...s, y }; y += s.height; return n; });
}

const DEFAULT_DOCUMENT_H = DEFAULT_SECTIONS.at(-1)!.y + DEFAULT_SECTIONS.at(-1)!.height;

const INITIAL_ELEMENTS: V3Element[] = [
  // Background gradient overlay
  {
    id: "bg",
    type: "shape",
    x: 0, y: 0, width: CANVAS_W, height: HERO_H,
    locked: true, visible: true, zIndex: 0,
    background: "linear-gradient(180deg,#1a0a18 0%,#3d1535 45%,#180a14 100%)",
    borderRadius: 0, opacity: 1,
  },
  // Glow orb
  {
    id: "glow",
    type: "decoration",
    x: cx(280), y: 280, width: 280, height: 280,
    locked: false, visible: true, zIndex: 1,
    background: "radial-gradient(circle,#c8a96a44 0%,#7c3aed22 50%,transparent 72%)",
    borderRadius: 999, opacity: 0.7, blur: 12,
  },
  // Event type badge
  {
    id: "badge",
    type: "text",
    x: cx(240), y: 130, width: 240, height: 20,
    locked: false, visible: true, zIndex: 2,
    content: "✦  QUINCEAÑERA  ✦",
    fontSize: 11, fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: "600", color: "#c8a96a",
    letterSpacing: 0.4, textAlign: "center",
    textShadow: "0 0 18px #c8a96a88",
  },
  // Main title
  {
    id: "title",
    type: "text",
    x: cx(360), y: 160, width: 360, height: null,
    locked: false, visible: true, zIndex: 3,
    content: "Valentina\nGómez",
    fontSize: 68, fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: "400", fontStyle: "italic", color: "#fff7ef",
    textAlign: "center", lineHeight: 0.92,
    textShadow: "0 4px 22px rgba(0,0,0,0.65)",
  },
  // Date pill
  {
    id: "date",
    type: "text",
    x: cx(360), y: 340, width: 360, height: 28,
    locked: false, visible: true, zIndex: 4,
    content: "Sábado · 14 de Junio, 2025 · 20:00 hs",
    fontSize: 14, fontFamily: "'Playfair Display', Georgia, serif",
    fontStyle: "italic", color: "#f8d9a0",
    textAlign: "center", textShadow: "0 2px 10px rgba(0,0,0,0.6)",
  },
  // Divider line
  {
    id: "divider",
    type: "shape",
    x: cx(200), y: 382, width: 200, height: 1,
    locked: false, visible: true, zIndex: 5,
    background: "linear-gradient(90deg,transparent,#c8a96a88,transparent)",
    borderRadius: 0, opacity: 1,
  },
  // Message card
  {
    id: "message",
    type: "decoration",
    x: cx(340), y: 398, width: 340, height: 110,
    locked: false, visible: true, zIndex: 6,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(200,169,106,0.2)",
    borderRadius: 20, opacity: 1,
    content: "Con amor y alegría, te invitamos a celebrar\nel día más especial de mi vida.\nTu presencia es mi mayor regalo.",
    fontSize: 14, color: "#f0e4cc",
    textAlign: "center", lineHeight: 1.55,
  },
  // RSVP app block
  {
    id: "rsvp-app",
    type: "app",
    x: cx(320), y: 550, width: 320, height: 90,
    locked: false, visible: true, zIndex: 7,
    appKind: "rsvp",
    background: "linear-gradient(135deg,#c8a96a,#9b6f2a)",
    borderRadius: 16,
  },
  // Countdown app block
  {
    id: "countdown-app",
    type: "app",
    x: cx(340), y: 660, width: 340, height: 60,
    locked: false, visible: true, zIndex: 8,
    appKind: "countdown",
    background: "rgba(124,58,237,0.18)",
    border: "1px solid rgba(124,58,237,0.35)",
    borderRadius: 14,
  },
  // Bottom decoration
  {
    id: "footer-deco",
    type: "decoration",
    x: cx(260), y: 750, width: 260, height: 18,
    locked: false, visible: true, zIndex: 9,
    content: "✦  ✦  ✦",
    fontSize: 12, color: "#c8a96a88",
    textAlign: "center",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isV3Element(value: unknown): value is V3Element {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    (typeof value.height === "number" || value.height === null) &&
    typeof value.locked === "boolean" &&
    typeof value.visible === "boolean" &&
    typeof value.zIndex === "number"
  );
}

function isV3Section(value: unknown): value is V3Section {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.y === "number" &&
    typeof value.height === "number" &&
    typeof value.background === "string"
  );
}

function normalizeInitialV3Design(value: unknown): CanvasV3Design | null {
  if (!isRecord(value)) return null;
  if (value.version !== 3) return null;
  if (value.width !== CANVAS_W || typeof value.height !== "number") return null;
  if (!Array.isArray(value.elements)) return null;

  const elements = value.elements.filter(isV3Element);
  if (elements.length !== value.elements.length) return null;
  const rawSections = Array.isArray(value.sections) ? value.sections.filter(isV3Section) : [];
  const sections = rawSections.length ? rawSections : DEFAULT_SECTIONS;
  const height = sections.at(-1) ? sections.at(-1)!.y + sections.at(-1)!.height : DEFAULT_DOCUMENT_H;

  return {
    version: 3,
    viewport: "mobile",
    width: CANVAS_W,
    height,
    themeId: getCanvasV3Theme(typeof value.themeId === "string" ? value.themeId : null).id,
    sections,
    elements
  };
}

function createV3Design(elements: V3Element[], sections: V3Section[], themeId: CanvasV3Theme["id"]): CanvasV3Design {
  const height = sections.at(-1) ? sections.at(-1)!.y + sections.at(-1)!.height : DEFAULT_DOCUMENT_H;
  return {
    version: 3,
    viewport: "mobile",
    width: CANVAS_W,
    height,
    themeId,
    sections,
    elements
  };
}

function getTextStyleForElement(element: V3Element, theme: CanvasV3Theme) {
  const content = (element.content ?? "").toLowerCase();
  const isTitle =
    element.id === "title" ||
    (element.fontSize ?? 0) >= 42 ||
    element.fontFamily?.toLowerCase().includes("playfair");
  const isSubtitle =
    element.id === "badge" ||
    element.id === "date" ||
    content.includes("subtitulo") ||
    ((element.fontSize ?? 0) >= 20 && (element.fontSize ?? 0) < 42);

  return isTitle ? theme.textStyles.title : isSubtitle ? theme.textStyles.subtitle : theme.textStyles.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar tool icons
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS: { id: ToolId; icon: string; label: string }[] = [
  { id: "templates", icon: "⊞", label: "Plantillas" },
  { id: "elements", icon: "◈", label: "Elementos" },
  { id: "text", icon: "T", label: "Texto" },
  { id: "uploaded", icon: "↑", label: "Subidos" },
  { id: "apps", icon: "⚡", label: "Apps" },
  { id: "projects", icon: "◻", label: "Proyectos" },
];

// ─────────────────────────────────────────────────────────────────────────────
// App block renderer
// ─────────────────────────────────────────────────────────────────────────────

const APP_LABELS: Record<string, { label: string; icon: string }> = {
  rsvp: { label: "Confirmar Asistencia", icon: "✓" },
  countdown: { label: "Cuenta Regresiva: 45 DÍAS  12 HRS  08 MIN", icon: "⏱" },
  whatsapp: { label: "Mensaje por WhatsApp", icon: "💬" },
  album: { label: "Álbum en Vivo", icon: "📸" },
  live: { label: "Pantalla en Vivo", icon: "🖥" },
  maps: { label: "Ver en Google Maps", icon: "📍" },
  qr: { label: "Código QR", icon: "▦" },
};

const APP_DEMO_LABELS: Record<string, { label: string; icon: string }> = {
  rsvp: { label: "Confirmar asistencia", icon: "✓" },
  countdown: { label: "Cuenta regresiva", icon: "⏱" },
  whatsapp: { label: "Enviar WhatsApp", icon: "✉" },
  maps: { label: "Ver ubicacion", icon: "⌖" },
  "live-album": { label: "Album en vivo", icon: "▧" },
  "live-screen": { label: "Pantalla en vivo", icon: "▣" },
  qr: { label: "QR", icon: "▦" },
  album: { label: "Album en vivo", icon: "▧" },
  live: { label: "Pantalla en vivo", icon: "▣" }
};

const APP_BLOCKS: { id: V3AppType; icon: string; label: string }[] = [
  { id: "rsvp", icon: "✓", label: "Confirmar asistencia" },
  { id: "whatsapp", icon: "✉", label: "WhatsApp" },
  { id: "countdown", icon: "⏱", label: "Cuenta regresiva" },
  { id: "maps", icon: "⌖", label: "Ver ubicacion" },
  { id: "live-album", icon: "▧", label: "Album en vivo" },
  { id: "live-screen", icon: "▣", label: "Pantalla en vivo" },
  { id: "qr", icon: "▦", label: "QR" }
];

const APP_DEFAULTS: Record<V3AppType, {
  content: string;
  width: number;
  height: number;
  background: string;
  color: string;
  border?: string;
  borderRadius: number;
  url?: string;
}> = {
  rsvp: { content: "Confirmar asistencia", width: 320, height: 82, background: "linear-gradient(135deg,#c8a96a,#9b6f2a)", color: "#1a0a18", borderRadius: 18 },
  whatsapp: { content: "Enviar WhatsApp", width: 320, height: 78, background: "linear-gradient(135deg,#1f7a4d,#c8a96a)", color: "#fffaf0", borderRadius: 18, url: "https://wa.me/" },
  countdown: { content: "45 DIAS · 12 HRS · 08 MIN · 30 SEG", width: 340, height: 96, background: "rgba(124,58,237,0.18)", color: "#e8e6ff", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 16 },
  maps: { content: "Ver ubicacion", width: 320, height: 78, background: "rgba(200,169,106,0.16)", color: "#f4d28a", border: "1px solid rgba(200,169,106,0.36)", borderRadius: 16, url: "https://maps.google.com" },
  "live-album": { content: "Album en vivo", width: 320, height: 88, background: "rgba(255,255,255,0.08)", color: "#fff7ef", border: "1px solid rgba(200,169,106,0.26)", borderRadius: 18 },
  "live-screen": { content: "Pantalla en vivo", width: 320, height: 88, background: "linear-gradient(135deg,rgba(124,58,237,0.35),rgba(0,0,0,0.34))", color: "#e8e6ff", border: "1px solid rgba(167,139,250,0.38)", borderRadius: 18 },
  qr: { content: "QR del evento", width: 170, height: 190, background: "#fffaf0", color: "#1a0a18", border: "1px solid rgba(200,169,106,0.45)", borderRadius: 18 }
};

function normalizeAppType(element: V3Element): V3AppType | null {
  const raw = element.appType ?? element.appKind;
  if (raw === "album") return "live-album";
  if (raw === "live") return "live-screen";
  return raw && raw in APP_DEFAULTS ? raw as V3AppType : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Border helper — prefers explicit fields, falls back to legacy `border` string
// ─────────────────────────────────────────────────────────────────────────────

function computeBorder(el: { border?: string; borderColor?: string; borderWidth?: number; borderStyle?: "solid" | "dashed" | "none" }): string | undefined {
  if (el.borderWidth !== undefined || el.borderStyle !== undefined || el.borderColor !== undefined) {
    const w = el.borderWidth ?? 1;
    if (w === 0 || el.borderStyle === "none") return "none";
    const s = el.borderStyle ?? "solid";
    const c = el.borderColor ?? "rgba(200,169,106,0.35)";
    return `${w}px ${s} ${c}`;
  }
  return el.border; // legacy
}

function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim());
}

type FillMode = "color" | "gradient" | "none";
function detectFillMode(el: Pick<V3Element, "background" | "config">): FillMode {
  const bg = el.config?.primaryColor ?? el.background ?? "";
  if (!bg || bg === "transparent") return "none";
  if (bg.includes("gradient")) return "gradient";
  return "color";
}

function hasBorder(el: Pick<V3Element, "border" | "borderWidth" | "borderStyle">): boolean {
  if (el.borderWidth !== undefined) return el.borderWidth > 0;
  if (el.borderStyle === "none") return false;
  const b = el.border;
  if (!b || b === "none" || b === "0") return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Render a single canvas element
// ─────────────────────────────────────────────────────────────────────────────

function RenderElement({
  el,
  selected,
  onMouseDown,
  onClick,
  onResizeMouseDown,
}: {
  el: V3Element;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent, handle: string) => void;
}) {
  const boxStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height ?? "auto",
    zIndex: el.zIndex,
    opacity: el.opacity ?? 1,
    borderRadius: el.borderRadius,
    border: computeBorder(el),
    cursor: el.locked ? "default" : selected ? "grab" : "pointer",
    userSelect: "none",
    overflow: selected ? "visible" : "hidden",
  };

  if (el.background && !el.content) {
    boxStyle.background = el.background;
    if (el.blur) boxStyle.backdropFilter = `blur(${el.blur}px)`;
  }

  const [isHovered, setIsHovered] = useState(false);
  const ringStyle: React.CSSProperties = selected
    ? { outline: "2px solid #7c3aed", outlineOffset: "1px" }
    : isHovered
    ? { outline: "1px dashed rgba(124,58,237,0.55)", outlineOffset: "1px" }
    : {};

  const handleSize = 8;
  const handles = ["tl", "t", "tr", "r", "br", "b", "bl", "l"];
  const handlePositions: Record<string, React.CSSProperties> = {
    tl: { top: -handleSize / 2, left: -handleSize / 2, cursor: "nwse-resize" },
    t: { top: -handleSize / 2, left: "50%", marginLeft: -handleSize / 2, cursor: "ns-resize" },
    tr: { top: -handleSize / 2, right: -handleSize / 2, cursor: "nesw-resize" },
    r: { top: "50%", right: -handleSize / 2, marginTop: -handleSize / 2, cursor: "ew-resize" },
    br: { bottom: -handleSize / 2, right: -handleSize / 2, cursor: "nwse-resize" },
    b: { bottom: -handleSize / 2, left: "50%", marginLeft: -handleSize / 2, cursor: "ns-resize" },
    bl: { bottom: -handleSize / 2, left: -handleSize / 2, cursor: "nesw-resize" },
    l: { top: "50%", left: -handleSize / 2, marginTop: -handleSize / 2, cursor: "ew-resize" },
  };
  const toolbarLabel = el.type === "text" ? "Texto" : el.type === "app" ? "Bloque" : el.type === "decoration" ? "Decoración" : "Forma";
  const toolbarHint = el.type === "text" ? "Tipografía" : el.type === "app" ? "Acción" : "Forma";

  return (
    <div
      style={{ ...boxStyle, ...ringStyle }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
    >
      {/* Background fill */}
      {el.background && (
        <div
          style={{
            position: "absolute", inset: 0,
            background: el.background,
            borderRadius: el.borderRadius,
            backdropFilter: el.blur ? `blur(${el.blur}px)` : undefined,
          }}
        />
      )}

      {/* Text content */}
      {el.content && el.type !== "app" && (
        <p
          style={{
            position: "relative",
            margin: 0,
            padding: el.type === "decoration" ? "16px 20px" : 0,
            fontFamily: el.fontFamily ?? "Inter, system-ui, sans-serif",
            fontSize: el.fontSize ?? 14,
            fontWeight: el.fontWeight ?? "400",
            fontStyle: el.fontStyle ?? "normal",
            textAlign: el.textAlign ?? "center",
            color: el.color ?? "#ffffff",
            lineHeight: el.lineHeight ?? 1.4,
            letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : undefined,
            textShadow: el.textShadow ?? undefined,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            width: "100%",
          }}
        >
          {el.content}
        </p>
      )}

      {/* App block content */}
      {el.type === "app" && normalizeAppType(el) && (
        <div
          style={{
            position: "absolute", inset: 0,
            background: el.background,
            borderRadius: el.borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: normalizeAppType(el) === "qr" ? 12 : 0,
            flexDirection: normalizeAppType(el) === "qr" ? "column" : "row",
          }}
        >
          {normalizeAppType(el) === "countdown" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, width: "88%" }}>
              {["45", "12", "08", "30"].map((value, index) => (
                <div key={index} style={{ textAlign: "center" }}>
                  <strong style={{ display: "block", color: el.color ?? "#e8e6ff", fontSize: 18 }}>{value}</strong>
                  <span style={{ color: el.color ?? "#e8e6ff", opacity: 0.72, fontSize: 8, letterSpacing: "0.08em" }}>
                    {["DIAS", "HRS", "MIN", "SEG"][index]}
                  </span>
                </div>
              ))}
            </div>
          ) : normalizeAppType(el) === "qr" ? (
            <>
              <div style={{ width: 104, height: 104, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                {Array.from({ length: 25 }).map((_, index) => (
                  <span key={index} style={{ background: index % 3 === 0 || index % 7 === 0 ? "#1a0a18" : "transparent", borderRadius: 2 }} />
                ))}
              </div>
              <span style={{ color: el.color ?? "#1a0a18", fontSize: 11, fontWeight: 700 }}>{el.content ?? "QR del evento"}</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 18 }}>{APP_DEMO_LABELS[normalizeAppType(el)!]?.icon}</span>
              <span style={{
                color: el.color ?? APP_DEFAULTS[normalizeAppType(el)!].color,
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: normalizeAppType(el) === "rsvp" ? 15 : 13,
                fontWeight: normalizeAppType(el) === "rsvp" ? "700" : "600",
                letterSpacing: normalizeAppType(el) === "rsvp" ? "0.12em" : "0.04em",
              }}>
                {el.content || APP_DEMO_LABELS[normalizeAppType(el)!]?.label}
              </span>
            </>
          )}
        </div>
      )}

      {/* Resize handles */}
      {selected && !el.locked && handles.map((h) => (
        <div
          key={h}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeMouseDown(e, h); }}
          style={{
            position: "absolute",
            width: handleSize, height: handleSize,
            background: "#ffffff",
            border: "2px solid #7c3aed",
            borderRadius: 2,
            zIndex: 9999,
            ...handlePositions[h],
          }}
        />
      ))}
      {selected && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: -38,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 9px",
            borderRadius: 999,
            background: "rgba(18,18,28,0.94)",
            border: "1px solid rgba(124,58,237,0.65)",
            boxShadow: "0 10px 26px rgba(0,0,0,0.38)",
            color: "#e8e6ff",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#c8a96a" }}>{toolbarLabel}</span>
          <span style={{ color: "#6f6b8f" }}>•</span>
          <span style={{ color: "#a78bfa" }}>{toolbarHint}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Expanded panel content per tool
// ─────────────────────────────────────────────────────────────────────────────

function ExpandedPanel({
  tool,
  onAddText,
  onAddElement,
  onAddApp,
  onApplyTheme,
  activeThemeId,
}: {
  tool: ToolId;
  onAddText: (kind: "title" | "subtitle" | "paragraph") => void;
  onAddElement: (kind: string) => void;
  onAddApp: (kind: string) => void;
  onApplyTheme: (theme: CanvasV3Theme) => void;
  activeThemeId: string;
}) {
  if (tool === "text") {
    return (
      <div style={{ padding: "12px 14px" }}>
        <p style={{ color: "#8884a8", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Texto
        </p>
        {(["title", "subtitle", "paragraph"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onAddText(k)}
            style={{
              display: "block", width: "100%", marginBottom: 8,
              padding: "10px 14px",
              background: "#1e1e2d", border: "1px solid #2a2a3d",
              borderRadius: 10, cursor: "pointer", textAlign: "left",
              color: k === "title" ? "#e8e6ff" : k === "subtitle" ? "#c8c4f0" : "#9898b8",
              fontSize: k === "title" ? 18 : k === "subtitle" ? 14 : 12,
              fontFamily: k === "title" ? "'Playfair Display', Georgia, serif" : "Inter, system-ui, sans-serif",
              fontStyle: k === "title" ? "italic" : "normal",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a3d")}
          >
            {k === "title" ? "Agregar título" : k === "subtitle" ? "Agregar subtítulo" : "Agregar párrafo"}
          </button>
        ))}
      </div>
    );
  }

  if (tool === "elements") {
    const cats = [
      { label: "Formas", items: ["Rectángulo", "Círculo", "Línea"] },
      { label: "Flores", items: ["Rosa", "Flor 1", "Flor 2"] },
      { label: "Brillos", items: ["Destello", "Glow", "Polvo"] },
      { label: "Separadores", items: ["Línea dorada", "Ola", "Puntos"] },
      { label: "Botones", items: ["Primario", "Outline", "Ghost"] },
    ];
    return (
      <div style={{ padding: "12px 14px", overflowY: "auto", maxHeight: "calc(100vh - 56px)" }}>
        {cats.map((cat) => (
          <div key={cat.label} style={{ marginBottom: 14 }}>
            <p style={{ color: "#8884a8", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>
              {cat.label}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {cat.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onAddElement(item)}
                  style={{
                    padding: "8px 10px",
                    background: "#1e1e2d", border: "1px solid #2a2a3d",
                    borderRadius: 8, cursor: "pointer",
                    color: "#c8c4f0", fontSize: 11,
                    fontFamily: "Inter, system-ui, sans-serif",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a3d")}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === "apps") {
    const apps = [
      { id: "rsvp", icon: "✓", label: "Confirmar asistencia" },
      { id: "countdown", icon: "⏱", label: "Cuenta regresiva" },
      { id: "whatsapp", icon: "💬", label: "WhatsApp" },
      { id: "album", icon: "📸", label: "Álbum en vivo" },
      { id: "live", icon: "🖥", label: "Pantalla en vivo" },
      { id: "maps", icon: "📍", label: "Google Maps" },
      { id: "qr", icon: "▦", label: "Código QR" },
    ];
    return (
      <div style={{ padding: "12px 14px" }}>
        <p style={{ color: "#8884a8", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Bloques interactivos
        </p>
        {APP_BLOCKS.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => onAddApp(app.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", marginBottom: 6,
              padding: "10px 14px",
              background: "#1e1e2d", border: "1px solid #2a2a3d",
              borderRadius: 10, cursor: "pointer", textAlign: "left",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a3d")}
          >
            <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{app.icon}</span>
            <span style={{ color: "#c8c4f0", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif" }}>
              {app.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (tool === "templates") {
    return (
      <div style={{ padding: "12px 14px" }}>
        <p style={{ color: "#8884a8", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Plantillas
        </p>
        {CANVAS_V3_THEMES.map((theme) => (
          <div
            key={theme.id}
            style={{
              marginBottom: 10,
              padding: 10,
              background: activeThemeId === theme.id ? "rgba(124,58,237,0.18)" : "#1e1e2d",
              border: activeThemeId === theme.id ? "1px solid #7c3aed" : "1px solid #2a2a3d",
              borderRadius: 12
            }}
          >
            <div style={{
              height: 48,
              borderRadius: 10,
              marginBottom: 9,
              background: theme.sectionBackgrounds.hero,
              boxShadow: `inset 0 0 0 1px ${theme.colors.accent}44`
            }} />
            <p style={{ color: "#e8e6ff", fontSize: 12, fontWeight: 700, margin: "0 0 4px", fontFamily: "Inter, system-ui, sans-serif" }}>
              {theme.name}
            </p>
            <p style={{ color: "#8884a8", fontSize: 10, lineHeight: 1.35, margin: "0 0 9px", fontFamily: "Inter, system-ui, sans-serif" }}>
              {theme.description}
            </p>
            <button
              type="button"
              onClick={() => onApplyTheme(theme)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 9,
                border: "1px solid rgba(200,169,106,0.36)",
                background: activeThemeId === theme.id ? "rgba(200,169,106,0.22)" : "rgba(200,169,106,0.10)",
                color: activeThemeId === theme.id ? "#f4d28a" : "#c8c4f0",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {activeThemeId === theme.id ? "Aplicado" : "Aplicar"}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, color: "#8884a8", fontSize: 12, textAlign: "center" }}>
      Próximamente
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right contextual panel
// ─────────────────────────────────────────────────────────────────────────────

function RightPanel({
  element,
  onChange,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  section,
  onDuplicateSection,
  onDeleteSection,
  onMoveSectionUp,
  onMoveSectionDown,
}: {
  element: V3Element | null;
  onChange: (id: string, patch: Partial<V3Element>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  section: V3Section | null;
  onDuplicateSection: () => void;
  onDeleteSection: () => void;
  onMoveSectionUp: () => void;
  onMoveSectionDown: () => void;
}) {
  const [pendingDelete, setPendingDelete] = React.useState<"element" | "section" | null>(null);
  const [openGroup, setOpenGroup] = React.useState<InspectorGroup>("content");

  const s: React.CSSProperties = {
    width: "100%",
    height: "100%",
    minWidth: 0,
    flexShrink: 0,
    background: "#16161f",
    borderLeft: "1px solid #2a2a3d",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  };

  const labelStyle: React.CSSProperties = {
    color: "#8884a8", fontSize: 10, letterSpacing: "0.1em",
    textTransform: "uppercase", display: "block", marginBottom: 6,
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px",
    background: "#1e1e2d", border: "1px solid #2a2a3d",
    borderRadius: 8, color: "#e8e6ff", fontSize: 12,
    fontFamily: "Inter, system-ui, sans-serif",
    outline: "none", boxSizing: "border-box",
  };
  const actionBtnStyle: React.CSSProperties = {
    padding: "7px 10px",
    background: "#1e1e2d",
    border: "1px solid #2a2a3d",
    borderRadius: 8,
    cursor: "pointer",
    color: "#c8c4f0",
    fontSize: 11,
    fontFamily: "Inter, system-ui, sans-serif",
    textAlign: "left",
    transition: "all 0.12s",
    width: "100%",
  };
  const sectionHeaderStyle: React.CSSProperties = {
    padding: "16px",
    borderBottom: "1px solid #2a2a3d",
    background: "linear-gradient(135deg, rgba(200,169,106,0.10), rgba(22,22,31,0.96))",
  };
  const elementHeaderStyle: React.CSSProperties = {
    padding: "16px",
    borderBottom: "1px solid #2a2a3d",
    background: "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(22,22,31,0.96))",
  };
  const panelBadgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const renderGroup = (
    id: InspectorGroup,
    title: string,
    children: React.ReactNode,
    visible = true,
    icon = "•"
  ) => {
    if (!visible) return null;
    const isOpen = openGroup === id;
    return (
      <div style={{ background: "#14141f", border: "1px solid #2a2a3d", borderRadius: 12, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setOpenGroup(id)}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "none",
            borderBottom: isOpen ? "1px solid #2a2a3d" : "none",
            background: isOpen ? "#1e1e2d" : "transparent",
            color: isOpen ? "#e8e6ff" : "#a8a3c8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: isOpen ? "#c8a96a" : "#6f6b8f" }}>{icon}</span>
            {title}
          </span>
          <span style={{ color: "#6f6b8f" }}>{isOpen ? "−" : "+"}</span>
        </button>
        {isOpen && (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  // ── Section panel (no element selected) ──────────────────────────────────
  if (!element) {
    if (section) {
      return (
        <div style={s}>
          <div style={sectionHeaderStyle}>
            <span style={{ ...panelBadgeStyle, color: "#f4d28a", background: "rgba(200,169,106,0.12)", border: "1px solid rgba(200,169,106,0.24)" }}>
              ? Secci?n
            </span>
            <p style={{ color: "#fff7dc", fontSize: 19, fontWeight: "750", fontFamily: "Inter, system-ui, sans-serif", margin: "10px 0 0" }}>
              {section.label}
            </p>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" onClick={onDuplicateSection} style={actionBtnStyle}>⧉ Duplicar sección</button>
            <button type="button" onClick={onMoveSectionUp} style={actionBtnStyle}>↑ Subir sección</button>
            <button type="button" onClick={onMoveSectionDown} style={actionBtnStyle}>↓ Bajar sección</button>
            <div style={{ height: 1, background: "#2a2a3d", margin: "4px 0" }} />
            {pendingDelete === "section" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { onDeleteSection(); setPendingDelete(null); }}
                  style={{ ...actionBtnStyle, flex: 1, background: "rgba(220,38,38,0.22)", border: "1px solid rgba(220,38,38,0.5)", color: "#f87171" }}>
                  Confirmar eliminación
                </button>
                <button type="button" onClick={() => setPendingDelete(null)}
                  style={{ ...actionBtnStyle, width: "auto", padding: "7px 14px", color: "#8884a8" }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setPendingDelete("section")}
                style={{ ...actionBtnStyle, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.28)", color: "#f87171" }}>
                ✕ Eliminar sección
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={s}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: "0 20px" }}>
          <span style={{ fontSize: 28, opacity: 0.25 }}>◻</span>
          <p style={{ color: "#8884a8", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
            Selecciona un elemento en el canvas, o una sección en el panel izquierdo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s}>
      {/* Element header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #2a2a3d" }}>
        <p style={{ color: "#c8a96a", fontSize: 10, letterSpacing: "0.1em", fontFamily: "Inter, system-ui, sans-serif", margin: 0, textTransform: "uppercase", opacity: 0.75 }}>Elemento</p>
        <p style={{ color: "#e8e6ff", fontSize: 14, fontWeight: "600", fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>
          {element.type === "text" ? "Texto" : element.type === "app" ? "Bloque App" : element.type === "decoration" ? "Decoración" : "Forma"}
          {element.locked && <span style={{ marginLeft: 8, color: "#c8a96a", fontSize: 10 }}>🔒</span>}
        </p>
      </div>
      {/* Element actions */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #2a2a3d", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <button type="button" onClick={onDuplicate}
            style={{ ...actionBtnStyle, flex: 1, textAlign: "center" }}>⧉ Duplicar</button>
          <button type="button" onClick={onBringToFront}
            style={{ ...actionBtnStyle, flex: 1, textAlign: "center" }}>↑ Al frente</button>
          <button type="button" onClick={onSendToBack}
            style={{ ...actionBtnStyle, flex: 1, textAlign: "center" }}>↓ Atrás</button>
        </div>
        {pendingDelete === "element" ? (
          <div style={{ display: "flex", gap: 5 }}>
            <button type="button" onClick={() => { onDelete(); setPendingDelete(null); }}
              style={{ ...actionBtnStyle, flex: 1, background: "rgba(220,38,38,0.22)", border: "1px solid rgba(220,38,38,0.5)", color: "#f87171", textAlign: "center" }}>
              Confirmar eliminación
            </button>
            <button type="button" onClick={() => setPendingDelete(null)}
              style={{ ...actionBtnStyle, width: "auto", padding: "7px 14px", color: "#8884a8", textAlign: "center" }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setPendingDelete("element")}
            style={{ ...actionBtnStyle, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.28)", color: "#f87171", textAlign: "center" }}>
            ✕ Eliminar elemento
          </button>
        )}
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {renderGroup("content", "Contenido", (
          <>
            {element.type === "text" && <div><span style={labelStyle}>Texto</span><textarea value={element.content ?? ""} rows={4} onChange={(e) => onChange(element.id, { content: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} /></div>}
            {element.type === "app" && normalizeAppType(element) && <><div style={{ padding: "10px 12px", background: "#1e1e2d", border: "1px solid #2a2a3d", borderRadius: 10 }}><p style={{ color: "#c8c4f0", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>{APP_DEMO_LABELS[normalizeAppType(element)!]?.icon} {APP_DEMO_LABELS[normalizeAppType(element)!]?.label}</p><p style={{ color: "#8884a8", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>Bloque visual demo</p></div><div><span style={labelStyle}>Texto del bloque</span><input type="text" value={element.content ?? APP_DEMO_LABELS[normalizeAppType(element)!]?.label ?? ""} onChange={(e) => onChange(element.id, { content: e.target.value })} style={inputStyle} /></div></>}
            {(element.type === "shape" || element.type === "decoration") && <p style={{ color: "#8884a8", fontSize: 12, lineHeight: 1.5, margin: 0 }}>Este bloque se edita desde relleno, contorno y sombra.</p>}
          </>
        ), true, element.type === "text" ? "T" : element.type === "app" ? "?" : "?")}
        {renderGroup("typography", "Tipograf?a", <><div><span style={labelStyle}>Color</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={element.color ?? "#ffffff"} onChange={(e) => onChange(element.id, { color: e.target.value })} style={{ width: 36, height: 30, border: "none", borderRadius: 6, cursor: "pointer", background: "none" }} /><input type="text" value={element.color ?? "#ffffff"} onChange={(e) => onChange(element.id, { color: e.target.value })} style={{ ...inputStyle, flex: 1 }} /></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><div><span style={labelStyle}>Tama?o</span><input type="number" min={8} max={120} value={element.fontSize ?? 16} onChange={(e) => onChange(element.id, { fontSize: Number(e.target.value) })} style={inputStyle} /></div><div><span style={labelStyle}>Peso</span><input type="text" value={element.fontWeight ?? "400"} onChange={(e) => onChange(element.id, { fontWeight: e.target.value })} style={inputStyle} /></div></div><div><span style={labelStyle}>Fuente</span><select value={element.fontFamily ?? "Inter, system-ui, sans-serif"} onChange={(e) => onChange(element.id, { fontFamily: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}><option value="Inter, system-ui, sans-serif">Inter</option><option value="'Playfair Display', Georgia, serif">Playfair Display</option><option value="Georgia, serif">Georgia</option><option value="'Dancing Script', cursive">Dancing Script</option></select></div><div><span style={labelStyle}>Alineaci?n</span><div style={{ display: "flex", gap: 4 }}>{(["left", "center", "right"] as const).map((a) => <button key={a} type="button" onClick={() => onChange(element.id, { textAlign: a })} style={{ flex: 1, padding: "6px 0", background: element.textAlign === a ? "#7c3aed" : "#1e1e2d", border: "1px solid #2a2a3d", borderRadius: 6, cursor: "pointer", color: element.textAlign === a ? "#fff" : "#9898b8", fontSize: 11 }}>{a}</button>)}</div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><div><span style={labelStyle}>L?nea</span><input type="number" min={0.8} max={3} step={0.05} value={element.lineHeight ?? 1.4} onChange={(e) => onChange(element.id, { lineHeight: Number(e.target.value) })} style={inputStyle} /></div><div><span style={labelStyle}>Tracking</span><input type="number" min={0} max={1} step={0.01} value={element.letterSpacing ?? 0} onChange={(e) => onChange(element.id, { letterSpacing: Number(e.target.value) })} style={inputStyle} /></div></div></>, element.type === "text", "Aa")}
        {renderGroup("fill", "Relleno", <><div><span style={labelStyle}>Fondo</span><input type="text" value={element.config?.primaryColor ?? element.background ?? ""} placeholder="Color, rgba(...) o linear-gradient(...)" onChange={(e) => onChange(element.id, { background: e.target.value, config: element.type === "app" ? { ...(element.config ?? {}), primaryColor: e.target.value } : element.config })} style={inputStyle} /></div>{element.type === "app" && <div><span style={labelStyle}>Color texto</span><input type="text" value={element.color ?? element.config?.textColor ?? ""} onChange={(e) => onChange(element.id, { color: e.target.value, config: { ...(element.config ?? {}), textColor: e.target.value } })} style={inputStyle} /></div>}<div><span style={labelStyle}>Opacidad {Math.round((element.opacity ?? 1) * 100)}%</span><input type="range" min={0} max={1} step={0.01} value={element.opacity ?? 1} onChange={(e) => onChange(element.id, { opacity: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></div></>, element.type !== "text", "?")}
        {renderGroup("stroke", "Contorno", <><div><span style={labelStyle}>Borde redondeado: {element.borderRadius ?? 0}px</span><input type="range" min={0} max={999} step={1} value={element.borderRadius ?? 0} onChange={(e) => onChange(element.id, { borderRadius: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ ...labelStyle, margin: 0 }}>Activar contorno</span><button type="button" onClick={() => onChange(element.id, hasBorder(element) ? { borderWidth: 0, borderStyle: "none" } : { borderWidth: 1, borderStyle: "solid", borderColor: element.borderColor ?? "#c8a96a" })} style={{ ...actionBtnStyle, width: "auto", padding: "6px 10px" }}>{hasBorder(element) ? "Activo" : "Off"}</button></div>{hasBorder(element) && <><input type="text" value={element.borderColor ?? ""} placeholder="rgba(200,169,106,0.35)" onChange={(e) => onChange(element.id, { borderColor: e.target.value })} style={inputStyle} /><input type="range" min={1} max={12} step={1} value={element.borderWidth ?? 1} onChange={(e) => onChange(element.id, { borderWidth: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /><div style={{ display: "flex", gap: 4 }}>{(["solid", "dashed"] as const).map((borderStyle) => <button key={borderStyle} type="button" onClick={() => onChange(element.id, { borderStyle })} style={{ ...actionBtnStyle, textAlign: "center", background: (element.borderStyle ?? "solid") === borderStyle ? "#2a1f4d" : "#1e1e2d" }}>{borderStyle}</button>)}</div></>}</>, element.type !== "text", "?")}
        {renderGroup("shadow", "Sombra", <>{element.type === "text" && <div><span style={labelStyle}>Text shadow</span><input type="text" value={element.textShadow ?? ""} placeholder="0 2px 10px rgba(...)" onChange={(e) => onChange(element.id, { textShadow: e.target.value })} style={inputStyle} /></div>}{(element.type === "shape" || element.type === "decoration") && element.blur !== undefined && <div><span style={labelStyle}>Blur: {element.blur ?? 0}px</span><input type="range" min={0} max={40} step={1} value={element.blur ?? 0} onChange={(e) => onChange(element.id, { blur: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></div>}</>, element.type === "text" || element.type === "shape" || element.type === "decoration", "?")}
        {renderGroup("spacing", "Espaciado", <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{(["x", "y", "width", "height"] as const).map((k) => <div key={k}><span style={{ ...labelStyle, fontSize: 9 }}>{k.toUpperCase()}</span><input type="number" value={Math.round(element[k] as number) || 0} disabled={element.locked} onChange={(e) => onChange(element.id, { [k]: Number(e.target.value) })} style={{ ...inputStyle, opacity: element.locked ? 0.5 : 1 }} /></div>)}</div>, true, "?")}
        {renderGroup("action", "Acci?n", <>{element.type === "app" && <div><span style={labelStyle}>URL demo</span><input type="text" value={element.config?.url ?? ""} onChange={(e) => onChange(element.id, { config: { ...(element.config ?? {}), url: e.target.value } })} style={inputStyle} /></div>}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" onClick={onDuplicate} style={{ ...actionBtnStyle, textAlign: "center" }}>Duplicar</button><button type="button" onClick={onBringToFront} style={{ ...actionBtnStyle, textAlign: "center" }}>Frente</button><button type="button" onClick={onSendToBack} style={{ ...actionBtnStyle, textAlign: "center" }}>Atr?s</button><button type="button" onClick={() => setPendingDelete("element")} style={{ ...actionBtnStyle, textAlign: "center", color: "#f87171" }}>Eliminar</button></div></>, true, "?")}
        {renderGroup("visibility", "Visibilidad", <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ ...labelStyle, margin: 0 }}>Visible</span><button type="button" onClick={() => onChange(element.id, { visible: !element.visible })} style={{ width: 36, height: 20, borderRadius: 10, background: element.visible ? "#7c3aed" : "#2a2a3d", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}><span style={{ position: "absolute", top: 2, left: element.visible ? 18 : 2, width: 16, height: 16, background: "#fff", borderRadius: 8, transition: "left 0.2s" }} /></button></div>, true, "?")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

type CanvasEditorV3Props = {
  eventId: string;
  eventSlug?: string;
  eventTitle: string;
  initialDesign?: unknown;
};

export function CanvasEditorV3({ eventId, eventSlug, eventTitle, initialDesign = null }: CanvasEditorV3Props) {
  const parsedInitialDesign = normalizeInitialV3Design(initialDesign);
  const [elements, setElements] = useState<V3Element[]>(
    () => parsedInitialDesign?.elements ?? INITIAL_ELEMENTS
  );
  const [sections, setSections] = useState<V3Section[]>(
    () => parsedInitialDesign?.sections ?? DEFAULT_SECTIONS
  );
  const [themeId, setThemeId] = useState<CanvasV3Theme["id"]>(
    () => parsedInitialDesign?.themeId ?? DEFAULT_CANVAS_V3_THEME_ID
  );
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => (parsedInitialDesign?.sections ?? DEFAULT_SECTIONS)[0]?.id ?? "hero"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string; startX: number; startY: number; elX: number; elY: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: string; handle: string;
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
  } | null>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? DEFAULT_SECTIONS[0];
  const documentHeight = sections.at(-1) ? sections.at(-1)!.y + sections.at(-1)!.height : DEFAULT_DOCUMENT_H;

  const scrollToSection = (section: V3Section) => {
    setActiveSectionId(section.id);
    scrollRef.current?.scrollTo({
      top: Math.max(0, section.y * zoom - 20),
      behavior: "smooth"
    });
  };

  // ── Drag to move ────────────────────────────────────────────────────────────
  const onMoveStart = useCallback((e: React.MouseEvent, id: string) => {
    const el = elements.find((el) => el.id === id);
    if (!el || el.locked) return;
    setSelectedId(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y };
  }, [elements]);

  // ── Resize ──────────────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent, id: string, handle: string) => {
    const el = elements.find((el) => el.id === id);
    if (!el || el.locked) return;
    resizeRef.current = {
      id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y,
      origW: el.width, origH: el.height ?? 60,
    };
  }, [elements]);

  // ── Global pointer move & up ─────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { id, startX, startY, elX, elY } = dragRef.current;
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        setElements((prev) =>
          prev.map((el) =>
            el.id === id
              ? { ...el, x: Math.round(elX + dx), y: Math.round(elY + dy) }
              : el
          )
        );
      }
      if (resizeRef.current) {
        const { id, handle, startX, startY, origX, origY, origW, origH } = resizeRef.current;
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== id) return el;
            let x = origX, y = origY, w = origW, h = origH;
            if (handle.includes("r")) w = Math.max(40, origW + dx);
            if (handle.includes("l")) { x = origX + dx; w = Math.max(40, origW - dx); }
            if (handle.includes("b")) h = Math.max(20, origH + dy);
            if (handle.includes("t")) { y = origY + dy; h = Math.max(20, origH - dy); }
            return { ...el, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
          })
        );
      }
    };
    const onUp = () => { dragRef.current = null; resizeRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [zoom]);

  // ── Add elements ────────────────────────────────────────────────────────────────────────────
  const addText = (kind: "title" | "subtitle" | "paragraph") => {
    const id = `text-${Date.now()}`;
    const sectionY = activeSection?.y ?? 0;
    const base: V3Element = {
      id, type: "text",
      x: cx(300), y: sectionY + 80, width: 300, height: null,
      locked: false, visible: true, zIndex: elements.length,
      textAlign: "center", lineHeight: 1.3,
      fontWeight: "400", fontStyle: "normal",
      fontFamily: "Inter, system-ui, sans-serif",
      textShadow: "0 2px 10px rgba(0,0,0,0.55)",
      letterSpacing: 0, color: "#ffffff", content: "",
    };
    if (kind === "title") {
      Object.assign(base, { content: "Nuevo título", fontSize: 52, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#fff7ef", height: 70 });
    } else if (kind === "subtitle") {
      Object.assign(base, { content: "Subtítulo", fontSize: 24, fontFamily: "'Playfair Display', Georgia, serif", color: "#f8d9a0", height: 36 });
    } else {
      Object.assign(base, { content: "Escribe aquí tu mensaje...", fontSize: 15, color: "#e8e0cc", height: null });
    }
    setElements((prev) => [...prev, base]);
    setSelectedId(id);
    setActiveTool(null);
  };

  const addElement = (kind: string) => {
    const id = `shape-${Date.now()}`;
    const isLine = kind.toLowerCase().includes("línea") || kind.toLowerCase().includes("linea");
    const sectionY = activeSection?.y ?? 0;
    setElements((prev) => [...prev, {
      id, type: "decoration" as ElType,
      x: cx(200), y: sectionY + 80, width: 200, height: isLine ? 2 : 80,
      locked: false, visible: true, zIndex: prev.length,
      background: isLine
        ? "linear-gradient(90deg,transparent,#c8a96a,transparent)"
        : "rgba(255,255,255,0.08)",
      border: isLine ? undefined : "1px solid rgba(200,169,106,0.2)",
      borderRadius: isLine ? 0 : 16, opacity: 1,
    }]);
    setSelectedId(id);
    setActiveTool(null);
  };

  const addApp = (kind: string) => {
    const id = `app-${Date.now()}`;
    const appType = kind in APP_DEFAULTS ? kind as V3AppType : "rsvp";
    const defaults = APP_DEFAULTS[appType];
    const sectionY = activeSection?.y ?? 0;
    setElements((prev) => [...prev, {
      id, type: "app" as ElType,
      x: cx(defaults.width), y: sectionY + 80, width: defaults.width, height: defaults.height,
      locked: false, visible: true, zIndex: prev.length,
      appKind: appType,
      appType,
      content: defaults.content,
      background: defaults.background,
      color: defaults.color,
      border: defaults.border,
      borderRadius: defaults.borderRadius,
      opacity: 1,
      config: {
        url: defaults.url ?? "",
        primaryColor: defaults.background,
        textColor: defaults.color
      }
    }]);
    setSelectedId(id);
    setActiveTool(null);
  };

  const patchElement = (id: string, patch: Partial<V3Element>) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...patch } : el));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateElement = () => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    const newEl: V3Element = { ...el, id: `el-${Date.now()}`, x: el.x + 14, y: el.y + 14, zIndex: elements.length };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const bringToFront = () => {
    if (!selectedId) return;
    const maxZ = Math.max(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === selectedId ? { ...e, zIndex: maxZ + 1 } : e));
  };

  const sendToBack = () => {
    if (!selectedId) return;
    const minZ = Math.min(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === selectedId ? { ...e, zIndex: minZ - 1 } : e));
  };

  const deleteSection = (sectionId: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev; // never delete the last section
      return recalcSectionY(prev.filter((s) => s.id !== sectionId));
    });
    setSections((prev) => {
      if (activeSectionId === sectionId) {
        setActiveSectionId(prev[0]?.id ?? "");
      }
      return prev;
    });
    setSelectedId(null);
  };

  const duplicateSection = (sectionId: string) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx === -1) return prev;
      const orig = prev[idx];
      const copy: V3Section = { ...orig, id: `custom-${Date.now()}`, label: `${orig.label} (copia)` };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setActiveSectionId(copy.id);
      return recalcSectionY(next);
    });
    setSelectedId(null);
  };

  const moveSectionUp = (sectionId: string) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return recalcSectionY(next);
    });
  };

  const moveSectionDown = (sectionId: string) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return recalcSectionY(next);
    });
  };

  const addDemoSection = () => {
    const last = sections.at(-1);
    const next: V3Section = {
      id: `custom-${Date.now()}`,
      label: `Seccion ${sections.length + 1}`,
      y: last ? last.y + last.height : 0,
      height: 420,
      background: "linear-gradient(180deg,#17111c,#23122a)"
    };
    setSections((prev) => [...prev, next]);
    setActiveSectionId(next.id);
    window.setTimeout(() => scrollToSection(next), 0);
  };

  const applyTheme = (theme: CanvasV3Theme) => {
    setThemeId(theme.id);
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        background: theme.sectionBackgrounds[section.id] ?? section.background
      }))
    );
    setElements((prev) =>
      prev.map((element) => {
        if (element.type === "app") {
          const appType = normalizeAppType(element);
          return {
            ...element,
            background: appType === "rsvp" ? theme.buttonStyle.background : theme.colors.surface,
            color: appType === "rsvp" ? theme.buttonStyle.color : theme.colors.text,
            border: appType === "rsvp" ? theme.buttonStyle.border : `1px solid ${theme.colors.accent}55`,
            borderRadius: theme.buttonStyle.borderRadius,
            opacity: 1
          };
        }

        if (element.type === "decoration" || (element.type === "shape" && element.id !== "bg")) {
          return {
            ...element,
            background: element.height === 1 || element.height === 2
              ? `linear-gradient(90deg,transparent,${theme.colors.accent},transparent)`
              : theme.decorationStyle.background,
            border: theme.decorationStyle.border,
            borderRadius: theme.decorationStyle.borderRadius,
            opacity: theme.decorationStyle.opacity
          };
        }

        if (element.type === "text" || element.content) {
          return {
            ...element,
            ...getTextStyleForElement(element, theme)
          };
        }

        return element;
      })
    );
    setSaveStatus("idle");
    setSaved(false);
    setActiveTool(null);
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setSaveError(null);

    const result = await saveCanvasDesignV3(eventId, createV3Design(elements, sections, themeId));

    if (!result.ok) {
      setSaveStatus("error");
      setSaveError(result.error ?? "No se pudo guardar.");
      return;
    }

    setSaved(true);
    setSaveStatus("saved");
    setTimeout(() => {
      setSaved(false);
      setSaveStatus("idle");
    }, 2000);
  };

  // ── Viewport toggle: Móvil / Escritorio (solo visual, no afecta save) ────────
  const [viewportMode, setViewportMode] = useState<"mobile" | "desktop">("mobile");
  const canvasW = viewportMode === "desktop" ? 1000 : CANVAS_W;

  // ── Responsive: track viewport width to auto-manage inspector ──────────────
  const [vw, setVw] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1440);
  const [inspectorOpen, setInspectorOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1400 : true
  );

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setVw(w);
      if (w < 1400) setInspectorOpen(false);
      else setInspectorOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const ICON_SIDEBAR_W = 84;
  const STRUCTURE_PANEL_W = 168;
  const EXPANDED_PANEL_W = 260;
  // Inspector width: 320px on wide screens, 280px on laptop
  const INSPECTOR_W = vw >= 1600 ? 320 : 280;
  // On laptop and smaller screens inspector renders as overlay drawer
  const inspectorIsOverlay = vw < 1400;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  const countSectionElements = (section: V3Section) =>
    elements.filter((el) => el.y >= section.y && el.y < section.y + section.height).length;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", width: "100%", maxWidth: "100vw", minWidth: 0,
      background: "#0f0f17", overflow: "hidden",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* ── TOP BAR ── */}
      <div style={{
        height: 52, flexShrink: 0,
        background: "#16161f",
        borderBottom: "1px solid #2a2a3d",
        display: "flex", alignItems: "center",
        padding: "0 16px", gap: 10, zIndex: 50,
        minWidth: 0,
      }}>
        {/* Back */}
        <a
          href="../"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            color: "#9898b8", fontSize: 12, textDecoration: "none",
            padding: "5px 10px", borderRadius: 8, flexShrink: 0,
            border: "1px solid #2a2a3d", background: "#1e1e2d",
          }}
        >
          ← Volver
        </a>

        {/* Event name */}
        <div style={{
          flex: 1, textAlign: "center", minWidth: 0,
          color: "#c8c4f0", fontSize: 13, fontWeight: "600",
          letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {eventTitle} · Editor V3
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
            style={{ ...topBtnStyle, padding: "4px 8px", fontSize: 15 }}>−</button>
          <span style={{ color: "#8884a8", fontSize: 11, minWidth: 32, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
            style={{ ...topBtnStyle, padding: "4px 8px", fontSize: 15 }}>+</button>
        </div>

        {/* Viewport toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0, border: "1px solid #2a2a3d", borderRadius: 8, overflow: "hidden" }}>
          {(["mobile", "desktop"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewportMode(mode)}
              title={mode === "mobile" ? "Móvil 390px" : "Escritorio 1000px"}
              style={{
                padding: "5px 10px", fontSize: 13,
                background: viewportMode === mode ? "#2a1f4d" : "#1e1e2d",
                color: viewportMode === mode ? "#a78bfa" : "#8884a8",
                border: "none", cursor: "pointer",
                fontFamily: "Inter, system-ui, sans-serif",
                transition: "all 0.15s",
              }}
            >
              {mode === "mobile" ? "📱" : "🖥"}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button type="button" onClick={() => setPreview(!preview)} style={{ ...topBtnStyle, flexShrink: 0 }}>
          {preview ? "✎ Editar" : "👁 Preview"}
        </button>
        <button type="button" onClick={handleSave}
          disabled={saveStatus === "saving"}
          style={{ ...topBtnStyle, flexShrink: 0, background: saved ? "#1a3a1a" : saveStatus === "error" ? "#3a1a1a" : "#1e1e2d", color: saved ? "#4ade80" : saveStatus === "error" ? "#f87171" : "#c8c4f0", borderColor: saved ? "#4ade80" : saveStatus === "error" ? "#f87171" : "#2a2a3d", opacity: saveStatus === "saving" ? 0.75 : 1 }}>
          {saveStatus === "saving" ? "Guardando..." : saved ? "✓ Guardado" : saveStatus === "error" ? "Error" : "Guardar"}
        </button>
        {saveError && (
          <span
            title={saveError}
            style={{ color: "#fca5a5", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            ⚠ {saveError}
          </span>
        )}
        <button
          type="button"
          disabled={!eventSlug}
          onClick={() => eventSlug && window.open(`/evento/${eventSlug}/preview-v3`, "_blank")}
          title={eventSlug ? `Abrir /evento/${eventSlug}/preview-v3` : "Guardá el diseño primero"}
          style={{ ...topBtnStyle, flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff", borderColor: "transparent", opacity: eventSlug ? 1 : 0.5 }}
        >
          Publicar ↗
        </button>

        {/* Inspector toggle (always visible in top bar for small screens) */}
        {vw < 1400 && (
          <button
            type="button"
            title={inspectorOpen ? "Cerrar inspector" : "Propiedades"}
            onClick={() => setInspectorOpen(o => !o)}
            style={{
              ...topBtnStyle, flexShrink: 0,
              background: inspectorOpen ? "#2a1f4d" : "#1e1e2d",
              color: inspectorOpen ? "#a78bfa" : "#8884a8",
              borderColor: inspectorOpen ? "#7c3aed" : "#2a2a3d",
            }}
          >
            Propiedades
          </button>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0, position: "relative" }}>

        {/* -- LEFT SIDEBAR -- */}
        <div style={{
          width: ICON_SIDEBAR_W,
          minWidth: ICON_SIDEBAR_W,
          flexShrink: 0,
          background: "#16161f",
          borderRight: "1px solid #2a2a3d",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 8px",
          gap: 10,
          zIndex: 40,
          overflowY: "auto",
        }}>
          <p style={{ color: "#6f6b8f", fontSize: 8, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", margin: "0 0 2px", width: "100%" }}>
            Biblioteca
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center", width: "100%" }}>
            {TOOLS.filter((tool) => tool.id !== "projects").map((tool) => {
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(active ? null : tool.id)}
                  title={tool.label}
                  style={{
                    width: 64,
                    minHeight: 56,
                    borderRadius: 14,
                    background: active ? "linear-gradient(135deg,rgba(124,58,237,0.28),rgba(200,169,106,0.12))" : "#1b1b28",
                    border: active ? "1px solid #7c3aed" : "1px solid #2a2a3d",
                    cursor: "pointer",
                    color: active ? "#f4f1ff" : "#9b96bd",
                    fontSize: 18,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    boxShadow: active ? "0 8px 20px rgba(124,58,237,0.22)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{tool.icon}</span>
                  <span style={{ fontSize: 8, letterSpacing: "0.03em", lineHeight: 1.1 }}>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* -- STRUCTURE PANEL -- */}
        <div style={{
          width: STRUCTURE_PANEL_W,
          minWidth: STRUCTURE_PANEL_W,
          flexShrink: 0,
          background: "#14141f",
          borderRight: "1px solid #2a2a3d",
          padding: "12px 10px",
          overflowY: "auto",
          zIndex: 39,
        }}>
          <p style={{ color: "#8c86ad", fontSize: 10, fontWeight: 850, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
            Estructura
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sections.map((section) => {
              const active = section.id === activeSectionId;
              const count = countSectionElements(section);
              return (
                <button
                  key={section.id}
                  type="button"
                  title={section.label + " - " + count + " elementos"}
                  onClick={() => { scrollToSection(section); setSelectedId(null); }}
                  style={{
                    width: "100%",
                    minHeight: 76,
                    borderRadius: 14,
                    border: active ? "1px solid #c8a96a" : "1px solid #2a2a3d",
                    background: active ? "rgba(200,169,106,0.14)" : "#1b1b28",
                    color: active ? "#f4d28a" : "#b3aecf",
                    cursor: "pointer",
                    padding: 8,
                    display: "grid",
                    gridTemplateColumns: "52px 1fr",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: active ? "0 10px 24px rgba(200,169,106,0.12)" : "none",
                    fontFamily: "Inter, system-ui, sans-serif",
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    background: section.background,
                    border: "1px solid rgba(255,255,255,0.10)",
                    boxShadow: "inset 0 0 22px rgba(0,0,0,0.3)",
                  }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 800, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {section.label}
                    </span>
                    <span style={{ display: "block", marginTop: 5, fontSize: 10, color: active ? "#fff0c2" : "#6f6b8f" }}>
                      {count} elementos
                    </span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              title="Agregar seccion"
              onClick={addDemoSection}
              style={{
                width: "100%",
                minHeight: 44,
                borderRadius: 13,
                border: "1px dashed rgba(124,58,237,0.65)",
                background: "rgba(124,58,237,0.12)",
                color: "#c4b5fd",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.04em",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              + Agregar seccion
            </button>
          </div>
        </div>

        {/* ── EXPANDED PANEL ── */}
        {activeTool && (
          <div style={{
            width: EXPANDED_PANEL_W, maxWidth: EXPANDED_PANEL_W, minWidth: 0, flexShrink: 0,
            background: "#16161f",
            borderRight: "1px solid #2a2a3d",
            overflowY: "auto", zIndex: 40,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "14px 14px 10px", flexShrink: 0,
              borderBottom: "1px solid #2a2a3d",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "#e8e6ff", fontSize: 13, fontWeight: "600" }}>
                {TOOLS.find(t => t.id === activeTool)?.label}
              </span>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                style={{ background: "none", border: "none", color: "#8884a8", cursor: "pointer", fontSize: 14, padding: 0 }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ExpandedPanel
                tool={activeTool}
                onAddText={addText}
                onAddElement={addElement}
                onAddApp={addApp}
                onApplyTheme={applyTheme}
                activeThemeId={themeId}
              />
            </div>
          </div>
        )}

        {/* ── CANVAS AREA ── */}
        <div
          style={{
            flex: 1, minWidth: 0, overflow: "auto",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: vw < 1400 ? "24px 12px" : "36px 24px",
            background: "#111118",
          }}
          ref={scrollRef}
          onClick={() => setSelectedId(null)}
        >
          {/* Wrapper preserves natural canvas size before scaling */}
          <div style={{
            flexShrink: 0,
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}>
            {/* Canvas container */}
            <div
              ref={canvasRef}
              style={{
                position: "relative",
                width: canvasW,
                height: documentHeight,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px #2a2a3d",
              }}
            >
              {sections.map((section) => (
                <div
                  key={section.id}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: section.y,
                    width: canvasW,
                    height: section.height,
                    background: section.background,
                    zIndex: 0,
                    pointerEvents: "none",
                    borderTop: section.y === 0 ? undefined : "1px solid rgba(200,169,106,0.14)"
                  }}
                >
                  {!preview && (
                    <span style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.38)",
                      border: "1px solid rgba(200,169,106,0.22)",
                      color: "#c8a96a",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}>
                      {section.label}
                    </span>
                  )}
                </div>
              ))}
              {[...elements]
                .filter((el) => el.visible)
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((el) => (
                  <RenderElement
                    key={el.id}
                    el={el}
                    selected={el.id === selectedId && !preview}
                    onMouseDown={(e) => !preview && onMoveStart(e, el.id)}
                    onClick={(e) => !preview && (e.stopPropagation(), setSelectedId(el.id))}
                    onResizeMouseDown={(e, h) => !preview && onResizeStart(e, el.id, h)}
                  />
                ))}

              {preview && (
                <div style={{
                  position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.72)", borderRadius: 20, padding: "4px 14px",
                  color: "#c8a96a", fontSize: 10, letterSpacing: "0.12em", pointerEvents: "none",
                }}>
                  MODO PREVIEW
                </div>
              )}
            </div>

            <p style={{
              textAlign: "center", marginTop: 10,
              color: "#4a4a6a", fontSize: 10, letterSpacing: "0.08em",
              fontFamily: "Inter, system-ui, sans-serif",
            }}>
              {canvasW} × {documentHeight} px · {viewportMode === "desktop" ? "Desktop" : "Mobile"}
            </p>
          </div>
        </div>

        {/* ── RIGHT INSPECTOR — inline on ≥1400px, overlay drawer on laptop/mobile ── */}
        {inspectorOpen && inspectorIsOverlay && (
          /* Backdrop for drawer */
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 49,
              background: "rgba(0,0,0,0.45)",
            }}
            onClick={() => setInspectorOpen(false)}
          />
        )}

        {inspectorOpen && (
          <div style={{
            position: inspectorIsOverlay ? "absolute" : "relative",
            top: inspectorIsOverlay ? 0 : undefined,
            right: inspectorIsOverlay ? 0 : undefined,
            bottom: inspectorIsOverlay ? 0 : undefined,
            width: INSPECTOR_W,
            minWidth: INSPECTOR_W,
            height: "100%",
            flexShrink: 0, zIndex: 50,
            boxShadow: inspectorIsOverlay ? "-24px 0 60px rgba(0,0,0,0.45)" : undefined,
            transition: "width 0.2s",
          }}>
            <RightPanel
              element={selected && !preview ? selected : null}
              onChange={patchElement}
              onDuplicate={duplicateElement}
              onDelete={deleteSelected}
              onBringToFront={bringToFront}
              onSendToBack={sendToBack}
              section={!selected && !preview ? activeSection : null}
              onDuplicateSection={() => duplicateSection(activeSectionId)}
              onDeleteSection={() => deleteSection(activeSectionId)}
              onMoveSectionUp={() => moveSectionUp(activeSectionId)}
              onMoveSectionDown={() => moveSectionDown(activeSectionId)}
            />
          </div>
        )}

        {/* Floating toggle when inspector is closed (≥1400px) */}
        {!inspectorOpen && !inspectorIsOverlay && (
          <button
            type="button"
            title="Abrir propiedades"
            onClick={() => setInspectorOpen(true)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              zIndex: 45, width: 28, height: 64, borderRadius: 8,
              background: "#1e1e2d", border: "1px solid #2a2a3d",
              cursor: "pointer", color: "#8884a8", fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              writingMode: "vertical-rl",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#a78bfa"; e.currentTarget.style.borderColor = "#7c3aed"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8884a8"; e.currentTarget.style.borderColor = "#2a2a3d"; }}
          >
            Props
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Shared button style

// ────────────────────────────────────────────────────────────────────────────────
// Shared button style
// ────────────────────────────────────────────────────────────────────────────────

const topBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  background: "#1e1e2d",
  border: "1px solid #2a2a3d",
  borderRadius: 8,
  cursor: "pointer",
  color: "#c8c4f0",
  fontSize: 12,
  fontFamily: "Inter, system-ui, sans-serif",
  whiteSpace: "nowrap",
  transition: "all 0.15s",
};
