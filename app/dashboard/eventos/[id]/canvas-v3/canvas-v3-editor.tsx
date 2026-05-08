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
  groupId?: string;
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
    countdownTarget?: string;
    countdownMode?: "event" | "custom";
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

type HistoryEntry = { elements: V3Element[]; sections: V3Section[] };
const MAX_HISTORY = 50;

type ToolId =
  | "templates"
  | "elements"
  | "text"
  | "uploaded"
  | "apps"
  | "projects";

type InvitationBlockKind = "date" | "countdown" | "location" | "dresscode" | "message";

type PremiumTemplate = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  description: string;
  themeId: CanvasV3Theme["id"];
  previewGradient: string;
  create: () => { sections: V3Section[]; elements: V3Element[] };
};

type InspectorGroup =
  | "content"
  | "typography"
  | "fill"
  | "stroke"
  | "shadow"
  | "spacing"
  | "action"
  | "visibility"
  | "layers";

type SnapLine = {
  id: string;
  type: "vertical" | "horizontal";
  position: number;
  start: number;
  end: number;
  label?: string;
};

type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants & initial design
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 390;
const HERO_H = 844;

const cx = (w: number) => Math.round((CANVAS_W - w) / 2);

const DEFAULT_SECTION_TEMPLATES: Omit<V3Section, "y">[] = [
  { id: "hero", label: "Portada", height: 844, background: "linear-gradient(180deg,#1a0a18 0%,#3d1535 45%,#180a14 100%)" },
  { id: "countdown", label: "Cuenta regresiva", height: 420, background: "linear-gradient(180deg,#180a14,#211129)" },
  { id: "presentation", label: "Presentación", height: 560, background: "linear-gradient(180deg,#211129,#160f1f)" },
  { id: "messages", label: "Mensajes", height: 640, background: "linear-gradient(180deg,#160f1f,#241125)" },
  { id: "details", label: "Detalles", height: 620, background: "linear-gradient(180deg,#241125,#18121f)" },
  { id: "church", label: "Iglesia", height: 520, background: "linear-gradient(180deg,#18121f,#20101c)" },
  { id: "dresscode", label: "Vestimenta", height: 460, background: "linear-gradient(180deg,#20101c,#17111c)" },
  { id: "rsvp", label: "Confirmación", height: 560, background: "linear-gradient(180deg,#17111c,#241225)" },
  { id: "footer", label: "Cierre", height: 280, background: "linear-gradient(180deg,#241225,#0f0f17)" }
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
    content: "Sábado · 14 de junio, 2025 · 20:00 hs",
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
  { id: "text", icon: "Tx", label: "Texto" },
  { id: "uploaded", icon: "↑", label: "Subidos" },
  { id: "apps", icon: "⚡", label: "Aplicaciones" },
  { id: "projects", icon: "◻", label: "Proyectos" },
];

// ─────────────────────────────────────────────────────────────────────────────
// App block renderer
// ─────────────────────────────────────────────────────────────────────────────

const APP_LABELS: Record<string, { label: string; icon: string }> = {
  rsvp: { label: "Confirmar asistencia", icon: "✓" },
  countdown: { label: "Cuenta regresiva: 45 DÍAS  12 HRS  08 MIN", icon: "⏱" },
  whatsapp: { label: "Mensaje por WhatsApp", icon: "💬" },
  album: { label: "Álbum en vivo", icon: "📸" },
  live: { label: "Pantalla en vivo", icon: "🖥" },
  maps: { label: "Ver en Google Maps", icon: "📍" },
  qr: { label: "Código QR", icon: "▦" },
};

const APP_DEMO_LABELS: Record<string, { label: string; icon: string }> = {
  rsvp: { label: "Confirmar asistencia", icon: "✓" },
  countdown: { label: "Cuenta regresiva", icon: "⏱" },
  whatsapp: { label: "Enviar WhatsApp", icon: "✉" },
  maps: { label: "Ver ubicación", icon: "⌖" },
  "live-album": { label: "Álbum en vivo", icon: "▧" },
  "live-screen": { label: "Pantalla en vivo", icon: "▣" },
  qr: { label: "QR", icon: "▦" },
  album: { label: "Álbum en vivo", icon: "▧" },
  live: { label: "Pantalla en vivo", icon: "▣" }
};

const APP_BLOCKS: { id: V3AppType; icon: string; label: string }[] = [
  { id: "rsvp", icon: "✓", label: "Confirmar asistencia" },
  { id: "whatsapp", icon: "✉", label: "WhatsApp" },
  { id: "countdown", icon: "⏱", label: "Cuenta regresiva" },
  { id: "maps", icon: "⌖", label: "Ver ubicación" },
  { id: "live-album", icon: "▧", label: "Álbum en vivo" },
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
  countdown: { content: "45 DÍAS · 12 HRS · 08 MIN · 30 SEG", width: 340, height: 96, background: "rgba(124,58,237,0.18)", color: "#e8e6ff", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 16 },
  maps: { content: "Ver ubicación", width: 320, height: 78, background: "rgba(200,169,106,0.16)", color: "#f4d28a", border: "1px solid rgba(200,169,106,0.36)", borderRadius: 16, url: "https://maps.google.com" },
  "live-album": { content: "Álbum en vivo", width: 320, height: 88, background: "rgba(255,255,255,0.08)", color: "#fff7ef", border: "1px solid rgba(200,169,106,0.26)", borderRadius: 18 },
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
  highlighted,
  onMouseDown,
  onClick,
  onResizeMouseDown,
}: {
  el: V3Element;
  selected: boolean;
  highlighted?: boolean; // true when part of a multi-selection (no handles, just outline)
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
    cursor: el.locked ? "default" : (selected || highlighted) ? "grab" : "pointer",
    userSelect: "none",
    overflow: (selected || highlighted) ? "visible" : "hidden",
    boxShadow: highlighted && !selected ? "inset 0 0 0 2px rgba(124,58,237,0.65)" : undefined,
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

  const handleSize = 10;
  const handles = ["tl", "t", "tr", "r", "br", "b", "bl", "l"];
  const handlePositions: Record<string, React.CSSProperties> = {
    tl: { top: -handleSize / 2, left: -handleSize / 2,                        cursor: "nwse-resize" },
    t:  { top: -handleSize / 2, left: "50%", marginLeft: -handleSize / 2,     cursor: "ns-resize"   },
    tr: { top: -handleSize / 2, right: -handleSize / 2,                       cursor: "nesw-resize" },
    r:  { top: "50%", right: -handleSize / 2, marginTop: -handleSize / 2,     cursor: "ew-resize"   },
    br: { bottom: -handleSize / 2, right: -handleSize / 2,                    cursor: "nwse-resize" },
    b:  { bottom: -handleSize / 2, left: "50%", marginLeft: -handleSize / 2,  cursor: "ns-resize"   },
    bl: { bottom: -handleSize / 2, left: -handleSize / 2,                     cursor: "nesw-resize" },
    l:  { top: "50%", left: -handleSize / 2, marginTop: -handleSize / 2,      cursor: "ew-resize"   },
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

      {/* Resize handles — Canva-style */}
      {selected && !el.locked && handles.map((h) => (
        <div
          key={h}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeMouseDown(e, h); }}
          onMouseEnter={(e) => {
            const d = e.currentTarget as HTMLDivElement;
            d.style.transform = "scale(1.4)";
            d.style.background = "#ede9fe";
          }}
          onMouseLeave={(e) => {
            const d = e.currentTarget as HTMLDivElement;
            d.style.transform = "scale(1)";
            d.style.background = "#ffffff";
          }}
          style={{
            position: "absolute",
            width: handleSize,
            height: handleSize,
            background: "#ffffff",
            border: "2px solid #7c3aed",
            borderRadius: 3,
            boxShadow: "0 1px 4px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,58,237,0.15)",
            zIndex: 9999,
            transition: "transform 0.1s, background 0.1s",
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
// Premium templates
// ─────────────────────────────────────────────────────────────────────────────

const PREMIUM_TEMPLATES: PremiumTemplate[] = [
  {
    id: "glam-rosa",
    label: "Glam Rosa",
    emoji: "🌸",
    category: "Quinceaños",
    description: "Elegante, femenino y moderno. Paleta rosa, lavanda y champagne dorado.",
    themeId: "floral-rose",
    previewGradient: "linear-gradient(135deg,#2d0a2e 0%,#1a0518 50%,#200a1e 100%)",
    create: () => {
      const stamp = Date.now();
      let zCounter = 1;
      const z = () => zCounter++;
      const mkId = (name: string) => `gr-${name}-${stamp}`;
      const W = 390;
      const cx = (w: number) => Math.round((W - w) / 2);

      // Palette
      const PINK = "#f472b6";
      const LAVENDER = "#c084fc";
      const GOLD = "#f4d28a";
      const ROSE = "#fda4af";
      const WHITE = "#fff7ef";
      const GLASS_PINK = "rgba(244,114,182,0.09)";

      const mkShape = (name: string, x: number, y: number, w: number, h: number, bg: string, extra: Partial<V3Element> = {}): V3Element => ({
        id: mkId(name), type: "shape" as ElType,
        x, y, width: w, height: h,
        locked: false, visible: true, zIndex: z(),
        background: bg, opacity: 1, borderRadius: 0, ...extra,
      });
      const mkText = (name: string, content: string, x: number, y: number, w: number, h: number | null, extra: Partial<V3Element> = {}): V3Element => ({
        id: mkId(name), type: "text" as ElType,
        x, y, width: w, height: h,
        locked: false, visible: true, zIndex: z(),
        content, fontSize: 14, fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: "500", color: WHITE, textAlign: "center",
        lineHeight: 1.35, letterSpacing: 0,
        textShadow: "0 2px 16px rgba(0,0,0,0.55)", ...extra,
      });
      const mkApp = (name: string, appType: V3AppType, content: string, x: number, y: number, w: number, h: number, extra: Partial<V3Element> = {}): V3Element => ({
        id: mkId(name), type: "app" as ElType,
        x, y, width: w, height: h,
        locked: false, visible: true, zIndex: z(),
        appKind: appType, appType, content,
        background: `linear-gradient(135deg,${PINK},#c026d3)`,
        color: "#fff", borderRadius: 20, opacity: 1,
        config: { url: "", primaryColor: PINK, textColor: "#fff", countdownMode: "event" as const },
        ...extra,
      });

      // ── SECTIONS ──────────────────────────────────────────────────────────
      const sections: V3Section[] = [
        { id: mkId("s1"), label: "Portada",            y: 0,    height: 780, background: "linear-gradient(180deg,#1a0518 0%,#2d0a2e 55%,#12060f 100%)" },
        { id: mkId("s2"), label: "Cuenta regresiva",   y: 780,  height: 400, background: "linear-gradient(180deg,#12060f,#1a0518)" },
        { id: mkId("s3"), label: "Presentación",        y: 1180, height: 540, background: "linear-gradient(180deg,#1a0518,#200a1e,#1a0518)" },
        { id: mkId("s4"), label: "Mensaje especial",   y: 1720, height: 480, background: "linear-gradient(180deg,#12060f,#1a0518)" },
        { id: mkId("s5"), label: "Dress code",         y: 2200, height: 440, background: "linear-gradient(180deg,#1a0518,#2d0a2e 50%,#1a0518)" },
        { id: mkId("s6"), label: "Ubicación",          y: 2640, height: 480, background: "linear-gradient(180deg,#12060f,#200a1e,#12060f)" },
        { id: mkId("s7"), label: "RSVP",               y: 3120, height: 400, background: "linear-gradient(180deg,#1a0518,#2d0a2e)" },
        { id: mkId("s8"), label: "Cierre",             y: 3520, height: 440, background: "linear-gradient(180deg,#2d0a2e 0%,#12060f 60%,#1a0518 100%)" },
      ];

      const els: V3Element[] = [];

      // ── S1 — PORTADA (y=0, h=780) ─────────────────────────────────────────
      els.push(mkShape("s1-glow-t",  0, 0,   390, 320, "radial-gradient(ellipse at 50% 0%,rgba(244,114,182,0.30) 0%,transparent 70%)"));
      els.push(mkShape("s1-glow-b",  0, 480, 390, 300, "radial-gradient(ellipse at 50% 100%,rgba(192,132,252,0.26) 0%,transparent 70%)"));
      els.push(mkText("s1-mis",   "MIS",      cx(60),  96,  60,  20,  { fontSize: 13, fontWeight: "900", letterSpacing: 0.38, color: GOLD, textShadow: "none" }));
      els.push(mkText("s1-15",    "15",       cx(130), 108, 130, 104, { fontSize: 90, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", fontWeight: "700", color: PINK, lineHeight: 1, textShadow: `0 0 60px ${PINK}77,0 4px 24px rgba(0,0,0,0.7)` }));
      els.push(mkShape("s1-div1", cx(200), 224, 200, 1, `linear-gradient(90deg,transparent,${GOLD},transparent)`));
      els.push(mkText("s1-name",  "VALENTINA",  cx(280), 238, 280, 46, { fontSize: 34, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, letterSpacing: 0.02, lineHeight: 1.1 }));
      els.push(mkText("s1-last",  "MARÍA GARCÍA", cx(240), 286, 240, 20, { fontSize: 11, fontWeight: "900", letterSpacing: 0.25, color: ROSE, textShadow: "none" }));
      els.push(mkShape("s1-div2", cx(100), 318, 100, 1, `linear-gradient(90deg,transparent,${GOLD}88,transparent)`));
      els.push(mkText("s1-date",  "14 · JUNIO · 2026", cx(220), 332, 220, 20, { fontSize: 11, fontWeight: "800", letterSpacing: 0.18, color: GOLD, textShadow: "none" }));
      els.push(mkText("s1-q15",   "Quinceaños",  cx(160), 362, 160, 22, { fontSize: 13, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: LAVENDER, textShadow: "none" }));
      els.push(mkText("s1-spkL",  "✦", 22,  196, 20, 20, { fontSize: 11, color: GOLD, opacity: 0.55, textShadow: "none" }));
      els.push(mkText("s1-spkR",  "✦", 348, 238, 20, 20, { fontSize: 9,  color: ROSE, opacity: 0.45, textShadow: "none" }));
      els.push(mkShape("s1-card", cx(320), 452, 320, 86, GLASS_PINK, { borderRadius: 20, border: `1px solid rgba(244,114,182,0.22)` }));
      els.push(mkText("s1-inv1",  "Te invito a celebrar", cx(240), 468, 240, 18, { fontSize: 11, color: ROSE, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", textShadow: "none" }));
      els.push(mkText("s1-inv2",  "mis quince años", cx(200), 490, 200, 22, { fontSize: 15, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, letterSpacing: 0.04 }));
      els.push(mkText("s1-scroll","↓", cx(24), 718, 24, 24, { fontSize: 16, color: "rgba(253,164,175,0.35)", textShadow: "none" }));

      // ── S2 — COUNTDOWN (y=780, h=400) ─────────────────────────────────────
      const s2 = 780;
      els.push(mkShape("s2-glow",  0, s2+80,  390, 240, "radial-gradient(ellipse at 50% 50%,rgba(192,132,252,0.24) 0%,transparent 70%)"));
      els.push(mkText("s2-lbl",   "FALTA POCO", cx(200), s2+38, 200, 18, { fontSize: 10, fontWeight: "900", letterSpacing: 0.28, color: GOLD, textShadow: "none" }));
      els.push(mkShape("s2-card", cx(332), s2+66, 332, 148, "linear-gradient(135deg,rgba(192,132,252,0.13),rgba(244,114,182,0.09))", { borderRadius: 22, border: `1px solid rgba(192,132,252,0.28)` }));
      els.push(mkApp("s2-cnt",   "countdown", "", cx(300), s2+94, 300, 64, { background: "transparent", color: WHITE, borderRadius: 0, config: { url: "", primaryColor: "transparent", textColor: WHITE, countdownMode: "event" as const } }));
      els.push(mkText("s2-cap",   "para celebrar juntos", cx(240), s2+228, 240, 18, { fontSize: 13, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: ROSE, textShadow: "none" }));
      els.push(mkText("s2-spk",   "✦  ·  ✦  ·  ✦", cx(140), s2+256, 140, 16, { fontSize: 10, color: GOLD, opacity: 0.45, letterSpacing: 0.1, textShadow: "none" }));
      els.push(mkText("s2-dconf", "14 de Junio · 2026 · 20:00 hs", cx(290), s2+284, 290, 20, { fontSize: 11, color: "rgba(253,164,175,0.65)", letterSpacing: 0.11, textShadow: "none" }));

      // ── S3 — PRESENTACIÓN (y=1180, h=540) ─────────────────────────────────
      const s3 = 1180;
      els.push(mkShape("s3-glow",  0, s3,   390, 540, "radial-gradient(ellipse at 50% 35%,rgba(244,114,182,0.17) 0%,transparent 62%)"));
      els.push(mkText("s3-eye",   "LA FESTEJADA", cx(180), s3+38, 180, 18, { fontSize: 9, fontWeight: "900", letterSpacing: 0.32, color: GOLD, textShadow: "none" }));
      els.push(mkShape("s3-div1", cx(200), s3+63, 200, 1, `linear-gradient(90deg,transparent,${GOLD}66,transparent)`));
      els.push(mkText("s3-nm1",   "Valentina María", cx(300), s3+78, 300, 52, { fontSize: 42, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, lineHeight: 1.1, textShadow: `0 2px 24px rgba(244,114,182,0.38)` }));
      els.push(mkText("s3-nm2",   "García", cx(180), s3+133, 180, 36, { fontSize: 30, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: ROSE, lineHeight: 1 }));
      els.push(mkShape("s3-div2", cx(160), s3+180, 160, 1, `linear-gradient(90deg,transparent,${GOLD}66,transparent)`));
      els.push(mkText("s3-hija",  "Hija de", cx(100), s3+198, 100, 18, { fontSize: 11, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: "rgba(253,164,175,0.7)", textShadow: "none" }));
      els.push(mkText("s3-prnt",  "Patricia & Roberto García", cx(280), s3+224, 280, 22, { fontSize: 14, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: GOLD, textShadow: "none" }));
      els.push(mkShape("s3-card", cx(320), s3+264, 320, 86, GLASS_PINK, { borderRadius: 18, border: `1px solid rgba(244,114,182,0.18)` }));
      els.push(mkText("s3-verse", "Hoy cumplo quince años\ny quiero compartirlos contigo", cx(280), s3+278, 280, null, { fontSize: 13, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, lineHeight: 1.55, textShadow: "none" }));
      els.push(mkText("s3-big15", "15", cx(110), s3+394, 110, 88, { fontSize: 80, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: "rgba(244,114,182,0.10)", lineHeight: 1, textShadow: "none" }));

      // ── S4 — MENSAJE ESPECIAL (y=1720, h=480) ─────────────────────────────
      const s4 = 1720;
      els.push(mkShape("s4-glow",  60, s4+80, 270, 300, "radial-gradient(ellipse at 50% 50%,rgba(192,132,252,0.20) 0%,transparent 70%)"));
      els.push(mkText("s4-eye",   "MENSAJE ESPECIAL", cx(200), s4+38, 200, 16, { fontSize: 9, fontWeight: "900", letterSpacing: 0.30, color: GOLD, textShadow: "none" }));
      els.push(mkShape("s4-card", cx(332), s4+62, 332, 246, "linear-gradient(135deg,rgba(244,114,182,0.08),rgba(192,132,252,0.07))", { borderRadius: 22, border: `1px solid rgba(244,114,182,0.18)` }));
      els.push(mkText("s4-qq",    "“", 50, s4+70, 40, 50, { fontSize: 54, fontFamily: "'Playfair Display',Georgia,serif", color: PINK, opacity: 0.65, lineHeight: 0.9, textShadow: "none" }));
      els.push(mkText("s4-msg",   "Este momento es mágico\ny único. Gracias por acompañarme\nen el inicio de esta nueva etapa.", cx(280), s4+118, 280, null, { fontSize: 15, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, lineHeight: 1.58, textShadow: "none" }));
      els.push(mkText("s4-sig",   "Con amor, Valentina ♡", cx(220), s4+282, 220, 20, { fontSize: 11, fontWeight: "800", color: GOLD, letterSpacing: 0.14, textShadow: "none" }));
      els.push(mkText("s4-spk",   "✦  ·  ✦  ·  ✦", cx(140), s4+328, 140, 16, { fontSize: 10, color: LAVENDER, opacity: 0.42, textShadow: "none" }));

      // ── S5 — DRESS CODE (y=2200, h=440) ───────────────────────────────────
      const s5 = 2200;
      els.push(mkShape("s5-glow",  0, s5,   390, 440, "radial-gradient(ellipse at 50% 30%,rgba(244,114,182,0.19) 0%,transparent 60%)"));
      els.push(mkText("s5-eye",   "CÓDIGO DE VESTIMENTA", cx(260), s5+38, 260, 16, { fontSize: 9, fontWeight: "900", letterSpacing: 0.26, color: GOLD, textShadow: "none" }));
      els.push(mkShape("s5-div",  cx(200), s5+62, 200, 1, `linear-gradient(90deg,transparent,${GOLD}66,transparent)`));
      els.push(mkText("s5-sty",   "Formal Elegante", cx(280), s5+78, 280, 40, { fontSize: 33, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, lineHeight: 1.1 }));
      els.push(mkText("s5-hint",  "Paleta sugerida: rosa, lavanda y champagne.\nEvitar blanco y negro total.", cx(290), s5+126, 290, null, { fontSize: 12, color: "rgba(253,164,175,0.78)", fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1.5, textShadow: "none" }));
      const sw = s5+194; const sX = cx(144);
      els.push(mkShape("s5-sw1",  sX,    sw, 40, 40, "#f9a8d4", { borderRadius: 999, border: "2px solid rgba(255,255,255,0.28)" }));
      els.push(mkShape("s5-sw2",  sX+52, sw, 40, 40, "#c084fc", { borderRadius: 999, border: "2px solid rgba(255,255,255,0.20)" }));
      els.push(mkShape("s5-sw3",  sX+104,sw, 40, 40, "#f4d28a", { borderRadius: 999, border: "2px solid rgba(255,255,255,0.20)" }));
      els.push(mkText("s5-swlbl", "Rosa · Lavanda · Champagne", cx(270), sw+50, 270, 16, { fontSize: 10, color: "rgba(253,164,175,0.60)", letterSpacing: 0.08, textShadow: "none" }));

      // ── S6 — UBICACIÓN (y=2640, h=480) ────────────────────────────────────
      const s6 = 2640;
      els.push(mkShape("s6-glow",  0, s6+100, 390, 280, "radial-gradient(ellipse at 50% 50%,rgba(244,114,182,0.19) 0%,transparent 65%)"));
      els.push(mkText("s6-eye",   "¿DÓNDE NOS ENCONTRAMOS?", cx(300), s6+38, 300, 16, { fontSize: 9, fontWeight: "900", letterSpacing: 0.20, color: GOLD, textShadow: "none" }));
      els.push(mkShape("s6-div1", cx(180), s6+62, 180, 1, `linear-gradient(90deg,transparent,${GOLD}66,transparent)`));
      els.push(mkText("s6-ico",   "⌖", cx(36), s6+76, 36, 40, { fontSize: 26, color: PINK, textShadow: "none" }));
      els.push(mkText("s6-ven",   "Salón de Eventos", cx(290), s6+118, 290, 34, { fontSize: 28, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE, lineHeight: 1.1 }));
      els.push(mkText("s6-adr",   "Av. Principal 123 · Ciudad", cx(280), s6+158, 280, 22, { fontSize: 12, color: ROSE, lineHeight: 1.4, textShadow: "none" }));
      els.push(mkText("s6-dt",    "Viernes 14 de Junio 2026 · 20:00 hs", cx(310), s6+188, 310, 20, { fontSize: 11, fontWeight: "700", color: GOLD, letterSpacing: 0.09, textShadow: "none" }));
      els.push(mkShape("s6-div2", cx(160), s6+218, 160, 1, `linear-gradient(90deg,transparent,${GOLD}44,transparent)`));
      els.push(mkApp("s6-map",   "maps", "Ver en el mapa", cx(240), s6+240, 240, 52, {
        background: "linear-gradient(135deg,rgba(244,114,182,0.20),rgba(192,132,252,0.20))",
        color: WHITE, borderRadius: 18,
        border: `1px solid rgba(244,114,182,0.44)`,
        config: { url: "https://maps.google.com", primaryColor: "#f472b6", textColor: WHITE, countdownMode: "event" as const },
      }));
      els.push(mkText("s6-note",  "Te esperamos puntual ♡", cx(220), s6+312, 220, 18, { fontSize: 11, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: "rgba(253,164,175,0.55)", textShadow: "none" }));

      // ── S7 — RSVP (y=3120, h=400) ─────────────────────────────────────────
      const s7 = 3120;
      els.push(mkShape("s7-glow",  0, s7,   390, 400, "radial-gradient(ellipse at 50% 55%,rgba(192,132,252,0.27) 0%,transparent 65%)"));
      els.push(mkText("s7-eye",   "CONFIRMÁ TU ASISTENCIA", cx(280), s7+38, 280, 16, { fontSize: 9, fontWeight: "900", letterSpacing: 0.22, color: GOLD, textShadow: "none" }));
      els.push(mkShape("s7-div",  cx(180), s7+62, 180, 1, `linear-gradient(90deg,transparent,${GOLD}66,transparent)`));
      els.push(mkText("s7-dl",    "Antes del 1 de Junio", cx(240), s7+78, 240, 20, { fontSize: 13, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: WHITE, textShadow: "none" }));
      els.push(mkApp("s7-rsvp",  "rsvp", "CONFIRMAR ASISTENCIA", cx(300), s7+114, 300, 58, {
        background: `linear-gradient(135deg,${PINK},#db2777)`,
        color: "#fff", borderRadius: 20,
        config: { url: "", primaryColor: PINK, textColor: "#fff", countdownMode: "event" as const },
      }));
      els.push(mkText("s7-or",    "— o escribinos por —", cx(220), s7+192, 220, 18, { fontSize: 11, color: "rgba(253,164,175,0.48)", fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", textShadow: "none" }));
      els.push(mkApp("s7-wa",    "whatsapp", "WhatsApp", cx(200), s7+220, 200, 48, {
        background: "rgba(37,211,102,0.16)",
        color: "#4ade80", borderRadius: 18,
        border: "1px solid rgba(37,211,102,0.34)",
        config: { url: "https://wa.me/", primaryColor: "#25d366", textColor: "#4ade80", countdownMode: "event" as const },
      }));
      els.push(mkText("s7-seats", "¡Los lugares son limitados!", cx(260), s7+292, 260, 18, { fontSize: 11, color: LAVENDER, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", textShadow: "none" }));

      // ── S8 — CIERRE (y=3520, h=440) ───────────────────────────────────────
      const s8 = 3520;
      els.push(mkShape("s8-glT",  0, s8,     390, 200, "radial-gradient(ellipse at 50% 0%,rgba(244,114,182,0.27) 0%,transparent 65%)"));
      els.push(mkShape("s8-glB",  0, s8+260, 390, 180, "radial-gradient(ellipse at 50% 100%,rgba(192,132,252,0.22) 0%,transparent 65%)"));
      els.push(mkShape("s8-divT", cx(280), s8+38, 280, 1, `linear-gradient(90deg,transparent,${GOLD}44,transparent)`));
      els.push(mkText("s8-spkB",  "✦", cx(28), s8+52, 28, 32, { fontSize: 22, color: PINK, opacity: 0.65, textShadow: `0 0 18px ${PINK}55`, fontFamily: "'Playfair Display',Georgia,serif" }));
      els.push(mkText("s8-ty",    "¡Nos vemos pronto!", cx(280), s8+98,  280, 36, { fontSize: 30, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: WHITE }));
      els.push(mkText("s8-nm",    "Valentina ♡", cx(200), s8+146, 200, 28, { fontSize: 22, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: ROSE }));
      els.push(mkShape("s8-divM", cx(200), s8+188, 200, 1, `linear-gradient(90deg,transparent,${GOLD}66,transparent)`));
      els.push(mkText("s8-big15", "15", cx(110), s8+208, 110, 92, { fontSize: 82, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: "rgba(244,114,182,0.10)", lineHeight: 1, textShadow: "none" }));
      els.push(mkText("s8-spkR",  "✦  ·  ✦  ·  ✦", cx(140), s8+328, 140, 16, { fontSize: 10, color: GOLD, opacity: 0.38, textShadow: "none" }));
      els.push(mkText("s8-foot",  "Creado con KAIS Invitaciones", cx(240), s8+358, 240, 16, { fontSize: 9, color: "rgba(253,164,175,0.22)", letterSpacing: 0.08, textShadow: "none" }));

      return { sections, elements: els };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Expanded panel content per tool
// ─────────────────────────────────────────────────────────────────────────────

function ExpandedPanel({
  tool,
  onAddText,
  onAddElement,
  onAddApp,
  onAddInvitationBlock,
  onApplyTheme,
  activeThemeId,
  onApplyPremiumTemplate,
}: {
  tool: ToolId;
  onAddText: (kind: "title" | "subtitle" | "paragraph") => void;
  onAddElement: (kind: string) => void;
  onAddApp: (kind: string) => void;
  onAddInvitationBlock: (kind: InvitationBlockKind) => void;
  onApplyTheme: (theme: CanvasV3Theme) => void;
  activeThemeId: string;
  onApplyPremiumTemplate: (id: string) => void;
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
    const invitationBlocks: { id: InvitationBlockKind; icon: string; label: string; description: string }[] = [
      { id: "date", icon: "◇", label: "Fecha", description: "Día, mes, año y hora" },
      { id: "countdown", icon: "⏱", label: "Cuenta regresiva", description: "Días, horas y minutos" },
      { id: "location", icon: "⌖", label: "Ubicación", description: "Lugar, dirección y mapa" },
      { id: "dresscode", icon: "◐", label: "Vestimenta", description: "Tenida y paleta de colores" },
      { id: "message", icon: "❞", label: "Mensaje", description: "Frase elegante para invitados" },
    ];
    const cats = [
      { label: "Formas", items: ["Rectángulo", "Círculo", "Línea"] },
      { label: "Flores", items: ["Rosa", "Flor 1", "Flor 2"] },
      { label: "Brillos", items: ["Destello", "Resplandor", "Polvo"] },
      { label: "Separadores", items: ["Línea dorada", "Ola", "Puntos"] },
      { label: "Botones", items: ["Primario", "Contorno", "Sutil"] },
    ];
    return (
      <div style={{ padding: "12px 14px", overflowY: "auto", maxHeight: "calc(100vh - 56px)" }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "#c8a96a", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 800 }}>
            Bloques de invitación
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {invitationBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => onAddInvitationBlock(block.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1fr",
                  gap: 10,
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 12px",
                  background: "linear-gradient(135deg,rgba(124,58,237,0.16),rgba(200,169,106,0.08))",
                  border: "1px solid rgba(200,169,106,0.24)",
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(200,169,106,0.55)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(200,169,106,0.24)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(200,169,106,0.14)", color: "#f4d28a", fontSize: 15 }}>
                  {block.icon}
                </span>
                <span>
                  <span style={{ display: "block", color: "#e8e6ff", fontSize: 12, fontWeight: 800, fontFamily: "Inter, system-ui, sans-serif" }}>
                    {block.label}
                  </span>
                  <span style={{ display: "block", marginTop: 2, color: "#8884a8", fontSize: 10, lineHeight: 1.25, fontFamily: "Inter, system-ui, sans-serif" }}>
                    {block.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
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
        {/* ── Premium templates ── */}
        <p style={{ color: "#f472b6", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontWeight: 800 }}>
          ✦ Plantillas premium
        </p>
        {PREMIUM_TEMPLATES.map((tpl) => (
          <div key={tpl.id} style={{ marginBottom: 12, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(244,114,182,0.32)" }}>
            {/* Preview swatch */}
            <div style={{ height: 56, background: tpl.previewGradient, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 22 }}>{tpl.emoji}</span>
              <span style={{ position: "absolute", top: 6, right: 8, fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", color: "rgba(244,114,182,0.8)", textTransform: "uppercase" }}>
                {tpl.category}
              </span>
            </div>
            <div style={{ padding: "10px 11px 11px", background: "rgba(244,114,182,0.06)" }}>
              <p style={{ color: "#fff7ef", fontSize: 13, fontWeight: 700, margin: "0 0 4px", fontFamily: "Inter, system-ui, sans-serif" }}>
                {tpl.label}
              </p>
              <p style={{ color: "#c084fc", fontSize: 10, lineHeight: 1.4, margin: "0 0 10px", fontFamily: "Inter, system-ui, sans-serif" }}>
                {tpl.description}
              </p>
              <button
                type="button"
                onClick={() => onApplyPremiumTemplate(tpl.id)}
                style={{
                  width: "100%", padding: "9px 10px", borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg,#f472b6,#c026d3)",
                  color: "#fff", cursor: "pointer",
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                  boxShadow: "0 4px 16px rgba(244,114,182,0.38)",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                Generar invitación completa →
              </button>
            </div>
          </div>
        ))}

        {/* ── Theme palettes ── */}
        <p style={{ color: "#8884a8", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "18px 0 10px" }}>
          Paletas de color
        </p>
        {CANVAS_V3_THEMES.map((theme) => (
          <div
            key={theme.id}
            style={{
              marginBottom: 10, padding: 10,
              background: activeThemeId === theme.id ? "rgba(124,58,237,0.18)" : "#1e1e2d",
              border: activeThemeId === theme.id ? "1px solid #7c3aed" : "1px solid #2a2a3d",
              borderRadius: 12
            }}
          >
            <div style={{ height: 48, borderRadius: 10, marginBottom: 9, background: theme.sectionBackgrounds.hero, boxShadow: `inset 0 0 0 1px ${theme.colors.accent}44` }} />
            <p style={{ color: "#e8e6ff", fontSize: 12, fontWeight: 700, margin: "0 0 4px", fontFamily: "Inter, system-ui, sans-serif" }}>{theme.name}</p>
            <p style={{ color: "#8884a8", fontSize: 10, lineHeight: 1.35, margin: "0 0 9px", fontFamily: "Inter, system-ui, sans-serif" }}>{theme.description}</p>
            <button
              type="button"
              onClick={() => onApplyTheme(theme)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 9,
                border: "1px solid rgba(200,169,106,0.36)",
                background: activeThemeId === theme.id ? "rgba(200,169,106,0.22)" : "rgba(200,169,106,0.10)",
                color: activeThemeId === theme.id ? "#f4d28a" : "#c8c4f0",
                cursor: "pointer", fontSize: 11, fontWeight: 700
              }}
            >
              {activeThemeId === theme.id ? "Aplicado" : "Aplicar paleta"}
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
  sectionElements,
  selectedIds,
  onSelectLayer,
  onToggleVisible,
  onToggleLocked,
  onLayerMoveUp,
  onLayerMoveDown,
  onReorderLayers,
  eventDate,
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
  // layers panel
  sectionElements: V3Element[];
  selectedIds: string[];
  onSelectLayer: (id: string, shift?: boolean) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onLayerMoveUp: (id: string) => void;
  onLayerMoveDown: (id: string) => void;
  onReorderLayers: (orderedIds: string[]) => void;
  eventDate?: string;
}) {
  const [pendingDelete, setPendingDelete] = React.useState<"element" | "section" | null>(null);
  const [openGroup, setOpenGroup] = React.useState<InspectorGroup>("content");
  const [layersOpen, setLayersOpen] = React.useState(true);

  // ── Layer drag & drop state ───────────────────────────────────────────────
  const layerDragRef = React.useRef<{ id: string; fromIdx: number } | null>(null);
  const layerListRef = React.useRef<HTMLDivElement>(null);
  const dropAtRef = React.useRef<number>(-1);
  const [dropAt, setDropAt] = React.useState<number>(-1);
  // Stable refs so effect closure is always current
  const sortedLayersRef = React.useRef<V3Element[]>([]);
  const onReorderLayersRef = React.useRef(onReorderLayers);
  onReorderLayersRef.current = onReorderLayers;

  React.useEffect(() => {
    const ROW_H = 29; // row height + gap in px
    const onMove = (e: PointerEvent) => {
      if (!layerDragRef.current || !layerListRef.current) return;
      const rect = layerListRef.current.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const layers = sortedLayersRef.current;
      const idx = Math.max(0, Math.min(layers.length, Math.round(relY / ROW_H)));
      dropAtRef.current = idx;
      setDropAt(idx);
    };
    const onUp = () => {
      if (!layerDragRef.current) return;
      const { id, fromIdx } = layerDragRef.current;
      layerDragRef.current = null;
      const toIdx = dropAtRef.current;
      setDropAt(-1);
      dropAtRef.current = -1;
      // No-op if dropped on itself or the slot right after it
      if (toIdx < 0 || toIdx === fromIdx || toIdx === fromIdx + 1) return;
      const layers = sortedLayersRef.current;
      const newOrder = layers.map((el) => el.id);
      newOrder.splice(fromIdx, 1);
      const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
      newOrder.splice(insertAt, 0, id);
      onReorderLayersRef.current(newOrder);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []); // stable — reads only refs

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
  // ── Layers helpers ────────────────────────────────────────────────────────
  const getLayerIcon = (el: V3Element): string => {
    if (el.type === "text") return "Tx";
    if (el.type === "app") {
      const k = el.appKind ?? el.appType ?? "";
      if (k === "whatsapp") return "💬";
      if (k === "rsvp") return "✉";
      if (k === "countdown") return "⏱";
      if (k === "maps") return "📍";
      if (k === "live-album" || k === "album") return "📷";
      if (k === "live-screen" || k === "live") return "📺";
      if (k === "qr") return "◾";
      return "⚙";
    }
    if (el.type === "decoration") return "✦";
    return "▭"; // shape
  };
  const getLayerName = (el: V3Element): string => {
    if (el.type === "text") {
      const txt = (el.content ?? "").trim();
      return txt.length > 22 ? txt.slice(0, 22) + "…" : txt || "Texto";
    }
    if (el.type === "app") {
      const k = el.appKind ?? el.appType ?? "";
      if (k === "whatsapp") return "WhatsApp";
      if (k === "rsvp") return "RSVP";
      if (k === "countdown") return "Cuenta regresiva";
      if (k === "maps") return "Mapa";
      if (k === "live-album" || k === "album") return "Álbum";
      if (k === "live-screen" || k === "live") return "Pantalla en vivo";
      if (k === "qr") return "Código QR";
      return el.content || "Aplicación";
    }
    if (el.type === "decoration") return el.content || "Decoración";
    return "Forma";
  };

  // ── Layers panel (always visible when sectionElements present) ─────────────
  const sortedLayers = [...sectionElements].sort((a, b) => b.zIndex - a.zIndex);
  sortedLayersRef.current = sortedLayers; // keep ref current for drag handler
  const isDragging = dropAt >= 0;

  const DropLine = (
    <div style={{
      height: 2, background: "#7c3aed", borderRadius: 1,
      margin: "1px 4px",
      boxShadow: "0 0 6px rgba(124,58,237,0.7)",
      pointerEvents: "none",
    }} />
  );

  const LayersPanel = sectionElements.length > 0 ? (
    <div style={{ background: "#12121c", borderBottom: "1px solid #2a2a3d" }}>
      {/* header */}
      <button
        type="button"
        onClick={() => setLayersOpen((v) => !v)}
        style={{
          width: "100%", padding: "10px 14px", border: "none", background: "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 10, color: "#7c3aed" }}>⧉</span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a8a3c8" }}>Capas</span>
          <span style={{ fontSize: 9, color: "#6f6b8f", background: "#1e1e2d", border: "1px solid #2a2a3d", borderRadius: 99, padding: "1px 6px" }}>{sectionElements.length}</span>
        </span>
        <span style={{ fontSize: 9, color: "#6f6b8f" }}>{layersOpen ? "−" : "+"}</span>
      </button>
      {layersOpen && (
        <div ref={layerListRef} style={{ display: "flex", flexDirection: "column", padding: "2px 8px 8px" }}>
          {sortedLayers.map((el, idx) => {
            const isSel = selectedIds.includes(el.id);
            const isHid = el.visible === false;
            const isLocked = el.locked === true;
            const isDragSrc = isDragging && layerDragRef.current?.id === el.id;
            return (
              <React.Fragment key={el.id}>
                {/* drop indicator ABOVE this row */}
                {isDragging && dropAt === idx && DropLine}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 4px 5px 2px",
                    borderRadius: 7,
                    background: isDragSrc
                      ? "rgba(124,58,237,0.08)"
                      : isSel ? "rgba(124,58,237,0.18)" : "transparent",
                    border: isSel ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                    opacity: isHid ? 0.42 : isDragSrc ? 0.55 : 1,
                    cursor: isDragging ? "grabbing" : "pointer",
                    transition: "background 0.1s, opacity 0.1s",
                    userSelect: "none",
                    marginBottom: 1,
                  }}
                  onClick={(e) => { if (!isDragging) onSelectLayer(el.id, e.shiftKey); }}
                >
                  {/* drag handle */}
                  <span
                    title="Arrastrar para reordenar"
                    onPointerDown={(e) => {
                      e.stopPropagation(); // isolate from canvas drag
                      layerDragRef.current = { id: el.id, fromIdx: idx };
                      dropAtRef.current = idx;
                      setDropAt(idx);
                    }}
                    style={{
                      fontSize: 11, width: 12, flexShrink: 0,
                      cursor: "grab",
                      color: "#3e3b60",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      userSelect: "none",
                      lineHeight: 1,
                    }}
                  >
                    ⠿
                  </span>
                  {/* type icon */}
                  <span style={{ fontSize: 10, width: 14, textAlign: "center", flexShrink: 0, color: isSel ? "#c4b5fd" : "#8884a8" }}>
                    {getLayerIcon(el)}
                  </span>
                  {/* name */}
                  <span style={{
                    flex: 1, fontSize: 11, fontFamily: "Inter, system-ui, sans-serif",
                    color: isSel ? "#e8e6ff" : "#c8c4f0",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    minWidth: 0,
                  }}>
                    {getLayerName(el)}
                  </span>
                  {/* controls: eye + lock */}
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" title={isHid ? "Mostrar" : "Ocultar"}
                      onClick={() => onToggleVisible(el.id)}
                      style={{ width: 18, height: 18, border: "none", background: "none", cursor: "pointer", color: isHid ? "#4a4870" : "#7878a8", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, padding: 0 }}>
                      {isHid ? "🙈" : "👁"}
                    </button>
                    <button type="button" title={isLocked ? "Desbloquear" : "Bloquear"}
                      onClick={() => onToggleLocked(el.id)}
                      style={{ width: 18, height: 18, border: "none", background: "none", cursor: "pointer", color: isLocked ? "#c8a96a" : "#4a4870", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, padding: 0 }}>
                      {isLocked ? "🔒" : "🔓"}
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {/* drop indicator after last row */}
          {isDragging && dropAt === sortedLayers.length && DropLine}
        </div>
      )}
    </div>
  ) : null;

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
          {LayersPanel}
          <div style={sectionHeaderStyle}>
            <span style={{ ...panelBadgeStyle, color: "#f4d28a", background: "rgba(200,169,106,0.12)", border: "1px solid rgba(200,169,106,0.24)" }}>
              Sección
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
        {LayersPanel}
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
      {LayersPanel}
      {/* Element header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #2a2a3d" }}>
        <p style={{ color: "#c8a96a", fontSize: 10, letterSpacing: "0.1em", fontFamily: "Inter, system-ui, sans-serif", margin: 0, textTransform: "uppercase", opacity: 0.75 }}>Elemento</p>
        <p style={{ color: "#e8e6ff", fontSize: 14, fontWeight: "600", fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>
          {element.type === "text" ? "Texto" : element.type === "app" ? "Bloque de aplicación" : element.type === "decoration" ? "Decoración" : "Forma"}
          {element.locked && <span style={{ marginLeft: 8, color: "#c8a96a", fontSize: 10 }}>🔒</span>}
        </p>
      </div>
      {/* Element actions */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #2a2a3d", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <button type="button" onClick={onDuplicate}
            style={{ ...actionBtnStyle, flex: 1, textAlign: "center" }}>⧉ Duplicar</button>
          <button type="button" onClick={onBringToFront}
            style={{ ...actionBtnStyle, flex: 1, textAlign: "center" }}>↑ Traer al frente</button>
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
            {element.type === "app" && normalizeAppType(element) && <><div style={{ padding: "10px 12px", background: "#1e1e2d", border: "1px solid #2a2a3d", borderRadius: 10 }}><p style={{ color: "#c8c4f0", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>{APP_DEMO_LABELS[normalizeAppType(element)!]?.icon} {APP_DEMO_LABELS[normalizeAppType(element)!]?.label}</p><p style={{ color: "#8884a8", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>Bloque visual de muestra</p></div><div><span style={labelStyle}>Texto del bloque</span><input type="text" value={element.content ?? APP_DEMO_LABELS[normalizeAppType(element)!]?.label ?? ""} onChange={(e) => onChange(element.id, { content: e.target.value })} style={inputStyle} /></div></>}
            {(element.type === "shape" || element.type === "decoration") && <p style={{ color: "#8884a8", fontSize: 12, lineHeight: 1.5, margin: 0 }}>Este bloque se edita desde relleno, contorno y sombra.</p>}
          </>
        ), true, element.type === "text" ? "Texto" : element.type === "app" ? "Bloque" : "Forma")}
        {renderGroup("typography", "Tipografía", <><div><span style={labelStyle}>Color</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={element.color ?? "#ffffff"} onChange={(e) => onChange(element.id, { color: e.target.value })} style={{ width: 36, height: 30, border: "none", borderRadius: 6, cursor: "pointer", background: "none" }} /><input type="text" value={element.color ?? "#ffffff"} onChange={(e) => onChange(element.id, { color: e.target.value })} style={{ ...inputStyle, flex: 1 }} /></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><div><span style={labelStyle}>Tamaño</span><input type="number" min={8} max={120} value={element.fontSize ?? 16} onChange={(e) => onChange(element.id, { fontSize: Number(e.target.value) })} style={inputStyle} /></div><div><span style={labelStyle}>Peso</span><input type="text" value={element.fontWeight ?? "400"} onChange={(e) => onChange(element.id, { fontWeight: e.target.value })} style={inputStyle} /></div></div><div><span style={labelStyle}>Fuente</span><select value={element.fontFamily ?? "Inter, system-ui, sans-serif"} onChange={(e) => onChange(element.id, { fontFamily: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}><option value="Inter, system-ui, sans-serif">Inter</option><option value="'Playfair Display', Georgia, serif">Playfair Display</option><option value="Georgia, serif">Georgia</option><option value="'Dancing Script', cursive">Dancing Script</option></select></div><div><span style={labelStyle}>Alineación</span><div style={{ display: "flex", gap: 4 }}>{(["left", "center", "right"] as const).map((a) => <button key={a} type="button" onClick={() => onChange(element.id, { textAlign: a })} style={{ flex: 1, padding: "6px 0", background: element.textAlign === a ? "#7c3aed" : "#1e1e2d", border: "1px solid #2a2a3d", borderRadius: 6, cursor: "pointer", color: element.textAlign === a ? "#fff" : "#9898b8", fontSize: 11 }}>{a === "left" ? "Izquierda" : a === "center" ? "Centro" : "Derecha"}</button>)}</div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><div><span style={labelStyle}>Interlineado</span><input type="number" min={0.8} max={3} step={0.05} value={element.lineHeight ?? 1.4} onChange={(e) => onChange(element.id, { lineHeight: Number(e.target.value) })} style={inputStyle} /></div><div><span style={labelStyle}>Espaciado de letras</span><input type="number" min={0} max={1} step={0.01} value={element.letterSpacing ?? 0} onChange={(e) => onChange(element.id, { letterSpacing: Number(e.target.value) })} style={inputStyle} /></div></div></>, element.type === "text", "Aa")}
        {renderGroup("fill", "Relleno", <><div><span style={labelStyle}>Fondo</span><input type="text" value={element.config?.primaryColor ?? element.background ?? ""} placeholder="Color, rgba(...) o linear-gradient(...)" onChange={(e) => onChange(element.id, { background: e.target.value, config: element.type === "app" ? { ...(element.config ?? {}), primaryColor: e.target.value } : element.config })} style={inputStyle} /></div>{element.type === "app" && <div><span style={labelStyle}>Color de texto</span><input type="text" value={element.color ?? element.config?.textColor ?? ""} onChange={(e) => onChange(element.id, { color: e.target.value, config: { ...(element.config ?? {}), textColor: e.target.value } })} style={inputStyle} /></div>}<div><span style={labelStyle}>Transparencia {Math.round((1 - (element.opacity ?? 1)) * 100)}%</span><input type="range" min={0} max={1} step={0.01} value={element.opacity ?? 1} onChange={(e) => onChange(element.id, { opacity: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></div></>, element.type !== "text", "Relleno")}
        {renderGroup("stroke", "Contorno", <><div><span style={labelStyle}>Borde redondeado: {element.borderRadius ?? 0}px</span><input type="range" min={0} max={999} step={1} value={element.borderRadius ?? 0} onChange={(e) => onChange(element.id, { borderRadius: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ ...labelStyle, margin: 0 }}>Activar contorno</span><button type="button" onClick={() => onChange(element.id, hasBorder(element) ? { borderWidth: 0, borderStyle: "none" } : { borderWidth: 1, borderStyle: "solid", borderColor: element.borderColor ?? "#c8a96a" })} style={{ ...actionBtnStyle, width: "auto", padding: "6px 10px" }}>{hasBorder(element) ? "Activo" : "Inactivo"}</button></div>{hasBorder(element) && <><input type="text" value={element.borderColor ?? ""} placeholder="rgba(200,169,106,0.35)" onChange={(e) => onChange(element.id, { borderColor: e.target.value })} style={inputStyle} /><input type="range" min={1} max={12} step={1} value={element.borderWidth ?? 1} onChange={(e) => onChange(element.id, { borderWidth: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /><div style={{ display: "flex", gap: 4 }}>{(["solid", "dashed"] as const).map((borderStyle) => <button key={borderStyle} type="button" onClick={() => onChange(element.id, { borderStyle })} style={{ ...actionBtnStyle, textAlign: "center", background: (element.borderStyle ?? "solid") === borderStyle ? "#2a1f4d" : "#1e1e2d" }}>{borderStyle === "solid" ? "Sólido" : "Discontinuo"}</button>)}</div></>}</>, element.type !== "text", "Contorno")}
        {renderGroup("shadow", "Sombra", <>{element.type === "text" && <div><span style={labelStyle}>Sombra de texto</span><input type="text" value={element.textShadow ?? ""} placeholder="0 2px 10px rgba(...)" onChange={(e) => onChange(element.id, { textShadow: e.target.value })} style={inputStyle} /></div>}{(element.type === "shape" || element.type === "decoration") && element.blur !== undefined && <div><span style={labelStyle}>Desenfoque: {element.blur ?? 0}px</span><input type="range" min={0} max={40} step={1} value={element.blur ?? 0} onChange={(e) => onChange(element.id, { blur: Number(e.target.value) })} style={{ width: "100%", accentColor: "#7c3aed" }} /></div>}</>, element.type === "text" || element.type === "shape" || element.type === "decoration", "Sombra")}
        {renderGroup("spacing", "Espaciado interno", <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{(["x", "y", "width", "height"] as const).map((k) => <div key={k}><span style={{ ...labelStyle, fontSize: 9 }}>{k === "x" ? "Posición X" : k === "y" ? "Posición Y" : k === "width" ? "Ancho" : "Alto"}</span><input type="number" value={Math.round(element[k] as number) || 0} disabled={element.locked} onChange={(e) => onChange(element.id, { [k]: Number(e.target.value) })} style={{ ...inputStyle, opacity: element.locked ? 0.5 : 1 }} /></div>)}</div>, true, "Ajustes")}
        {renderGroup("action", "Acción", <>
          {element.type === "app" && normalizeAppType(element) !== "countdown" && <div><span style={labelStyle}>URL de muestra</span><input type="text" value={element.config?.url ?? ""} onChange={(e) => onChange(element.id, { config: { ...(element.config ?? {}), url: e.target.value } })} style={inputStyle} /></div>}
          {element.type === "app" && normalizeAppType(element) === "countdown" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ ...labelStyle, fontWeight: 700, color: "#c4b5fd" }}>⏱ Cuenta Regresiva</span>
              <div>
                <span style={labelStyle}>Fuente de la fecha</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["event", "custom"] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => onChange(element.id, { config: { ...(element.config ?? {}), countdownMode: mode } })} style={{ ...actionBtnStyle, flex: 1, textAlign: "center", background: (element.config?.countdownMode ?? "event") === mode ? "#2a1f4d" : "#1e1e2d", color: (element.config?.countdownMode ?? "event") === mode ? "#a78bfa" : "#c8c4f0" }}>
                      {mode === "event" ? "Fecha del evento" : "Personalizada"}
                    </button>
                  ))}
                </div>
              </div>
              {(element.config?.countdownMode ?? "event") === "event" && (
                <div style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  <span style={{ ...labelStyle, margin: 0, color: eventDate ? "#a78bfa" : "#f87171" }}>
                    {eventDate ? `📅 ${new Date(eventDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}` : "⚠ Sin fecha configurada en el evento"}
                  </span>
                </div>
              )}
              {element.config?.countdownMode === "custom" && (
                <div>
                  <span style={labelStyle}>Fecha y hora objetivo</span>
                  <input type="datetime-local" value={element.config?.countdownTarget ? element.config.countdownTarget.slice(0, 16) : ""} onChange={(e) => onChange(element.id, { config: { ...(element.config ?? {}), countdownTarget: e.target.value ? new Date(e.target.value).toISOString() : "" } })} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
              )}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" onClick={onDuplicate} style={{ ...actionBtnStyle, textAlign: "center" }}>Duplicar</button><button type="button" onClick={onBringToFront} style={{ ...actionBtnStyle, textAlign: "center" }}>Traer al frente</button><button type="button" onClick={onSendToBack} style={{ ...actionBtnStyle, textAlign: "center" }}>Enviar atrás</button><button type="button" onClick={() => setPendingDelete("element")} style={{ ...actionBtnStyle, textAlign: "center", color: "#f87171" }}>Eliminar</button></div>
        </>, true, "Acción")}
        {renderGroup("visibility", "Visibilidad", <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ ...labelStyle, margin: 0 }}>Visible</span><button type="button" onClick={() => onChange(element.id, { visible: !element.visible })} style={{ width: 36, height: 20, borderRadius: 10, background: element.visible ? "#7c3aed" : "#2a2a3d", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}><span style={{ position: "absolute", top: 2, left: element.visible ? 18 : 2, width: 16, height: 16, background: "#fff", borderRadius: 8, transition: "left 0.2s" }} /></button></div>, true, "Vista")}
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
  eventDate?: string; // "YYYY-MM-DDTHH:mm:ss"
};

export function CanvasEditorV3({ eventId, eventSlug, eventTitle, initialDesign = null, eventDate }: CanvasEditorV3Props) {
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [viewportMode, setViewportMode] = useState<"mobile" | "desktop">("mobile");
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<V3Element[]>(elements);
  const dragRef = useRef<{
    id: string; startX: number; startY: number; elX: number; elY: number; active: boolean;
    shiftKey: boolean; // true = started with Shift held, selection deferred to onClick
    offsets: Array<{ id: string; dx: number; dy: number }>;
    preSnapshot: HistoryEntry;
  } | null>(null);
  const resizeRef = useRef<{
    id: string; handle: string;
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
    preSnapshot: HistoryEntry;
  } | null>(null);
  const selectionBoxRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    shiftKey: boolean;
    active: boolean;
  } | null>(null);

  const wasMovedRef = useRef(false); // true during the tick after a real drag completes
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? DEFAULT_SECTIONS[0];
  const documentHeight = sections.at(-1) ? sections.at(-1)!.y + sections.at(-1)!.height : DEFAULT_DOCUMENT_H;
  const canvasW = viewportMode === "desktop" ? 1000 : CANVAS_W;
  const SNAP_TOLERANCE = 6;
  const DRAG_START_THRESHOLD = 2;

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const sectionsRef = useRef<V3Section[]>(sections);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  const expandSelectionWithGroups = useCallback((ids: string[], source = elementsRef.current) => {
    const wanted = new Set(ids);
    const groupIds = new Set(
      source
        .filter((element) => wanted.has(element.id) && element.groupId)
        .map((element) => element.groupId as string)
    );

    source.forEach((element) => {
      if (element.groupId && groupIds.has(element.groupId)) wanted.add(element.id);
    });

    return Array.from(wanted);
  }, []);

  const getCanvasPoint = useCallback((event: MouseEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(canvasW, (event.clientX - rect.left) / zoom)),
      y: Math.max(0, Math.min(documentHeight, (event.clientY - rect.top) / zoom)),
    };
  }, [canvasW, documentHeight, zoom]);

  const normalizeBox = useCallback((startX: number, startY: number, currentX: number, currentY: number): SelectionBox => ({
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  }), []);

  const intersectsBox = (element: V3Element, box: SelectionBox) => {
    const elementHeight = element.height ?? 60;
    return (
      element.x < box.x + box.width &&
      element.x + element.width > box.x &&
      element.y < box.y + box.height &&
      element.y + elementHeight > box.y
    );
  };

  // ── History: undo / redo ─────────────────────────────────────────────────
  const pastRef  = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const lastPatchRef = useRef<{ id: string; time: number } | null>(null);

  const snapshot = useCallback(
    (): HistoryEntry => ({ elements: elementsRef.current, sections: sectionsRef.current }),
    []
  );

  const pushHistory = useCallback((before: HistoryEntry) => {
    pastRef.current = [...pastRef.current, before].slice(-MAX_HISTORY);
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      { elements: elementsRef.current, sections: sectionsRef.current },
      ...futureRef.current,
    ].slice(0, MAX_HISTORY);
    setElements(prev.elements);
    setSections(prev.sections);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [
      ...pastRef.current,
      { elements: elementsRef.current, sections: sectionsRef.current },
    ].slice(-MAX_HISTORY);
    setElements(next.elements);
    setSections(next.sections);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const getSnappedPosition = useCallback((
    moving: V3Element,
    proposedX: number,
    proposedY: number,
    allElements: V3Element[]
  ) => {
    const width = moving.width;
    const height = moving.height ?? 60;
    const verticalCandidates: { distance: number; x: number; line: SnapLine }[] = [];
    const horizontalCandidates: { distance: number; y: number; line: SnapLine }[] = [];

    const considerVertical = (targetX: number, sourceOffset: number, label?: string) => {
      const distance = Math.abs(proposedX + sourceOffset - targetX);
      if (distance > SNAP_TOLERANCE) return;
      verticalCandidates.push({
        distance,
        x: targetX - sourceOffset,
        line: {
          id: `v-${Math.round(targetX)}-${label ?? "align"}`,
          type: "vertical",
          position: Math.round(targetX),
          start: 0,
          end: documentHeight,
          label
        }
      });
    };

    const considerHorizontal = (targetY: number, sourceOffset: number, label?: string) => {
      const distance = Math.abs(proposedY + sourceOffset - targetY);
      if (distance > SNAP_TOLERANCE) return;
      horizontalCandidates.push({
        distance,
        y: targetY - sourceOffset,
        line: {
          id: `h-${Math.round(targetY)}-${label ?? "align"}`,
          type: "horizontal",
          position: Math.round(targetY),
          start: 0,
          end: canvasW,
          label
        }
      });
    };

    considerVertical(canvasW / 2, width / 2, "centro");

    sections.forEach((section) => {
      considerHorizontal(section.y + section.height / 2, height / 2, "centro");
    });

    allElements
      .filter((el) => el.id !== moving.id && el.visible)
      .forEach((el) => {
        const otherHeight = el.height ?? 60;
        const verticalTargets = [el.x, el.x + el.width / 2, el.x + el.width];
        const verticalOffsets = [0, width / 2, width];
        const horizontalTargets = [el.y, el.y + otherHeight / 2, el.y + otherHeight];
        const horizontalOffsets = [0, height / 2, height];

        verticalTargets.forEach((target) => {
          verticalOffsets.forEach((offset) => considerVertical(target, offset, "alineado"));
        });
        horizontalTargets.forEach((target) => {
          horizontalOffsets.forEach((offset) => considerHorizontal(target, offset, "alineado"));
        });
      });

    const bestVertical = verticalCandidates.sort((a, b) => a.distance - b.distance)[0];
    const bestHorizontal = horizontalCandidates.sort((a, b) => a.distance - b.distance)[0];
    const lines: SnapLine[] = [];
    let nextX = proposedX;
    let nextY = proposedY;
    if (bestVertical) {
      nextX = bestVertical.x;
      lines.push(bestVertical.line);
    }
    if (bestHorizontal) {
      nextY = bestHorizontal.y;
      lines.push(bestHorizontal.line);
    }

    return {
      x: Math.round(nextX),
      y: Math.round(nextY),
      lines
    };
  }, [canvasW, documentHeight, sections]);

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

    if (e.shiftKey) {
      // ── Shift+mousedown ──────────────────────────────────────────────────
      // DO NOT touch selectedIds here. onClick will handle the toggle.
      // Prepare offsets so a potential Shift+drag moves the right group.
      // Include `id` in the group even though it may not be in selectedIds yet.
      const multiIds = selectedIds.includes(id) ? selectedIds : expandSelectionWithGroups([...selectedIds, id]);
      const offsets = multiIds
        .filter((sid) => sid !== id)
        .flatMap((sid) => {
          const sEl = elements.find((e) => e.id === sid);
          return sEl && !sEl.locked ? [{ id: sid, dx: sEl.x - el.x, dy: sEl.y - el.y }] : [];
        });
      dragRef.current = { id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y, shiftKey: true, offsets, active: false, preSnapshot: snapshot() };
      return;
    }

    // ── Normal mousedown ─────────────────────────────────────────────────────
    // Keep multi-selection if element is already part of it; else single-select.
    const multiIds = selectedIds.includes(id) ? selectedIds : expandSelectionWithGroups([id]);
    if (!selectedIds.includes(id)) setSelectedIds(multiIds);
    const offsets = multiIds
      .filter((sid) => sid !== id)
      .flatMap((sid) => {
        const sEl = elements.find((e) => e.id === sid);
        return sEl && !sEl.locked ? [{ id: sid, dx: sEl.x - el.x, dy: sEl.y - el.y }] : [];
      });
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y, shiftKey: false, offsets, active: false, preSnapshot: snapshot() };
  }, [elements, expandSelectionWithGroups, selectedIds, snapshot]);

  // ── Resize ──────────────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent, id: string, handle: string) => {
    const el = elements.find((el) => el.id === id);
    if (!el || el.locked) return;
    resizeRef.current = {
      id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y,
      origW: el.width, origH: el.height ?? 60,
      preSnapshot: snapshot(),
    };
  }, [elements, snapshot]);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (preview || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-element-id]") || target.closest("[data-canvas-control='true']")) return;
    const point = getCanvasPoint(e);
    if (!point) return;
    selectionBoxRef.current = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      shiftKey: e.shiftKey,
      active: false,
    };
    setSelectionBox(null);
  }, [getCanvasPoint, preview]);

  // ── Global pointer move & up ─────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (selectionBoxRef.current) {
        const point = getCanvasPoint(e);
        const selection = selectionBoxRef.current;
        if (point) {
          selection.currentX = point.x;
          selection.currentY = point.y;
          if (!selection.active && Math.hypot(point.x - selection.startX, point.y - selection.startY) >= DRAG_START_THRESHOLD) {
            selection.active = true;
          }
          if (selection.active) {
            setSelectionBox(normalizeBox(selection.startX, selection.startY, point.x, point.y));
          }
        }
      }
      if (dragRef.current) {
        const drag = dragRef.current;
        const { id, startX, startY, elX, elY, offsets } = drag;
        const screenDx = e.clientX - startX;
        const screenDy = e.clientY - startY;
        if (!drag.active && Math.hypot(screenDx, screenDy) < DRAG_START_THRESHOLD) return;
        if (!drag.active) {
          // First movement past threshold — commit drag state
          wasMovedRef.current = true;
          // If this started with Shift held, add the dragged element to selection now
          if (drag.shiftKey) {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...expandSelectionWithGroups([drag.id])])));
          }
        }
        drag.active = true;
        const dx = screenDx / zoom;
        const dy = screenDy / zoom;
        const currentElements = elementsRef.current;
        const movingElement = currentElements.find((el) => el.id === id);
        if (!movingElement) return;
        const snapped = getSnappedPosition(movingElement, elX + dx, elY + dy, currentElements);
        setSnapLines(snapped.lines);
        // snapDx/Dy = actual delta after snap (for group translation)
        const snapDx = snapped.x - elX;
        const snapDy = snapped.y - elY;
        setElements((prev) =>
          prev.map((el) => {
            if (el.id === id) return { ...el, x: snapped.x, y: snapped.y };
            const off = offsets.find((o) => o.id === el.id);
            if (off) return { ...el, x: Math.round(elX + snapDx + off.dx), y: Math.round(elY + snapDy + off.dy) };
            return el;
          })
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
            if (handle.includes("l")) { w = Math.max(40, origW - dx); x = origX + (origW - w); }
            if (handle.includes("b")) h = Math.max(24, origH + dy);
            if (handle.includes("t")) { h = Math.max(24, origH - dy); y = origY + (origH - h); }
            return { ...el, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
          })
        );
      }
    };
    const onUp = () => {
      if (selectionBoxRef.current) {
        const selection = selectionBoxRef.current;
        const box = normalizeBox(selection.startX, selection.startY, selection.currentX, selection.currentY);
        if (selection.active && box.width >= DRAG_START_THRESHOLD && box.height >= DRAG_START_THRESHOLD) {
          const ids = elementsRef.current
            .filter((element) => element.visible && !element.locked && intersectsBox(element, box))
            .map((element) => element.id);
          if (selection.shiftKey) {
            setSelectedIds((current) => Array.from(new Set([...current, ...expandSelectionWithGroups(ids)])));
          } else {
            setSelectedIds(expandSelectionWithGroups(ids));
          }
        } else if (!selection.shiftKey) {
          setSelectedIds([]);
        }
        selectionBoxRef.current = null;
        setSelectionBox(null);
      }
      // Push history snapshot only when a real drag/resize completed
      if (dragRef.current?.active) {
        pushHistory(dragRef.current.preSnapshot);
      }
      if (resizeRef.current) {
        const { origX, origY, origW, origH, preSnapshot, id } = resizeRef.current;
        const movedEl = elementsRef.current.find((e) => e.id === id);
        if (movedEl && (
          movedEl.x !== origX || movedEl.y !== origY ||
          movedEl.width !== origW || (movedEl.height ?? origH) !== origH
        )) {
          pushHistory(preSnapshot);
        }
      }
      dragRef.current = null;
      resizeRef.current = null;
      setSnapLines([]);
      // Reset after onClick fires (click fires before setTimeout in browser event order)
      setTimeout(() => { wasMovedRef.current = false; }, 0);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [expandSelectionWithGroups, getCanvasPoint, getSnappedPosition, normalizeBox, zoom, pushHistory]);

  // ── Add elements ────────────────────────────────────────────────────────────────────────────
  const addText = (kind: "title" | "subtitle" | "paragraph") => {
    pushHistory(snapshot());
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
    setSelectedIds([id]);
    setActiveTool(null);
  };

  const addElement = (kind: string) => {
    pushHistory(snapshot());
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
    setSelectedIds([id]);
    setActiveTool(null);
  };

  const addInvitationBlock = (kind: InvitationBlockKind) => {
    pushHistory(snapshot());
    const stamp = Date.now();
    const sectionY = activeSection?.y ?? 0;
    const baseY = sectionY + 86;
    const baseZ = elementsRef.current.length;
    const makeId = (name: string) => `block-${kind}-${name}-${stamp}`;
    const card = (
      name: string,
      x: number,
      y: number,
      width: number,
      height: number,
      extra: Partial<V3Element> = {}
    ): V3Element => ({
      id: makeId(name),
      type: "decoration",
      x,
      y,
      width,
      height,
      locked: false,
      visible: true,
      zIndex: baseZ,
      background: "linear-gradient(135deg,rgba(255,255,255,0.09),rgba(200,169,106,0.08))",
      border: "1px solid rgba(200,169,106,0.26)",
      borderRadius: 22,
      opacity: 1,
      ...extra,
    });
    const text = (
      name: string,
      content: string,
      x: number,
      y: number,
      width: number,
      height: number | null,
      extra: Partial<V3Element> = {}
    ): V3Element => ({
      id: makeId(name),
      type: "text",
      x,
      y,
      width,
      height,
      locked: false,
      visible: true,
      zIndex: baseZ + 1,
      content,
      fontSize: 14,
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "500",
      color: "#f6ead2",
      textAlign: "center",
      lineHeight: 1.35,
      letterSpacing: 0,
      textShadow: "0 2px 12px rgba(0,0,0,0.45)",
      ...extra,
    });
    const app = (
      name: string,
      appType: V3AppType,
      content: string,
      x: number,
      y: number,
      width: number,
      height: number,
      extra: Partial<V3Element> = {}
    ): V3Element => ({
      id: makeId(name),
      type: "app",
      x,
      y,
      width,
      height,
      locked: false,
      visible: true,
      zIndex: baseZ + 2,
      appKind: appType,
      appType,
      content,
      background: "linear-gradient(135deg,#c8a96a,#8f6a2d)",
      color: "#1a0a18",
      borderRadius: 16,
      opacity: 1,
      config: {
        url: appType === "maps" ? "https://maps.google.com" : "",
        primaryColor: "linear-gradient(135deg,#c8a96a,#8f6a2d)",
        textColor: "#1a0a18",
      },
      ...extra,
    });

    let next: V3Element[] = [];

    if (kind === "date") {
      next = [
        card("card", cx(330), baseY, 330, 174),
        text("eyebrow", "FECHA DEL EVENTO", cx(260), baseY + 22, 260, 18, { fontSize: 10, fontWeight: "800", color: "#c8a96a", letterSpacing: 0.18 }),
        text("day", "14", cx(94), baseY + 48, 94, 64, { fontSize: 58, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: "500", color: "#fff7ef", lineHeight: 1 }),
        text("month", "JUNIO 2026", cx(190), baseY + 68, 190, 26, { fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#f4d28a" }),
        text("time", "20:00 HS", cx(190), baseY + 108, 190, 24, { fontSize: 12, fontWeight: "800", color: "#e8e0cc", letterSpacing: 0.14 }),
        card("divider", cx(250), baseY + 144, 250, 1, { borderRadius: 0, background: "linear-gradient(90deg,transparent,#c8a96a,transparent)", border: undefined }),
      ];
    } else if (kind === "countdown") {
      next = [
        card("card", cx(340), baseY, 340, 156, { background: "linear-gradient(135deg,rgba(124,58,237,0.22),rgba(200,169,106,0.08))" }),
        text("title", "FALTA POCO", cx(240), baseY + 16, 240, 18, { fontSize: 10, fontWeight: "900", color: "#c8a96a", letterSpacing: 0.2 }),
        // ↓ Real live countdown — numbers come from CountdownBlock in renderer
        app("countdown", "countdown", "", cx(320), baseY + 42, 320, 62, {
          background: "transparent",
          color: "#e8e6ff",
          borderRadius: 0,
          opacity: 1,
          config: { url: "", primaryColor: "transparent", textColor: "#e8e6ff", countdownMode: "event" },
        }),
        text("caption", "para celebrar juntos", cx(260), baseY + 118, 260, 18, { fontSize: 13, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#f4d28a" }),
      ];
    } else if (kind === "location") {
      next = [
        card("card", cx(340), baseY, 340, 196),
        text("icon", "⌖", cx(42), baseY + 22, 42, 40, { fontSize: 28, color: "#c8a96a" }),
        text("label", "UBICACIÓN", cx(230), baseY + 24, 230, 18, { fontSize: 10, fontWeight: "900", color: "#c8a96a", letterSpacing: 0.18 }),
        text("place", "Salón de eventos", cx(270), baseY + 55, 270, 28, { fontSize: 23, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#fff7ef" }),
        text("address", "Av. principal 123 · Asunción", cx(284), baseY + 92, 284, 34, { fontSize: 13, color: "#d8cfbd", lineHeight: 1.3 }),
        app("map", "maps", "Ver mapa", cx(220), baseY + 138, 220, 44, { borderRadius: 14 }),
      ];
    } else if (kind === "dresscode") {
      next = [
        card("card", cx(340), baseY, 340, 178),
        text("label", "CÓDIGO DE VESTIMENTA", cx(280), baseY + 24, 280, 18, { fontSize: 10, fontWeight: "900", color: "#c8a96a", letterSpacing: 0.16 }),
        text("title", "Elegante formal", cx(280), baseY + 58, 280, 32, { fontSize: 28, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#fff7ef" }),
        text("hint", "Sugerimos tonos neutros y acentos champagne.", cx(290), baseY + 100, 290, 34, { fontSize: 13, color: "#d8cfbd", lineHeight: 1.35 }),
        card("swatch-1", cx(96) - 58, baseY + 140, 30, 30, { borderRadius: 999, background: "#f6ead2", border: "1px solid rgba(255,255,255,0.45)" }),
        card("swatch-2", cx(96) - 18, baseY + 140, 30, 30, { borderRadius: 999, background: "#c8a96a", border: "1px solid rgba(255,255,255,0.25)" }),
        card("swatch-3", cx(96) + 22, baseY + 140, 30, 30, { borderRadius: 999, background: "#7c3aed", border: "1px solid rgba(255,255,255,0.25)" }),
      ];
    } else {
      next = [
        card("card", cx(340), baseY, 340, 190, { background: "linear-gradient(135deg,rgba(255,255,255,0.10),rgba(124,58,237,0.10))" }),
        text("quote-open", "“", cx(40), baseY + 16, 40, 48, { fontSize: 58, fontFamily: "'Playfair Display', Georgia, serif", color: "#c8a96a", lineHeight: 0.9 }),
        text("message", "Gracias por acompañarnos en una noche tan especial. Tu presencia hace que este momento sea inolvidable.", cx(286), baseY + 56, 286, null, { fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", color: "#fff7ef", lineHeight: 1.45 }),
        text("signature", "Con cariño", cx(220), baseY + 148, 220, 24, { fontSize: 12, fontWeight: "800", color: "#c8a96a", letterSpacing: 0.14 }),
      ];
    }

    const selected = next.map((element) => element.id);
    setElements((prev) => [
      ...prev,
      ...next.map((element, index) => ({ ...element, zIndex: baseZ + index })),
    ]);
    setSelectedIds(selected);
    setActiveTool(null);
  };

  const addApp = (kind: string) => {
    pushHistory(snapshot());
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
    setSelectedIds([id]);
    setActiveTool(null);
  };

  const patchElement = (id: string, patch: Partial<V3Element>) => {
    const now = Date.now();
    const last = lastPatchRef.current;
    if (!last || last.id !== id || now - last.time > 800) pushHistory(snapshot());
    lastPatchRef.current = { id, time: now };
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...patch } : el));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    pushHistory(snapshot());
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedIds([]);
  };

  const duplicateElement = () => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;
    pushHistory(snapshot());
    const newEl: V3Element = { ...el, id: `el-${Date.now()}`, x: el.x + 14, y: el.y + 14, zIndex: elements.length };
    setElements((prev) => [...prev, newEl]);
    setSelectedIds([newEl.id]);
  };

  const bringToFront = () => {
    if (!selectedId) return;
    pushHistory(snapshot());
    const maxZ = Math.max(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === selectedId ? { ...e, zIndex: maxZ + 1 } : e));
  };

  const sendToBack = () => {
    if (!selectedId) return;
    pushHistory(snapshot());
    const minZ = Math.min(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === selectedId ? { ...e, zIndex: minZ - 1 } : e));
  };

  const getSelectedGroupBounds = useCallback((ids: string[], source = elementsRef.current) => {
    const selectedElements = source.filter((el) => ids.includes(el.id) && el.visible);
    if (selectedElements.length <= 1) return null;
    const minX = Math.min(...selectedElements.map((el) => el.x));
    const minY = Math.min(...selectedElements.map((el) => el.y));
    const maxX = Math.max(...selectedElements.map((el) => el.x + el.width));
    const maxY = Math.max(...selectedElements.map((el) => el.y + (el.height ?? 60)));
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      elements: selectedElements
    };
  }, []);

  const alignSelectedGroup = (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
    if (selectedIds.length <= 1) return;
    const bounds = getSelectedGroupBounds(selectedIds);
    if (!bounds) return;
    pushHistory(snapshot());
    setElements((prev) =>
      prev.map((el) => {
        if (!selectedIds.includes(el.id) || el.locked) return el;
        const height = el.height ?? 60;
        if (mode === "left") return { ...el, x: Math.round(bounds.minX) };
        if (mode === "centerX") return { ...el, x: Math.round(bounds.minX + (bounds.width - el.width) / 2) };
        if (mode === "right") return { ...el, x: Math.round(bounds.maxX - el.width) };
        if (mode === "top") return { ...el, y: Math.round(bounds.minY) };
        if (mode === "centerY") return { ...el, y: Math.round(bounds.minY + (bounds.height - height) / 2) };
        if (mode === "bottom") return { ...el, y: Math.round(bounds.maxY - height) };
        return el;
      })
    );
  };

  const duplicateSelectedGroup = () => {
    if (selectedIds.length <= 1) return;
    const groupElements = elements
      .filter((el) => selectedIds.includes(el.id))
      .sort((a, b) => a.zIndex - b.zIndex);
    if (groupElements.length <= 1) return;
    pushHistory(snapshot());
    const maxZ = Math.max(...elements.map((el) => el.zIndex), 0);
    const stamp = Date.now();
    const groupIdMap = new Map<string, string>();
    const copies: V3Element[] = groupElements.map((el, index) => {
      let nextGroupId = el.groupId;
      if (el.groupId) {
        if (!groupIdMap.has(el.groupId)) {
          groupIdMap.set(el.groupId, `group-${stamp}-${groupIdMap.size}`);
        }
        nextGroupId = groupIdMap.get(el.groupId);
      }
      return {
        ...el,
        id: `el-${stamp}-${index}`,
        x: el.x + 24,
        y: el.y + 24,
        zIndex: maxZ + index + 1,
        groupId: nextGroupId,
      };
    });
    setElements((prev) => [...prev, ...copies]);
    setSelectedIds(copies.map((el) => el.id));
  };

  const deleteSelectedGroup = () => {
    if (selectedIds.length <= 1) return;
    pushHistory(snapshot());
    setElements((prev) => prev.filter((el) => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  };

  // ── Layer panel helpers ────────────────────────────────────────────────────
  const selectedGroupIds = Array.from(new Set(
    elements
      .filter((el) => selectedIds.includes(el.id) && el.groupId)
      .map((el) => el.groupId as string)
  ));
  const canUngroupSelection = selectedGroupIds.length > 0;

  const groupSelected = () => {
    if (selectedIds.length <= 1) return;
    pushHistory(snapshot());
    const groupId = `group-${Date.now()}`;
    setElements((prev) => prev.map((el) => selectedIds.includes(el.id) ? { ...el, groupId } : el));
  };

  const ungroupSelected = () => {
    if (!canUngroupSelection) return;
    pushHistory(snapshot());
    const groupSet = new Set(selectedGroupIds);
    setElements((prev) => prev.map((el) => (
      el.groupId && groupSet.has(el.groupId) ? { ...el, groupId: undefined } : el
    )));
  };

  const distributeSelectedGroup = (axis: "horizontal" | "vertical") => {
    if (selectedIds.length < 3) return;
    const selectedElements = elements
      .filter((el) => selectedIds.includes(el.id) && el.visible && !el.locked)
      .sort((a, b) => axis === "horizontal" ? a.x - b.x : a.y - b.y);
    if (selectedElements.length < 3) return;

    pushHistory(snapshot());

    if (axis === "horizontal") {
      const first = selectedElements[0];
      const last = selectedElements[selectedElements.length - 1];
      const availableSpace = (last.x + last.width) - first.x;
      const totalWidth = selectedElements.reduce((sum, el) => sum + el.width, 0);
      const gap = (availableSpace - totalWidth) / (selectedElements.length - 1);
      let nextX = first.x;
      const positions: Record<string, number> = {};
      selectedElements.forEach((el, index) => {
        positions[el.id] = index === selectedElements.length - 1 ? last.x : Math.round(nextX);
        nextX += el.width + gap;
      });
      setElements((prev) => prev.map((el) => el.id in positions ? { ...el, x: positions[el.id] } : el));
      return;
    }

    const first = selectedElements[0];
    const last = selectedElements[selectedElements.length - 1];
    const lastHeight = last.height ?? 60;
    const availableSpace = (last.y + lastHeight) - first.y;
    const totalHeight = selectedElements.reduce((sum, el) => sum + (el.height ?? 60), 0);
    const gap = (availableSpace - totalHeight) / (selectedElements.length - 1);
    let nextY = first.y;
    const positions: Record<string, number> = {};
    selectedElements.forEach((el, index) => {
      positions[el.id] = index === selectedElements.length - 1 ? last.y : Math.round(nextY);
      nextY += (el.height ?? 60) + gap;
    });
    setElements((prev) => prev.map((el) => el.id in positions ? { ...el, y: positions[el.id] } : el));
  };

  const getSectionElements = (sId: string) => {
    const sec = sections.find((s) => s.id === sId);
    if (!sec) return [];
    return elements.filter((el) => el.y >= sec.y && el.y < sec.y + sec.height);
  };

  const layerMoveUp = (id: string) => {
    // Move up = increase zIndex (swap with next higher in section)
    pushHistory(snapshot());
    const sec = sections.find((s) => s.id === activeSectionId);
    if (!sec) return;
    const sEls = elements
      .filter((el) => el.y >= sec.y && el.y < sec.y + sec.height)
      .sort((a, b) => a.zIndex - b.zIndex);
    const idx = sEls.findIndex((el) => el.id === id);
    if (idx === -1 || idx === sEls.length - 1) return;
    const myZ = sEls[idx].zIndex;
    const otherId = sEls[idx + 1].id;
    const otherZ = sEls[idx + 1].zIndex;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id) return { ...el, zIndex: otherZ };
        if (el.id === otherId) return { ...el, zIndex: myZ };
        return el;
      })
    );
  };

  const layerMoveDown = (id: string) => {
    // Move down = decrease zIndex (swap with next lower in section)
    pushHistory(snapshot());
    const sec = sections.find((s) => s.id === activeSectionId);
    if (!sec) return;
    const sEls = elements
      .filter((el) => el.y >= sec.y && el.y < sec.y + sec.height)
      .sort((a, b) => a.zIndex - b.zIndex);
    const idx = sEls.findIndex((el) => el.id === id);
    if (idx <= 0) return;
    const myZ = sEls[idx].zIndex;
    const otherId = sEls[idx - 1].id;
    const otherZ = sEls[idx - 1].zIndex;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id) return { ...el, zIndex: otherZ };
        if (el.id === otherId) return { ...el, zIndex: myZ };
        return el;
      })
    );
  };

  const toggleLayerVisible = (id: string) => {
    patchElement(id, { visible: !(elements.find((el) => el.id === id)?.visible ?? true) });
  };

  const toggleLayerLocked = (id: string) => {
    patchElement(id, { locked: !(elements.find((el) => el.id === id)?.locked ?? false) });
  };

  const reorderLayers = (orderedIds: string[]) => {
    // orderedIds: new visual order top→bottom (highest zIndex first)
    pushHistory(snapshot());
    const sec = sections.find((s) => s.id === activeSectionId);
    if (!sec) return;
    const sEls = elements.filter((el) => el.y >= sec.y && el.y < sec.y + sec.height);
    // Collect existing zIndex values for the section, sorted ascending
    const zValues = [...sEls.map((el) => el.zIndex)].sort((a, b) => a - b);
    // Assign: orderedIds[0] = top layer = highest zIndex = zValues[last]
    const assignments: Record<string, number> = {};
    orderedIds.forEach((id, i) => {
      assignments[id] = zValues[zValues.length - 1 - i] ?? i;
    });
    setElements((prev) =>
      prev.map((el) => (el.id in assignments ? { ...el, zIndex: assignments[el.id] } : el))
    );
  };

  const deleteSection = (sectionId: string) => {
    pushHistory(snapshot());
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
    setSelectedIds([]);
  };

  const duplicateSection = (sectionId: string) => {
    pushHistory(snapshot());
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
    setSelectedIds([]);
  };

  const moveSectionUp = (sectionId: string) => {
    pushHistory(snapshot());
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return recalcSectionY(next);
    });
  };

  const moveSectionDown = (sectionId: string) => {
    pushHistory(snapshot());
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return recalcSectionY(next);
    });
  };

  const addDemoSection = () => {
    pushHistory(snapshot());
    const last = sections.at(-1);
    const next: V3Section = {
      id: `custom-${Date.now()}`,
      label: `Sección ${sections.length + 1}`,
      y: last ? last.y + last.height : 0,
      height: 420,
      background: "linear-gradient(180deg,#17111c,#23122a)"
    };
    setSections((prev) => [...prev, next]);
    setActiveSectionId(next.id);
    window.setTimeout(() => scrollToSection(next), 0);
  };

  const applyTheme = (theme: CanvasV3Theme) => {
    pushHistory(snapshot());
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

  const applyPremiumTemplate = (id: string) => {
    const tpl = PREMIUM_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    pushHistory(snapshot());
    const { sections: newSections, elements: newElements } = tpl.create();
    setSections(newSections);
    setElements(newElements);
    setThemeId(tpl.themeId);
    setActiveSectionId(newSections[0]?.id ?? "");
    setSelectedIds([]);
    setSaved(false);
    setSaveStatus("idle");
    setActiveTool(null);
    // Scroll to top after a tick so new content renders first
    window.setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
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

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const ICON_SIDEBAR_W = 84;
  const EXPANDED_PANEL_W = 260;
  // Inspector width: 320px on wide screens, 280px on laptop
  const INSPECTOR_W = vw >= 1600 ? 320 : 280;
  // On laptop and smaller screens inspector renders as overlay drawer
  const inspectorIsOverlay = vw < 1400;

  useEffect(() => {
    const inlineInspectorWidth = !inspectorIsOverlay && inspectorOpen ? INSPECTOR_W : 0;
    const activePanelWidth = activeTool ? EXPANDED_PANEL_W : 0;
    const availableWidth = vw - ICON_SIDEBAR_W - activePanelWidth - inlineInspectorWidth - 96;
    const nextZoom = Math.max(0.3, Math.min(1, Math.floor((availableWidth / canvasW) * 100) / 100));
    setZoom((current) => Math.abs(current - nextZoom) > 0.03 ? nextZoom : current);
  }, [activeTool, canvasW, inspectorIsOverlay, inspectorOpen, vw]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  const countSectionElements = (section: V3Section) =>
    elements.filter((el) => el.y >= section.y && el.y < section.y + section.height).length;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", width: "100vw", maxWidth: "100vw", minWidth: 0,
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

        {/* Undo / Redo */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            style={{ ...topBtnStyle, padding: "5px 10px", fontSize: 16, opacity: canUndo ? 1 : 0.28, cursor: canUndo ? "pointer" : "default" }}
          >↶</button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Shift+Z)"
            style={{ ...topBtnStyle, padding: "5px 10px", fontSize: 16, opacity: canRedo ? 1 : 0.28, cursor: canRedo ? "pointer" : "default" }}
          >↷</button>
        </div>

        {/* Actions */}
        <button type="button" onClick={() => setPreview(!preview)} style={{ ...topBtnStyle, flexShrink: 0 }}>
          {preview ? "✎ Editar" : "👁 Vista previa"}
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
          <p style={{ color: "#8c86ad", fontSize: 8, fontWeight: 850, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", margin: "0 0 4px", width: "100%" }}>
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
                onAddInvitationBlock={addInvitationBlock}
                onApplyTheme={applyTheme}
                activeThemeId={themeId}
                onApplyPremiumTemplate={applyPremiumTemplate}
              />
            </div>
          </div>
        )}

        {/* -- CANVAS WORKSPACE -- */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "#111118",
          overflow: "hidden",
        }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "auto",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: vw < 1400 ? "24px 12px" : "36px 24px",
            }}
            ref={scrollRef}
          >
            <div style={{
              flexShrink: 0,
              transform: "scale(" + zoom + ")",
              transformOrigin: "top center",
            }}>
              <div
                ref={canvasRef}
                onMouseDown={onCanvasMouseDown}
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
                      borderTop: section.y === 0 ? undefined : "1px solid rgba(200,169,106,0.14)",
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
                        textTransform: "uppercase",
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
                      highlighted={selectedIds.length > 1 && selectedIds.includes(el.id) && !preview}
                      onMouseDown={(e) => !preview && onMoveStart(e, el.id)}
                      onClick={(e) => {
                        if (preview) return;
                        e.stopPropagation();
                        // Ignore click events that follow a real drag (wasMovedRef still true)
                        if (wasMovedRef.current) return;
                        const expanded = expandSelectionWithGroups([el.id]);
                        if (e.shiftKey) {
                          setSelectedIds((prev) => {
                            const expandedSet = new Set(expanded);
                            const allSelected = expanded.every((id) => prev.includes(id));
                            return allSelected
                              ? prev.filter((sid) => !expandedSet.has(sid))
                              : Array.from(new Set([...prev, ...expanded]));
                          });
                        } else {
                          setSelectedIds(expanded);
                        }
                      }}
                      onResizeMouseDown={(e, h) => !preview && onResizeStart(e, el.id, h)}
                    />
                  ))}

                {!preview && selectionBox && (
                  <div
                    style={{
                      position: "absolute",
                      left: selectionBox.x,
                      top: selectionBox.y,
                      width: selectionBox.width,
                      height: selectionBox.height,
                      border: "1px solid rgba(167,139,250,0.95)",
                      background: "rgba(124,58,237,0.16)",
                      borderRadius: 6,
                      boxShadow: "0 0 0 1px rgba(124,58,237,0.16)",
                      pointerEvents: "none",
                      zIndex: 10001,
                    }}
                  />
                )}

                {/* Group selection bounding box */}
                {!preview && selectedIds.length > 1 && (() => {
                  const selEls = elements.filter((el) => selectedIds.includes(el.id) && el.visible);
                  if (selEls.length === 0) return null;
                  const PAD = 6;
                  const minX = Math.min(...selEls.map((el) => el.x)) - PAD;
                  const minY = Math.min(...selEls.map((el) => el.y)) - PAD;
                  const maxX = Math.max(...selEls.map((el) => el.x + el.width)) + PAD;
                  const maxY = Math.max(...selEls.map((el) => el.y + (el.height ?? 60))) + PAD;
                  const groupToolbarButton: React.CSSProperties = {
                    minWidth: 74,
                    height: 26,
                    border: "1px solid rgba(167,139,250,0.38)",
                    borderRadius: 8,
                    background: "rgba(24,24,36,0.94)",
                    color: "#e8e6ff",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: "Inter, system-ui, sans-serif",
                    padding: "0 8px",
                    whiteSpace: "nowrap",
                  };
                  const canDistribute = selEls.filter((el) => !el.locked).length >= 3;
                  const distributeButtonStyle: React.CSSProperties = {
                    ...groupToolbarButton,
                    minWidth: 112,
                    padding: "0 9px",
                    opacity: canDistribute ? 1 : 0.45,
                    cursor: canDistribute ? "pointer" : "not-allowed",
                  };
                  const ungroupButtonStyle: React.CSSProperties = {
                    ...groupToolbarButton,
                    minWidth: 92,
                    opacity: canUngroupSelection ? 1 : 0.45,
                    cursor: canUngroupSelection ? "pointer" : "not-allowed",
                  };
                  return (
                    <React.Fragment key="group-bbox">
                      <div
                        style={{
                          position: "absolute",
                          left: minX, top: minY,
                          width: maxX - minX, height: maxY - minY,
                          border: "2px dashed rgba(124,58,237,0.75)",
                          borderRadius: 6,
                          pointerEvents: "none",
                          zIndex: 9997,
                          boxShadow: "0 0 0 1px rgba(124,58,237,0.12)",
                        }}
                      >
                        <div style={{
                          position: "absolute",
                          top: -26, left: 0,
                          background: "rgba(124,58,237,0.92)",
                          color: "#fff",
                          fontSize: 10, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 999,
                          fontFamily: "Inter, system-ui, sans-serif",
                          whiteSpace: "nowrap",
                          letterSpacing: "0.04em",
                        }}>
                          {selectedIds.length} elementos
                        </div>
                      </div>
                      <div
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: "absolute",
                          left: Math.max(8, minX),
                          top: Math.max(8, minY - 62),
                          zIndex: 10002,
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 5,
                          padding: 6,
                          borderRadius: 12,
                          background: "rgba(14,14,22,0.96)",
                          border: "1px solid rgba(124,58,237,0.55)",
                          boxShadow: "0 16px 42px rgba(0,0,0,0.42)",
                          pointerEvents: "auto",
                        }}
                      >
                        <button type="button" title="Alinear izquierda" onClick={() => alignSelectedGroup("left")} style={groupToolbarButton}>Izquierda</button>
                        <button type="button" title="Alinear centro horizontal" onClick={() => alignSelectedGroup("centerX")} style={{ ...groupToolbarButton, minWidth: 128 }}>Centro horizontal</button>
                        <button type="button" title="Alinear derecha" onClick={() => alignSelectedGroup("right")} style={groupToolbarButton}>Derecha</button>
                        <button type="button" title="Alinear arriba" onClick={() => alignSelectedGroup("top")} style={groupToolbarButton}>Arriba</button>
                        <button type="button" title="Alinear centro vertical" onClick={() => alignSelectedGroup("centerY")} style={{ ...groupToolbarButton, minWidth: 112 }}>Centro vertical</button>
                        <button type="button" title="Alinear abajo" onClick={() => alignSelectedGroup("bottom")} style={groupToolbarButton}>Abajo</button>
                        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(167,139,250,0.25)" }} />
                        <button type="button" title="Distribuir horizontalmente" disabled={!canDistribute} onClick={() => distributeSelectedGroup("horizontal")} style={distributeButtonStyle}>Distribuir horizontal</button>
                        <button type="button" title="Distribuir verticalmente" disabled={!canDistribute} onClick={() => distributeSelectedGroup("vertical")} style={distributeButtonStyle}>Distribuir vertical</button>
                        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(167,139,250,0.25)" }} />
                        <button type="button" title="Agrupar elementos seleccionados" onClick={groupSelected} style={groupToolbarButton}>Agrupar</button>
                        <button type="button" title="Desagrupar selección" disabled={!canUngroupSelection} onClick={ungroupSelected} style={ungroupButtonStyle}>Desagrupar</button>
                        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(167,139,250,0.25)" }} />
                        <button type="button" title="Duplicar grupo" onClick={duplicateSelectedGroup} style={{ ...groupToolbarButton, color: "#f4d28a" }}>Duplicar</button>
                        <button type="button" title="Eliminar grupo" onClick={deleteSelectedGroup} style={{ ...groupToolbarButton, color: "#f87171" }}>Eliminar</button>
                      </div>
                    </React.Fragment>
                  );
                })()}

                {!preview && snapLines.map((line) => (
                  <div
                    key={line.id}
                    style={{
                      position: "absolute",
                      left: line.type === "vertical" ? line.position : line.start,
                      top: line.type === "horizontal" ? line.position : line.start,
                      width: line.type === "vertical" ? 1 : line.end - line.start,
                      height: line.type === "horizontal" ? 1 : line.end - line.start,
                      background: "#a78bfa",
                      boxShadow: "0 0 12px rgba(167,139,250,0.65)",
                      zIndex: 9998,
                      pointerEvents: "none",
                    }}
                  >
                    {line.label && (
                      <span
                        style={{
                          position: "absolute",
                          left: line.type === "vertical" ? 6 : 8,
                          top: line.type === "vertical" ? 10 : -22,
                          padding: "3px 7px",
                          borderRadius: 999,
                          background: "rgba(22,22,31,0.92)",
                          border: "1px solid rgba(167,139,250,0.45)",
                          color: "#ddd6fe",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {line.label}
                      </span>
                    )}
                  </div>
                ))}

                {preview && (
                  <div style={{
                    position: "absolute",
                    bottom: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.72)",
                    borderRadius: 20,
                    padding: "4px 14px",
                    color: "#c8a96a",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    pointerEvents: "none",
                  }}>
                    MODO VISTA PREVIA
                  </div>
                )}
              </div>

              <p style={{
                textAlign: "center",
                marginTop: 10,
                color: "#4a4a6a",
                fontSize: 10,
                letterSpacing: "0.08em",
                fontFamily: "Inter, system-ui, sans-serif",
              }}>
                {canvasW} × {documentHeight} px · {viewportMode === "desktop" ? "Escritorio" : "Móvil"}
              </p>
            </div>
          </div>

          <div style={{
            minHeight: 112,
            flexShrink: 0,
            background: "#16161f",
            borderTop: "1px solid #2a2a3d",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            overflowX: "auto",
          }}>
            {sections.map((section) => {
              const active = section.id === activeSectionId;
              const count = countSectionElements(section);
              return (
                <button
                  key={section.id}
                  type="button"
                  title={section.label + " - " + count + " elementos"}
                  onClick={() => { scrollToSection(section); setSelectedIds([]); }}
                  style={{
                    width: 136,
                    minWidth: 136,
                    height: 82,
                    borderRadius: 14,
                    border: active ? "1px solid #c8a96a" : "1px solid #2a2a3d",
                    background: active ? "rgba(200,169,106,0.14)" : "#1b1b28",
                    color: active ? "#f4d28a" : "#b3aecf",
                    cursor: "pointer",
                    padding: 8,
                    display: "grid",
                    gridTemplateColumns: "44px 1fr",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: active ? "0 10px 24px rgba(200,169,106,0.12)" : "none",
                    fontFamily: "Inter, system-ui, sans-serif",
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    width: 44,
                    height: 58,
                    borderRadius: 8,
                    background: section.background,
                    border: "1px solid rgba(255,255,255,0.10)",
                    boxShadow: "inset 0 0 22px rgba(0,0,0,0.3)",
                  }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 850, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {section.label}
                    </span>
                    <span style={{ display: "block", marginTop: 6, fontSize: 10, color: active ? "#fff0c2" : "#6f6b8f" }}>
                      {count} elementos
                    </span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              title="Agregar sección"
              onClick={addDemoSection}
              style={{
                width: 112,
                minWidth: 112,
                height: 82,
                borderRadius: 14,
                border: "1px dashed rgba(124,58,237,0.65)",
                background: "rgba(124,58,237,0.12)",
                color: "#c4b5fd",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 850,
                letterSpacing: "0.04em",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              + Sección
            </button>
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
              sectionElements={preview ? [] : getSectionElements(activeSectionId)}
              selectedIds={selectedIds}
              onSelectLayer={(id, shift) => {
                const expanded = expandSelectionWithGroups([id]);
                if (shift) {
                  setSelectedIds((prev) => {
                    const expandedSet = new Set(expanded);
                    const allSelected = expanded.every((expandedId) => prev.includes(expandedId));
                    return allSelected
                      ? prev.filter((sid) => !expandedSet.has(sid))
                      : Array.from(new Set([...prev, ...expanded]));
                  });
                } else {
                  setSelectedIds(expanded);
                }
              }}
              onToggleVisible={toggleLayerVisible}
              onToggleLocked={toggleLayerLocked}
              onLayerMoveUp={layerMoveUp}
              onLayerMoveDown={layerMoveDown}
              onReorderLayers={reorderLayers}
              eventDate={eventDate}
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
            Propiedades
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
