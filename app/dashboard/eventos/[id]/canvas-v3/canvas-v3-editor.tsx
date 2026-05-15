"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCanvasDesignV3 } from "./actions";
import { applyCanvasV3TemplateToEvent } from "@/app/dashboard/canvas-v3/templates/actions";
import {
  CANVAS_V3_THEMES,
  DEFAULT_CANVAS_V3_THEME_ID,
  getCanvasV3Theme,
  type CanvasV3Theme
} from "./themes-v3";
import { eventHasFeature, type EventFeatureKey } from "@/lib/event-features";
import { hydrateCanvasV3Template } from "@/lib/canvas-v3/templates";
import type { CanvasV3Design as SharedCanvasV3Design, CanvasV3EventData } from "@/lib/canvas-v3/initial-design";
import type { CeremonySectionKind, CeremonySemanticRole } from "@/lib/canvas-v3/ceremonial-structures";

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
  verticalAlign?: "top" | "center" | "bottom";
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
  semanticRole?: CeremonySemanticRole;
  dataKey?: keyof CanvasV3EventData;
  lockedContent?: boolean;
  config?: {
    url?: string;
    primaryColor?: string;
    color?: string;
    accentColor?: string;
    effect?: "soft-card" | "glow-circle" | "rose-soft" | "spark" | "soft-glow" | "editorial-line" | "dots" | "ambient-glow" | "cinematic-haze" | "gold-contamination" | "blue-ambient-light" | "editorial-fog";
    intensity?: number;
    darkness?: number;
    blendWithBackground?: boolean;
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
  kind?: CeremonySectionKind;
  required?: boolean;
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
  | "atmosphere"
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

type ElementContextMenuState = {
  elementId: string;
  x: number;
  y: number;
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
    content: "Tu evento",
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
    content: "Fecha por confirmar",
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
    content: "Celebremos juntos un momento inolvidable.\nTu presencia es muy importante.",
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
    (typeof value.height === "number" || value.height === null || value.height === undefined) &&
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

  const validElements = value.elements.filter(isV3Element);
  if (validElements.length !== value.elements.length) return null;
  const elements = validElements.map((element) => ({
    ...element,
    height: element.height ?? null,
  }));
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
  whatsapp: { label: "Enviar WhatsApp", icon: "💬" },
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
  whatsapp: { content: "Enviar WhatsApp", width: 320, height: 86, background: "linear-gradient(160deg,#0d3d21 0%,#1a6b3a 100%)", color: "#e8f5ee", borderRadius: 20, url: "https://wa.me/" },
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

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const raw = color.trim().replace("#", "");
  const normalized = raw.length === 3
    ? raw.split("").map((part) => part + part).join("")
    : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function colorWithAlpha(color: string | undefined, alpha: number, fallback: string): string {
  if (!color) return fallback;
  const rgb = hexToRgb(color);
  if (!rgb) return fallback;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function clamp01(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function shouldBlendDecoration(el: Pick<V3Element, "type" | "config">): boolean {
  return el.type === "decoration" && Boolean(el.config?.effect && el.config.blendWithBackground);
}

function buildDecorationBackground(el: Pick<V3Element, "background" | "config">): string | undefined {
  const effect = el.config?.effect;
  if (!effect) return el.background;
  const color = el.config?.color ?? el.config?.primaryColor ?? "#b8925a";
  const accent = el.config?.accentColor ?? "#fffaf2";
  const intensity = clamp01(el.config?.intensity, 1);
  const darkness = clamp01(el.config?.darkness, 0);
  const blend = el.config?.blendWithBackground === true;
  const alpha = (value: number) => Math.min(1, Math.max(0, value * intensity * (blend ? 0.68 : 1) * (1 - darkness * 0.22)));
  const c90 = colorWithAlpha(color, alpha(0.90), "rgba(184,146,90,0.90)");
  const c66 = colorWithAlpha(color, alpha(0.66), "rgba(184,146,90,0.66)");
  const c50 = colorWithAlpha(color, alpha(0.50), "rgba(184,146,90,0.50)");
  const c44 = colorWithAlpha(color, alpha(0.44), "rgba(184,146,90,0.44)");
  const c32 = colorWithAlpha(color, alpha(0.32), "rgba(184,146,90,0.32)");
  const c22 = colorWithAlpha(color, alpha(0.22), "rgba(184,146,90,0.22)");
  const c18 = colorWithAlpha(color, alpha(0.18), "rgba(184,146,90,0.18)");
  const c14 = colorWithAlpha(color, alpha(0.14), "rgba(184,146,90,0.14)");
  const c10 = colorWithAlpha(color, alpha(0.10), "rgba(184,146,90,0.10)");
  const c06 = colorWithAlpha(color, alpha(0.06), "rgba(184,146,90,0.06)");
  const c04 = colorWithAlpha(color, alpha(0.04), "rgba(184,146,90,0.04)");
  const a72 = colorWithAlpha(accent, alpha(0.72), "rgba(255,252,247,0.72)");
  const a34 = colorWithAlpha(accent, alpha(0.34), "rgba(37,99,235,0.34)");
  const a22 = colorWithAlpha(accent, alpha(0.22), "rgba(37,99,235,0.22)");
  const a16 = colorWithAlpha(accent, alpha(0.16), "rgba(37,99,235,0.16)");
  const a10 = colorWithAlpha(accent, alpha(0.10), "rgba(37,99,235,0.10)");
  const a06 = colorWithAlpha(accent, alpha(0.06), "rgba(37,99,235,0.06)");
  const d28 = colorWithAlpha("#000000", darkness * 0.28, "rgba(0,0,0,0)");
  const d14 = colorWithAlpha("#000000", darkness * 0.14, "rgba(0,0,0,0)");
  const darkOverlay = darkness > 0 ? `linear-gradient(180deg,${d28},${d14}),` : "";
  const blendHaze = blend ? `radial-gradient(118% 92% at 18% 28%,${c04} 0%,transparent 84%),radial-gradient(96% 108% at 82% 64%,${a06} 0%,transparent 88%),` : "";
  const texture = "repeating-linear-gradient(180deg,rgba(255,255,255,0.018) 0 1px,transparent 1px 3px)";

  if (effect === "soft-card") return `${darkOverlay}${blendHaze}radial-gradient(110% 72% at 78% 92%,${a10} 0%,transparent 70%),radial-gradient(92% 64% at 42% 18%,rgba(255,255,255,${0.055 * intensity}) 0%,transparent 58%),linear-gradient(180deg,rgba(34,36,42,${0.62 * intensity}),rgba(8,12,27,${0.92 - darkness * 0.12})),${texture}`;
  if (effect === "glow-circle") return `${darkOverlay}${blendHaze}radial-gradient(36% 28% at 30% 23%,${a72} 0%,rgba(255,255,255,${0.20 * intensity}) 18%,transparent 38%),radial-gradient(84% 84% at 48% 48%,rgba(255,255,255,${0.045 * intensity}) 0%,transparent 48%),radial-gradient(116% 116% at 50% 50%,${c22} 0%,rgba(31,32,37,${0.78 + darkness * 0.14}) 58%,rgba(5,8,18,0.96) 100%),${texture}`;
  if (effect === "rose-soft") return `${darkOverlay}${blendHaze}radial-gradient(18% 12% at 45% 25%,${a72} 0%,rgba(255,255,255,${0.18 * intensity}) 34%,transparent 58%),conic-gradient(from 18deg at 50% 50%,rgba(17,18,30,0.94),${c22},rgba(96,55,94,${0.42 * intensity}),rgba(18,18,31,0.86),${c14},rgba(9,11,21,0.96)),radial-gradient(112% 112% at 50% 50%,transparent 42%,rgba(0,0,0,${0.40 + darkness * 0.18}) 100%),${texture}`;
  if (effect === "spark") return `${darkOverlay}${blendHaze}linear-gradient(86deg,transparent 0 42%,rgba(255,255,255,${0.52 * intensity}) 48%,rgba(255,255,255,${0.18 * intensity}) 52%,transparent 59%),linear-gradient(82deg,transparent 0 36%,${c50} 47%,${c18} 55%,transparent 68%),radial-gradient(96% 96% at 50% 50%,rgba(255,255,255,${0.055 * intensity}) 0%,rgba(13,16,25,0.84) 58%,rgba(3,6,15,0.97) 100%),${texture}`;
  if (effect === "soft-glow") return `${darkOverlay}${blendHaze}radial-gradient(44% 58% at 28% 25%,${a72} 0%,rgba(255,255,255,${0.18 * intensity}) 22%,transparent 46%),radial-gradient(94% 112% at 50% 52%,${c18} 0%,rgba(23,27,37,0.76) 54%,rgba(4,8,18,0.96) 100%),radial-gradient(82% 104% at 76% 72%,${a06} 0%,transparent 78%),${texture}`;
  if (effect === "editorial-line") return `${darkOverlay}${blendHaze}linear-gradient(90deg,transparent 0%,${c18} 18%,${c66} 50%,${c18} 82%,transparent 100%),linear-gradient(180deg,transparent 0 36%,${a72} 44%,${c90} 50%,${a72} 56%,transparent 64% 100%)`;
  if (effect === "dots") return `${darkOverlay}${blendHaze}radial-gradient(circle at 14% 50%,${c44} 0 4px,transparent ${blend ? 9 : 6}px),radial-gradient(circle at 38% 50%,${c66} 0 5px,transparent ${blend ? 10 : 7}px),radial-gradient(circle at 62% 50%,${c66} 0 5px,transparent ${blend ? 10 : 7}px),radial-gradient(circle at 86% 50%,${c44} 0 4px,transparent ${blend ? 9 : 6}px),radial-gradient(ellipse at 50% 50%,${c10},transparent ${blend ? 88 : 72}%)`;
  if (effect === "ambient-glow") return `radial-gradient(70% 62% at 42% 46%,${c18} 0%,${c10} 24%,transparent 58%),radial-gradient(92% 82% at 58% 52%,${a10} 0%,transparent 70%),radial-gradient(118% 112% at 50% 50%,rgba(13,17,28,${0.18 * intensity}) 0%,transparent 82%)`;
  if (effect === "cinematic-haze") return `radial-gradient(76% 64% at 52% 48%,${a16} 0%,${a06} 42%,transparent 78%),radial-gradient(112% 96% at 48% 52%,rgba(15,29,74,${0.28 * intensity}) 0%,rgba(8,13,31,${0.12 * intensity}) 58%,transparent 86%)`;
  if (effect === "gold-contamination") return `radial-gradient(74% 58% at 34% 28%,${c22} 0%,${c10} 34%,transparent 76%),radial-gradient(96% 82% at 50% 50%,rgba(99,82,33,${0.10 * intensity}) 0%,transparent 82%),radial-gradient(58% 44% at 72% 70%,${a06} 0%,transparent 84%)`;
  if (effect === "blue-ambient-light") return `radial-gradient(62% 58% at 44% 46%,rgba(185,156,77,${0.10 * intensity}) 0%,rgba(185,156,77,${0.055 * intensity}) 28%,transparent 58%),radial-gradient(86% 78% at 56% 52%,${a22} 0%,${a16} 38%,${a06} 66%,transparent 88%),radial-gradient(122% 104% at 50% 50%,rgba(28,41,92,${0.24 * intensity}) 0%,rgba(19,28,67,${0.14 * intensity}) 48%,transparent 82%)`;
  if (effect === "editorial-fog") return `radial-gradient(110% 78% at 54% 72%,${a10} 0%,transparent 72%),radial-gradient(92% 72% at 22% 18%,rgba(255,255,255,${0.028 * intensity}) 0%,transparent 62%),radial-gradient(120% 90% at 52% 50%,rgba(10,15,31,${0.16 * intensity}) 0%,transparent 84%)`;
  return el.background;
}

function getDecorationBlendMode(effect?: NonNullable<V3Element["config"]>["effect"]): React.CSSProperties["mixBlendMode"] | undefined {
  if (!effect) return undefined;
  if (effect === "soft-card" || effect === "cinematic-haze" || effect === "editorial-fog") return "soft-light";
  return "screen";
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

function estimateElementRenderHeight(el: V3Element): number {
  if (el.height != null) return el.height;
  if (el.type === "app") return 88;
  if (!el.content) return 60;

  const fontSize = el.fontSize ?? 14;
  const isScript = isScriptFont(el.fontFamily);
  const lineHeight = Math.max(typeof el.lineHeight === "number" ? el.lineHeight : 1.4, isScript ? 1.24 : 1.1);
  const approxCharWidth = Math.max(6, fontSize * 0.56);
  const charsPerLine = Math.max(8, Math.floor(el.width / approxCharWidth));
  const visualLines = el.content.split("\n").reduce((total, line) => {
    const clean = line.trim();
    return total + Math.max(1, Math.ceil(clean.length / charsPerLine));
  }, 0);
  const padding = el.type === "decoration" ? 32 : getTextVerticalPadding(el) * 2;

  return Math.max(24, Math.ceil(visualLines * fontSize * lineHeight + padding));
}

function isScriptFont(fontFamily?: string): boolean {
  const family = (fontFamily ?? "").toLowerCase();
  return ["script", "vibes", "caveat", "dancing", "baloo", "fredoka"].some((token) => family.includes(token));
}

function getTextVerticalPadding(el: Pick<V3Element, "fontSize" | "fontFamily" | "type">): number {
  const fontSize = el.fontSize ?? 14;
  const scriptExtra = isScriptFont(el.fontFamily) ? 0.18 : 0.1;
  return el.type === "decoration" ? 16 : Math.max(4, Math.ceil(fontSize * scriptExtra));
}

function getVerticalJustifyContent(value?: V3Element["verticalAlign"]): React.CSSProperties["justifyContent"] {
  if (value === "bottom") return "flex-end";
  if (value === "center") return "center";
  return "flex-start";
}

type AlignmentIconKind = "left" | "center" | "right" | "top" | "middle" | "bottom";

function AlignmentIcon({ kind }: { kind: AlignmentIconKind }) {
  const stroke = "currentColor";
  const line = {
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
  };
  const guide = {
    stroke,
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
    opacity: 0.44,
  };

  if (kind === "left") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3 3.5h9.5M3 6.7h6.8M3 9.9h9.5M3 13.1h5.6" {...line} />
      </svg>
    );
  }

  if (kind === "center") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3.2 3.5h9.6M5 6.7h6M3.2 9.9h9.6M5.8 13.1h4.4" {...line} />
      </svg>
    );
  }

  if (kind === "right") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3.5 3.5H13M6.2 6.7H13M3.5 9.9H13M7.4 13.1H13" {...line} />
      </svg>
    );
  }

  if (kind === "top") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4 3h8" {...guide} />
        <path d="M5.2 5.3h5.6M6.1 8h3.8M4.6 10.7h6.8" {...line} />
      </svg>
    );
  }

  if (kind === "middle") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3.5 8h9" {...guide} />
        <path d="M5.4 4.9h5.2M4.7 8h6.6M5.8 11.1h4.4" {...line} />
      </svg>
    );
  }

  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 13h8" {...guide} />
      <path d="M4.6 5.3h6.8M6.1 8h3.8M5.2 10.7h5.6" {...line} />
    </svg>
  );
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
  onContextMenu,
  onResizeMouseDown,
  onInlineTextCommit,
  onReplaceImage,
  onEditQr,
  // Section clip values: how many px the element overflows its section top/bottom.
  // Applied only to the visual content layer — handles and toolbar remain unclipped.
  clipTop = 0,
  clipBottom = 0,
}: {
  el: V3Element;
  selected: boolean;
  highlighted?: boolean; // true when part of a multi-selection (no handles, just outline)
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent, handle: string) => void;
  onInlineTextCommit?: (content: string) => void;
  onReplaceImage?: () => void;
  onEditQr?: () => void;
  clipTop?: number;
  clipBottom?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineDraft, setInlineDraft] = useState(el.content ?? "");
  const renderHeight = estimateElementRenderHeight(el);
  const elementLooksLikeImage = el.type !== "app" && (el.config?.url || /\burl\(/i.test(el.background ?? ""));
  const elementIsQr = el.type === "app" && normalizeAppType(el) === "qr";
  const elementIsTextLike = el.type === "text" || Boolean(el.content && el.type !== "app");
  const visualBackground = buildDecorationBackground(el);
  const blendDecoration = shouldBlendDecoration(el);

  useEffect(() => {
    if (!isInlineEditing) setInlineDraft(el.content ?? "");
  }, [el.content, isInlineEditing]);

  const commitInlineEditing = () => {
    if (!isInlineEditing) return;
    const next = inlineDraft;
    setIsInlineEditing(false);
    if (next !== (el.content ?? "")) onInlineTextCommit?.(next);
  };

  const cancelInlineEditing = () => {
    setInlineDraft(el.content ?? "");
    setIsInlineEditing(false);
  };

  const runContextualDoubleAction = () => {
    if (el.locked) return;
    if (elementIsTextLike) {
      setInlineDraft(el.content ?? "");
      setIsInlineEditing(true);
    } else if (elementLooksLikeImage) {
      onReplaceImage?.();
    } else if (elementIsQr) {
      onEditQr?.();
    }
  };
  const isAppElement = el.type === "app";
  const isTextElement = el.type === "text" || (Boolean(el.content) && el.type !== "app");
  const isAtmosphericDecoration = el.type === "decoration" && blendDecoration;
  const selectionColor = isAppElement
    ? "rgba(96,116,255,0.72)"
    : isTextElement
    ? "rgba(184,146,90,0.78)"
    : isAtmosphericDecoration
    ? "rgba(255,255,255,0.22)"
    : "rgba(184,146,90,0.58)";
  const hoverColor = isAppElement
    ? "rgba(96,116,255,0.30)"
    : isAtmosphericDecoration
    ? "rgba(255,255,255,0.12)"
    : "rgba(184,146,90,0.28)";

  // ── Outer positioning div ─────────────────────────────────────────────────
  // Always overflow: visible so resize handles (-4px) and toolbar (-32px) show.
  // Border and borderRadius live on the inner content wrapper (so they get clipped too).
  const outerStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: renderHeight,
    zIndex: el.zIndex,
    opacity: el.opacity ?? 1,
    cursor: el.locked ? "default" : (selected || highlighted) ? "grab" : "pointer",
    userSelect: "none",
    overflow: "visible",
    // selection / hover ring — stays on outer so it's always fully visible
    outline: selected
      ? `${isAtmosphericDecoration ? 1 : 1.2}px solid ${selectionColor}`
      : isHovered
      ? `1px solid ${hoverColor}`
      : undefined,
    outlineOffset: isAtmosphericDecoration ? "7px" : "3px",
    boxShadow: highlighted && !selected
      ? "0 0 0 1px rgba(184,146,90,0.42), 0 0 0 5px rgba(184,146,90,0.08)"
      : selected
      ? isAppElement
        ? "0 0 0 4px rgba(96,116,255,0.08), 0 10px 26px rgba(8,12,28,0.12)"
        : isAtmosphericDecoration
        ? "0 0 0 10px rgba(255,255,255,0.025), 0 0 32px rgba(255,255,255,0.055)"
        : "0 0 0 4px rgba(184,146,90,0.075), 0 8px 22px rgba(45,28,18,0.10)"
      : isHovered
      ? isAtmosphericDecoration
        ? "0 0 24px rgba(255,255,255,0.045)"
        : "0 8px 18px rgba(42,28,18,0.055)"
      : undefined,
    transition: "outline-color 0.16s ease, outline-offset 0.16s ease, box-shadow 0.16s ease",
  };

  // ── Inner content wrapper — clipped to section boundaries ─────────────────
  // clipPath clips anything that overflows section top or bottom.
  // border + borderRadius live here so they're clipped too (no border bleed).
  const hasClip = clipTop > 0 || clipBottom > 0;
  const contentStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: el.borderRadius,
    border: blendDecoration ? undefined : computeBorder(el),
    overflow: "hidden",
    clipPath: hasClip ? `inset(${clipTop}px 0px ${clipBottom}px 0px)` : undefined,
  };

  const handleSize = isAtmosphericDecoration ? 5 : 6;
  const handleOffset = isAtmosphericDecoration ? 9 : 6;
  const handles = ["tl", "t", "tr", "r", "br", "b", "bl", "l"];
  const handlePositions: Record<string, React.CSSProperties> = {
    tl: { top: -handleOffset, left: -handleOffset,                        cursor: "nwse-resize" },
    t:  { top: -handleOffset, left: "50%", marginLeft: -handleSize / 2,     cursor: "ns-resize"   },
    tr: { top: -handleOffset, right: -handleOffset,                       cursor: "nesw-resize" },
    r:  { top: "50%", right: -handleOffset, marginTop: -handleSize / 2,     cursor: "ew-resize"   },
    br: { bottom: -handleOffset, right: -handleOffset,                    cursor: "nwse-resize" },
    b:  { bottom: -handleOffset, left: "50%", marginLeft: -handleSize / 2,  cursor: "ns-resize"   },
    bl: { bottom: -handleOffset, left: -handleOffset,                     cursor: "nesw-resize" },
    l:  { top: "50%", left: -handleOffset, marginTop: -handleSize / 2,      cursor: "ew-resize"   },
  };
  const textVerticalPadding = getTextVerticalPadding(el);
  const effectiveLineHeight = Math.max(el.lineHeight ?? 1.4, isScriptFont(el.fontFamily) ? 1.24 : 1.1);

  return (
    <div
      style={outerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.button === 0 && e.detail >= 2) {
          e.preventDefault();
          runContextualDoubleAction();
          return;
        }
        onMouseDown(e);
      }}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onContextMenu?.(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        runContextualDoubleAction();
      }}
    >
      {/* ── Visual content — clipped to section boundaries ── */}
      <div style={contentStyle}>
        {/* Background fill */}
        {visualBackground && (
          <div
            style={{
              position: "absolute", inset: 0,
              background: visualBackground,
              borderRadius: el.borderRadius,
              mixBlendMode: blendDecoration ? getDecorationBlendMode(el.config?.effect) : undefined,
              opacity: blendDecoration ? 0.92 : undefined,
              backdropFilter: el.blur ? `blur(${el.blur}px)` : undefined,
            }}
          />
        )}

        {/* Text content */}
        {el.content && el.type !== "app" && !isInlineEditing && (
          <p
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: getVerticalJustifyContent(el.verticalAlign),
              margin: 0,
              padding: el.type === "decoration" ? "16px 20px" : `${textVerticalPadding}px 0`,
              fontFamily: el.fontFamily ?? "Inter, system-ui, sans-serif",
              fontSize: el.fontSize ?? 14,
              fontWeight: el.fontWeight ?? "400",
              fontStyle: el.fontStyle ?? "normal",
              textAlign: el.textAlign ?? "center",
              color: el.color ?? "#ffffff",
              lineHeight: effectiveLineHeight,
              letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : undefined,
              textShadow: el.textShadow ?? undefined,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <span>{el.content}</span>
          </p>
        )}

        {isInlineEditing && elementIsTextLike && (
          <textarea
            autoFocus
            value={inlineDraft}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onChange={(event) => setInlineDraft(event.target.value)}
            onBlur={commitInlineEditing}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commitInlineEditing();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelInlineEditing();
              }
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              margin: 0,
              padding: el.type === "decoration" ? "16px 20px" : `${textVerticalPadding}px 0`,
              border: "1px solid rgba(184,146,90,0.34)",
              outline: "2px solid rgba(184,146,90,0.16)",
              borderRadius: Math.max(6, el.borderRadius ?? 8),
              resize: "none",
              background: "rgba(255,252,247,0.14)",
              color: el.color ?? "#ffffff",
              fontFamily: el.fontFamily ?? "Inter, system-ui, sans-serif",
              fontSize: el.fontSize ?? 14,
              fontWeight: el.fontWeight ?? "400",
              fontStyle: el.fontStyle ?? "normal",
              textAlign: el.textAlign ?? "center",
              lineHeight: effectiveLineHeight,
              letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : undefined,
              textShadow: el.textShadow ?? undefined,
              whiteSpace: "pre-wrap",
              overflow: "auto",
              boxSizing: "border-box",
            }}
          />
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
            ) : normalizeAppType(el) === "whatsapp" ? (
              /* ── WhatsApp premium render ──────────────────────────────────── */
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", width: "100%", justifyContent: "center", boxSizing: "border-box" }}>
                <span style={{ fontSize: 22, lineHeight: 1, filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.28))", flexShrink: 0 }}>💬</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{
                    color: el.color ?? "#e8f5ee",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: "600",
                    letterSpacing: "0.03em",
                    lineHeight: 1.2,
                  }}>{el.content || "Enviar WhatsApp"}</span>
                  <span style={{
                    color: el.color ?? "#e8f5ee",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 10,
                    fontWeight: "400",
                    opacity: 0.60,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                  }}>Abrir en WhatsApp →</span>
                </div>
              </div>
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
      </div>{/* end visual content wrapper */}

      {/* ── Resize handles — outside clip so they always show ── */}
      {selected && !el.locked && handles.map((h) => (
        <div
          key={h}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeMouseDown(e, h); }}
          onMouseEnter={(e) => {
            const d = e.currentTarget as HTMLDivElement;
            d.style.transform = "scale(1.38)";
            d.style.background = isAppElement ? "#eef1ff" : "#fff9ee";
            d.style.borderColor = isAppElement ? "rgba(96,116,255,0.82)" : "rgba(184,146,90,0.82)";
          }}
          onMouseLeave={(e) => {
            const d = e.currentTarget as HTMLDivElement;
            d.style.transform = "scale(1)";
            d.style.background = "rgba(255,255,255,0.92)";
            d.style.borderColor = selectionColor;
          }}
          style={{
            position: "absolute",
            width: handleSize,
            height: handleSize,
            background: "rgba(255,255,255,0.92)",
            border: `1px solid ${selectionColor}`,
            borderRadius: 999,
            boxShadow: isAtmosphericDecoration
              ? "0 0 0 2px rgba(5,8,18,0.34), 0 0 14px rgba(255,255,255,0.16)"
              : "0 1px 7px rgba(36,24,18,0.16), 0 0 0 2px rgba(255,255,255,0.72)",
            zIndex: 9999,
            transition: "transform 0.14s ease, background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease",
            opacity: isAtmosphericDecoration ? 0.76 : 0.94,
            ...handlePositions[h],
          }}
        />
      ))}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium templates
// ─────────────────────────────────────────────────────────────────────────────

type PremiumTemplateHydrationContext = {
  eventTitle: string;
  eventDate?: string;
  googleMapsLink?: string | null;
  whatsappPhone?: string | null;
};

function cleanText(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function getElementText(elements: V3Element[], ids: string[]): string {
  for (const id of ids) {
    const text = cleanText(elements.find((el) => el.id === id)?.content);
    if (text) return text;
  }
  return "";
}

function getElementConfigUrl(elements: V3Element[], appType: V3AppType): string {
  const element = elements.find((el) => el.type === "app" && normalizeAppType(el) === appType);
  return cleanText(element?.config?.url);
}

function splitEventName(name: string): { firstLine: string; secondLine: string } {
  const parts = cleanText(name).split(" ").filter(Boolean);
  if (parts.length <= 1) return { firstLine: parts[0] ?? "Tu nombre", secondLine: "MIS QUINCE ANOS" };
  return { firstLine: parts.slice(0, 2).join(" "), secondLine: parts.slice(2).join(" ").toUpperCase() || "MIS QUINCE ANOS" };
}

function parseEventDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTemplateDateLine(value?: string): string {
  const parsed = parseEventDate(value);
  if (!parsed) return "Fecha por confirmar";
  const day = new Intl.DateTimeFormat("es-PY", { day: "numeric" }).format(parsed);
  const month = new Intl.DateTimeFormat("es-PY", { month: "long" }).format(parsed);
  const year = new Intl.DateTimeFormat("es-PY", { year: "numeric" }).format(parsed);
  const time = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
  return `${day} de ${month} . ${year} . ${time} hs`;
}

function formatTemplateDateCompact(value?: string): string {
  const parsed = parseEventDate(value);
  if (!parsed) return "FECHA POR CONFIRMAR";
  const day = new Intl.DateTimeFormat("es-PY", { day: "2-digit" }).format(parsed);
  const month = new Intl.DateTimeFormat("es-PY", { month: "long" }).format(parsed).toUpperCase();
  const year = new Intl.DateTimeFormat("es-PY", { year: "numeric" }).format(parsed);
  return `${day} . ${month} . ${year}`;
}

function splitEventDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date = "", rawTime = ""] = value.split("T");
  return { date, time: rawTime.slice(0, 5) };
}

function createTemplateHydrationEventData({
  eventId,
  eventSlug,
  eventTitle,
  eventDate,
  googleMapsLink,
  whatsappPhone,
  packageKey,
  currentDesign,
}: {
  eventId: string;
  eventSlug?: string;
  eventTitle: string;
  eventDate?: string;
  googleMapsLink?: string | null;
  whatsappPhone?: string | null;
  packageKey?: string | null;
  currentDesign: CanvasV3Design;
}): CanvasV3EventData {
  const { date, time } = splitEventDateTime(eventDate);
  const currentElements = currentDesign.elements;
  const eventName = getElementText(currentElements, ["hero-title", "presentation-title", "footer-title", "s1-name", "s3-name1", "s8-name"]) || eventTitle;
  const mainMessage = getElementText(currentElements, ["quince-message", "hero-message", "main-message", "s4-message"]);
  const parents = getElementText(currentElements, ["parents-message", "s3-parents"])
    .replace(/^Junto a mis padres\s*/i, "")
    .trim();
  const churchDetails = getElementText(currentElements, ["church-details", "church-title", "s6-venue"]);
  const address = getElementText(currentElements, ["event-address", "details-address", "s6-address"]);
  const dressDetails = getElementText(currentElements, ["dress-details", "dress-code", "s5-hint"]);
  return {
    id: eventId,
    slug: eventSlug ?? eventId,
    event_type: "otro",
    title: eventTitle,
    hosts_names: eventTitle,
    event_date: date,
    event_time: time,
    address,
    google_maps_link: googleMapsLink ?? null,
    main_message: mainMessage || null,
    quinceanera_name: eventName,
    parents_names: parents || null,
    church_name: churchDetails || null,
    church_time: null,
    dress_code: dressDetails || null,
    color_palette: null,
    theme: null,
    quince_message: mainMessage || null,
    parents_message: null,
    graduate_name: null,
    graduation_type: null,
    institution_name: null,
    academic_program: null,
    degree_title: null,
    promotion_name: null,
    academic_ceremony_place: null,
    academic_ceremony_time: null,
    reception_place: null,
    reception_time: null,
    family_message: null,
    graduate_message: null,
    whatsapp_phone: whatsappPhone ?? null,
    package_key: (packageKey ?? "essential") as CanvasV3EventData["package_key"],
    canvas_design: currentDesign as unknown as CanvasV3EventData["canvas_design"],
  };
}

function hydratePremiumTemplateElements(
  templateElements: V3Element[],
  currentElements: V3Element[],
  context: PremiumTemplateHydrationContext
): V3Element[] {
  const eventName = getElementText(currentElements, ["hero-title", "presentation-title", "footer-title", "s1-name", "s3-name1", "s8-name"]) || context.eventTitle;
  const { firstLine, secondLine } = splitEventName(eventName);
  const churchDetails = getElementText(currentElements, ["church-details", "church-title", "s6-venue"]);
  const mapsUrl = context.googleMapsLink || getElementConfigUrl(currentElements, "maps");
  const whatsappUrl = context.whatsappPhone
    ? `https://wa.me/${context.whatsappPhone.replace(/\D/g, "")}`
    : getElementConfigUrl(currentElements, "whatsapp");
  const dateLine = getElementText(currentElements, ["event-date-time", "s2-date", "s6-date"]) || formatTemplateDateLine(context.eventDate);
  const dateCompact = getElementText(currentElements, ["hero-date", "s1-date"]) || formatTemplateDateCompact(context.eventDate);

  return templateElements.map((element) => {
    const id = element.id;
    const contentFor = (content: string, visible = true): V3Element => ({ ...element, content, visible });

    if (id.includes("-s1-name-")) return contentFor(firstLine);
    if (id.includes("-s1-last-")) return contentFor(secondLine);
    if (id.includes("-s1-date-")) return contentFor(dateCompact);
    if (id.includes("-s2-date-") || id.includes("-s6-date-")) return contentFor(dateLine);
    if (id.includes("-s3-name2-")) return contentFor(secondLine === "MIS QUINCE ANOS" ? "" : secondLine, secondLine !== "MIS QUINCE ANOS");
    if (id.includes("-s4-signature-")) return contentFor(`Con carino, ${eventName}`);
    if (id.includes("-s5-style-")) return contentFor("Dress code");
    if (id.includes("-s5-swatch-label-")) return contentFor("Paleta del evento");
    if (id.includes("-s6-eye-")) return contentFor(churchDetails ? "MISA Y UBICACION" : "UBICACION");

    if (element.type === "app" && normalizeAppType(element) === "countdown" && context.eventDate) {
      return {
        ...element,
        config: { ...element.config, countdownMode: "event", countdownTarget: context.eventDate }
      };
    }
    if (element.type === "app" && normalizeAppType(element) === "maps" && mapsUrl) {
      return { ...element, config: { ...element.config, url: mapsUrl } };
    }
    if (element.type === "app" && normalizeAppType(element) === "whatsapp") {
      return { ...element, visible: Boolean(whatsappUrl), config: { ...element.config, url: whatsappUrl } };
    }

    return element;
  });
}

const PREMIUM_TEMPLATES: PremiumTemplate[] = [
  {
    id: "glam-rosa",
    label: "Glam Rosa",
    emoji: "R",
    category: "Quinceanos",
    description: "Limpia, romantica y premium. Ivory calido, rosa empolvado, champagne, mauve suave y oro antiguo.",
    themeId: "floral-rose",
    previewGradient: "linear-gradient(135deg,#fff8f0 0%,#f4d4d9 44%,#ead9c4 100%)",
    create: () => {
      const stamp = Date.now();
      let zCounter = 1;
      const z = () => zCounter++;
      const mkId = (name: string) => "gr-" + name + "-" + stamp;
      const W = 390;
      const cx = (w: number) => Math.round((W - w) / 2);

      const IVORY = "#fff8f0";
      const CARD = "rgba(255,252,247,0.96)";
      const BLUSH = "#e9b9c1";
      const ROSE = "#c87583";
      const MAUVE = "#8a4f63";
      const MAUVE_SOFT = "#b9899a";
      const GOLD = "#b8925a";
      const GOLD_SOFT = "#d7b77e";
      const TEXT = "#35222b";
      const TEXT_MUTED = "#7b5f66";
      const LAVENDER = "#c9b3c9";

      const goldLine = (alpha = "") => "linear-gradient(90deg,transparent," + GOLD_SOFT + alpha + ",transparent)";

      const mkShape = (name: string, x: number, y: number, w: number, h: number, bg: string, extra: Partial<V3Element> = {}): V3Element => ({
        id: mkId(name),
        type: "shape",
        x,
        y,
        width: w,
        height: h,
        locked: false,
        visible: true,
        zIndex: z(),
        background: bg,
        opacity: 1,
        borderRadius: 0,
        ...extra,
      });

      const mkText = (name: string, content: string, x: number, y: number, w: number, h: number | null, extra: Partial<V3Element> = {}): V3Element => ({
        id: mkId(name),
        type: "text",
        x,
        y,
        width: w,
        height: h,
        locked: false,
        visible: true,
        zIndex: z(),
        content,
        fontSize: 14,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: "400",
        color: TEXT,
        textAlign: "center",
        lineHeight: 1.35,
        letterSpacing: 0,
        textShadow: "none",
        ...extra,
      });

      const mkApp = (name: string, appType: V3AppType, content: string, x: number, y: number, w: number, h: number, extra: Partial<V3Element> = {}): V3Element => ({
        id: mkId(name),
        type: "app",
        x,
        y,
        width: w,
        height: h,
        locked: false,
        visible: true,
        zIndex: z(),
        appKind: appType,
        appType,
        semanticRole: appType === "countdown"
          ? "countdown"
          : appType === "maps"
            ? "maps_link"
            : appType === "rsvp"
              ? "rsvp_action"
              : appType === "whatsapp"
                ? "whatsapp_action"
                : undefined,
        dataKey: appType === "countdown"
          ? "event_date"
          : appType === "maps"
            ? "google_maps_link"
            : appType === "whatsapp"
              ? "whatsapp_phone"
              : appType === "rsvp"
                ? "package_key"
                : undefined,
        lockedContent: true,
        content,
        background: "linear-gradient(135deg," + ROSE + "," + MAUVE + ")",
        color: IVORY,
        borderRadius: 18,
        opacity: 1,
        config: { url: "", primaryColor: ROSE, textColor: IVORY },
        ...extra,
      });

      const sections: V3Section[] = [
        { id: mkId("s1"), label: "Portada", y: 0, height: 780, background: "linear-gradient(180deg,#fff8f0 0%,#f7eadc 58%,#f1dccd 100%)", kind: "hero", required: true },
        { id: mkId("s2"), label: "Cuenta regresiva", y: 780, height: 400, background: "linear-gradient(180deg,#f1dccd,#fff8f0)", kind: "countdown", required: true },
        { id: mkId("s3"), label: "Presentacion", y: 1180, height: 540, background: "linear-gradient(180deg,#fff8f0,#fffdf9,#f7eadc)", kind: "person_presentation", required: true },
        { id: mkId("s4"), label: "Mensaje especial", y: 1720, height: 480, background: "linear-gradient(180deg,#f7eadc,#fff8f0)", kind: "message", required: true },
        { id: mkId("s5"), label: "Vestimenta", y: 2200, height: 440, background: "linear-gradient(180deg,#fff8f0,#f4dfe0 48%,#fff8f0)", kind: "dress_code", required: false },
        { id: mkId("s6"), label: "Ubicacion", y: 2640, height: 480, background: "linear-gradient(180deg,#fffdf9,#f7eadc,#fffdf9)", kind: "event_details", required: true },
        { id: mkId("s7"), label: "RSVP", y: 3120, height: 400, background: "linear-gradient(180deg,#fff8f0,#f1dccd)", kind: "rsvp", required: true },
        { id: mkId("s8"), label: "Cierre", y: 3520, height: 440, background: "linear-gradient(180deg,#f1dccd,#fffdf9 62%,#f7eadc 100%)", kind: "footer", required: true },
      ];

      const els: V3Element[] = [];

      els.push(mkShape("s1-wash-top", 0, 0, 390, 320, "radial-gradient(ellipse at 50% 0%,rgba(232,185,193,0.34) 0%,rgba(232,185,193,0.08) 42%,transparent 72%)"));
      els.push(mkShape("s1-wash-bottom", 0, 500, 390, 280, "radial-gradient(ellipse at 50% 100%,rgba(215,183,126,0.22) 0%,transparent 68%)"));
      els.push(mkShape("s1-line-top", cx(260), 34, 260, 1, goldLine()));
      els.push(mkText("s1-mis", "MIS", cx(44), 54, 44, 16, { fontSize: 11, fontWeight: "700", letterSpacing: 0.42, color: GOLD }));
      els.push(mkText("s1-15", "15", cx(148), 66, 148, 112, { fontSize: 98, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", fontWeight: "700", color: ROSE, lineHeight: 1 }));
      els.push(mkShape("s1-div1", cx(200), 196, 200, 1, "linear-gradient(90deg,transparent," + GOLD + ",transparent)"));
      els.push(mkText("s1-name", "Tu nombre", cx(292), 212, 292, 54, { semanticRole: "honoree_name", dataKey: "quinceanera_name", fontSize: 43, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", fontWeight: "700", color: TEXT, lineHeight: 1.08 }));
      els.push(mkText("s1-last", "MIS QUINCE ANOS", cx(226), 270, 226, 20, { fontSize: 10, fontWeight: "700", letterSpacing: 0.32, color: TEXT_MUTED }));
      els.push(mkShape("s1-div2", cx(88), 304, 88, 1, goldLine()));
      els.push(mkText("s1-date", "FECHA POR CONFIRMAR", cx(218), 322, 218, 18, { semanticRole: "event_date", dataKey: "event_date", fontSize: 10, fontWeight: "600", letterSpacing: 0.20, color: GOLD }));
      els.push(mkText("s1-type", "Quinceanos", cx(142), 350, 142, 22, { fontSize: 14, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: MAUVE_SOFT }));
      els.push(mkShape("s1-card", cx(318), 444, 318, 94, CARD, { borderRadius: 18, border: "1px solid rgba(184,146,90,0.28)" }));
      els.push(mkText("s1-inv1", "Te invito a celebrar", cx(228), 462, 228, 18, { fontSize: 11, color: TEXT_MUTED, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif" }));
      els.push(mkText("s1-inv2", "mis quince anos", cx(196), 486, 196, 24, { fontSize: 16, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: MAUVE, letterSpacing: 0.03, fontWeight: "600" }));
      els.push(mkShape("s1-line-bottom", cx(220), 562, 220, 1, goldLine("66")));

      const s2 = 780;
      els.push(mkShape("s2-wash", 54, s2 + 52, 282, 280, "radial-gradient(ellipse at 50% 50%,rgba(232,185,193,0.22) 0%,transparent 68%)"));
      els.push(mkText("s2-label", "FALTA POCO", cx(178), s2 + 36, 178, 16, { fontSize: 9, fontWeight: "700", letterSpacing: 0.36, color: GOLD }));
      els.push(mkShape("s2-card", cx(330), s2 + 74, 330, 144, CARD, { borderRadius: 20, border: "1px solid rgba(184,146,90,0.24)" }));
      els.push(mkApp("s2-countdown", "countdown", "", cx(296), s2 + 96, 296, 62, { background: "transparent", color: TEXT, borderRadius: 0, config: { url: "", primaryColor: "transparent", textColor: TEXT } }));
      els.push(mkText("s2-caption", "para celebrar juntos", cx(228), s2 + 230, 228, 18, { fontSize: 13, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: ROSE }));
      els.push(mkText("s2-date", "Fecha por confirmar", cx(282), s2 + 278, 282, 18, { semanticRole: "event_date", dataKey: "event_date", fontSize: 10, color: TEXT_MUTED, letterSpacing: 0.08 }));

      const s3 = 1180;
      els.push(mkShape("s3-wash", 0, s3, 390, 540, "radial-gradient(ellipse at 50% 30%,rgba(232,185,193,0.16) 0%,transparent 58%)"));
      els.push(mkText("s3-eye", "LA FESTEJADA", cx(158), s3 + 36, 158, 16, { fontSize: 9, fontWeight: "700", letterSpacing: 0.40, color: GOLD }));
      els.push(mkShape("s3-div1", cx(176), s3 + 58, 176, 1, goldLine()));
      els.push(mkText("s3-name1", "Tu nombre", cx(304), s3 + 74, 304, 54, { semanticRole: "honoree_name", dataKey: "quinceanera_name", fontSize: 42, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", fontWeight: "700", color: TEXT, lineHeight: 1.1 }));
      els.push(mkText("s3-name2", "", cx(168), s3 + 132, 168, 36, { fontSize: 28, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: ROSE, lineHeight: 1 }));
      els.push(mkText("s3-parents-label", "Hija de", cx(88), s3 + 194, 88, 18, { fontSize: 10, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: TEXT_MUTED }));
      els.push(mkText("s3-parents", "Mis padres", cx(270), s3 + 220, 270, 22, { semanticRole: "parents_names", dataKey: "parents_names", fontSize: 13, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: GOLD }));
      els.push(mkShape("s3-card", cx(314), s3 + 258, 314, 96, CARD, { borderRadius: 16, border: "1px solid rgba(184,146,90,0.24)" }));
      els.push(mkText("s3-verse", "Hoy cumplo quince anos\ny quiero compartirlos contigo", cx(274), s3 + 274, 274, null, { fontSize: 13, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: TEXT_MUTED, lineHeight: 1.55 }));
      els.push(mkText("s3-watermark", "15", cx(108), s3 + 394, 108, 90, { fontSize: 80, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: "rgba(200,117,131,0.10)", lineHeight: 1 }));

      const s4 = 1720;
      els.push(mkShape("s4-wash", 60, s4 + 60, 270, 300, "radial-gradient(ellipse at 50% 50%,rgba(201,179,201,0.18) 0%,transparent 63%)"));
      els.push(mkText("s4-eye", "MENSAJE ESPECIAL", cx(188), s4 + 36, 188, 16, { fontSize: 9, fontWeight: "700", letterSpacing: 0.34, color: GOLD }));
      els.push(mkShape("s4-card", cx(330), s4 + 58, 330, 258, CARD, { borderRadius: 20, border: "1px solid rgba(184,146,90,0.22)" }));
      els.push(mkText("s4-quote", '"', 50, s4 + 66, 38, 50, { fontSize: 52, fontFamily: "'Playfair Display',Georgia,serif", color: ROSE, opacity: 0.55, lineHeight: 0.9 }));
      els.push(mkText("s4-message", "Este momento es magico\ny unico. Gracias por acompanarme\nen el inicio de esta nueva etapa.", cx(272), s4 + 116, 272, null, { semanticRole: "honoree_message", dataKey: "quince_message", fontSize: 15, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: TEXT, lineHeight: 1.58 }));
      els.push(mkShape("s4-sig-div", cx(78), s4 + 280, 78, 1, goldLine()));
      els.push(mkText("s4-signature", "Con carino", cx(208), s4 + 292, 208, 20, { fontSize: 11, fontWeight: "600", color: GOLD, letterSpacing: 0.12 }));

      const s5 = 2200;
      els.push(mkShape("s5-wash", 0, s5, 390, 440, "radial-gradient(ellipse at 50% 25%,rgba(232,185,193,0.16) 0%,transparent 53%)"));
      els.push(mkText("s5-eye", "CODIGO DE VESTIMENTA", cx(246), s5 + 36, 246, 16, { fontSize: 9, fontWeight: "700", letterSpacing: 0.26, color: GOLD }));
      els.push(mkText("s5-style", "Formal Elegante", cx(258), s5 + 76, 258, 40, { semanticRole: "dress_code", dataKey: "dress_code", fontSize: 32, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: TEXT, lineHeight: 1.1 }));
      els.push(mkText("s5-hint", "Paleta sugerida: rosa, lavanda y champagne.\nEvitar blanco y negro total.", cx(282), s5 + 126, 282, null, { semanticRole: "dress_code", dataKey: "dress_code", fontSize: 12, color: TEXT_MUTED, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1.5 }));
      const sw = s5 + 192;
      const sX = cx(140);
      els.push(mkShape("s5-sw1", sX, sw, 40, 40, BLUSH, { borderRadius: 999, border: "2px solid rgba(255,255,255,0.72)" }));
      els.push(mkShape("s5-sw2", sX + 52, sw, 40, 40, LAVENDER, { borderRadius: 999, border: "2px solid rgba(255,255,255,0.68)" }));
      els.push(mkShape("s5-sw3", sX + 104, sw, 40, 40, GOLD_SOFT, { borderRadius: 999, border: "2px solid rgba(255,255,255,0.68)" }));
      els.push(mkText("s5-swatch-label", "Rosa . Lavanda . Champagne", cx(264), sw + 52, 264, 16, { semanticRole: "color_palette", dataKey: "color_palette", fontSize: 10, color: TEXT_MUTED, letterSpacing: 0.08 }));

      const s6 = 2640;
      els.push(mkShape("s6-wash", 0, s6 + 80, 390, 280, "radial-gradient(ellipse at 50% 50%,rgba(232,185,193,0.16) 0%,transparent 60%)"));
      els.push(mkText("s6-eye", "DONDE NOS ENCONTRAMOS", cx(288), s6 + 36, 288, 16, { fontSize: 9, fontWeight: "700", letterSpacing: 0.20, color: GOLD }));
      els.push(mkText("s6-venue", "Ubicacion del evento", cx(278), s6 + 112, 278, 34, { semanticRole: "ceremony_place", dataKey: "church_name", fontSize: 27, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", fontWeight: "700", color: TEXT, lineHeight: 1.1 }));
      els.push(mkText("s6-address", "Direccion por confirmar", cx(268), s6 + 152, 268, 22, { semanticRole: "event_address", dataKey: "address", fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4 }));
      els.push(mkText("s6-date", "Fecha por confirmar", cx(306), s6 + 182, 306, 20, { semanticRole: "event_date", dataKey: "event_date", fontSize: 10, fontWeight: "600", color: GOLD, letterSpacing: 0.09 }));
      els.push(mkApp("s6-map", "maps", "Ver en el mapa", cx(230), s6 + 230, 230, 50, { background: CARD, color: MAUVE, borderRadius: 16, border: "1px solid rgba(184,146,90,0.36)", config: { url: "https://maps.google.com", primaryColor: ROSE, textColor: MAUVE } }));

      const s7 = 3120;
      els.push(mkShape("s7-wash", 0, s7, 390, 400, "radial-gradient(ellipse at 50% 60%,rgba(201,179,201,0.20) 0%,transparent 63%)"));
      els.push(mkText("s7-eye", "CONFIRMA TU ASISTENCIA", cx(264), s7 + 36, 264, 16, { fontSize: 9, fontWeight: "700", letterSpacing: 0.22, color: GOLD }));
      els.push(mkText("s7-deadline", "Antes del 1 de Junio", cx(226), s7 + 74, 226, 20, { fontSize: 12, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif", color: TEXT_MUTED }));
      els.push(mkApp("s7-rsvp", "rsvp", "CONFIRMAR ASISTENCIA", cx(290), s7 + 108, 290, 56, { background: "linear-gradient(135deg," + ROSE + "," + MAUVE + ")", color: IVORY, borderRadius: 18, config: { url: "", primaryColor: ROSE, textColor: IVORY } }));
      els.push(mkText("s7-or", "- o escribinos por -", cx(208), s7 + 186, 208, 18, { fontSize: 11, color: TEXT_MUTED, fontStyle: "italic", fontFamily: "'Playfair Display',Georgia,serif" }));
      els.push(mkApp("s7-wa", "whatsapp", "WhatsApp", cx(190), s7 + 214, 190, 46, { background: CARD, color: "#4a8c5c", borderRadius: 16, border: "1px solid rgba(74,140,92,0.30)", config: { url: "https://wa.me/", primaryColor: "#25d366", textColor: "#4a8c5c" } }));

      const s8 = 3520;
      els.push(mkShape("s8-wash-top", 0, s8, 390, 220, "radial-gradient(ellipse at 50% 0%,rgba(232,185,193,0.24) 0%,transparent 65%)"));
      els.push(mkText("s8-title", "Nos vemos pronto", cx(278), s8 + 90, 278, 38, { fontSize: 30, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", fontWeight: "700", color: TEXT }));
      els.push(mkText("s8-name", "Tu nombre", cx(190), s8 + 140, 190, 28, { semanticRole: "honoree_name", dataKey: "quinceanera_name", fontSize: 22, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: ROSE }));
      els.push(mkShape("s8-divider", cx(178), s8 + 182, 178, 1, goldLine()));
      els.push(mkText("s8-watermark", "15", cx(108), s8 + 204, 108, 92, { fontSize: 82, fontFamily: "'Playfair Display',Georgia,serif", fontStyle: "italic", color: "rgba(200,117,131,0.10)", lineHeight: 1 }));
      els.push(mkText("s8-footer", "Creado con KAIS Invitaciones", cx(234), s8 + 360, 234, 14, { fontSize: 9, color: TEXT_MUTED, opacity: 0.45, letterSpacing: 0.08 }));

      return { sections, elements: els };
    },
  },
];

// Expanded panel content per tool
// ─────────────────────────────────────────────────────────────────────────────

// ── Plan gate metadata for each app block ─────────────────────────────────────
// featureKey: EventFeatureKey that gates this block. Absent = always available.
// minPlanLabel: human-readable minimum plan name shown in the lock badge.
const APP_GATE: Partial<Record<string, { featureKey: EventFeatureKey; minPlanLabel: string }>> = {
  rsvp:         { featureKey: "rsvp",       minPlanLabel: "Premium"    },
  album:        { featureKey: "live_album",  minPlanLabel: "Experience" },
  live:         { featureKey: "live_album",  minPlanLabel: "Experience" },
  "live-album": { featureKey: "live_album",  minPlanLabel: "Experience" },
  "live-screen":{ featureKey: "live_album",  minPlanLabel: "Experience" },
};

function ExpandedPanel({
  tool,
  onAddText,
  onAddElement,
  onAddApp,
  onAddInvitationBlock,
  onApplyTheme,
  activeThemeId,
  onApplyPremiumTemplate,
  canvasTemplates = [],
  onApplyTemplateFromDb,
  applyingTemplateId = null,
  isApplyingTemplate = false,
  templateApplyError = null,
  eventFeatureSource = null,
}: {
  tool: ToolId;
  onAddText: (kind: "title" | "subtitle" | "paragraph") => void;
  onAddElement: (kind: string) => void;
  onAddApp: (kind: string) => void;
  onAddInvitationBlock: (kind: InvitationBlockKind) => void;
  onApplyTheme: (theme: CanvasV3Theme) => void;
  activeThemeId: string;
  onApplyPremiumTemplate: (id: string) => void;
  canvasTemplates?: CanvasV3TemplateGalleryItem[];
  onApplyTemplateFromDb: (template: CanvasV3TemplateGalleryItem) => void;
  applyingTemplateId?: string | null;
  isApplyingTemplate?: boolean;
  templateApplyError?: string | null;
  eventFeatureSource?: V3FeatureSource | null;
}) {
  const panelShellStyle: React.CSSProperties = { padding: "14px 14px 18px" };
  const eyebrowStyle: React.CSSProperties = {
    color: "#8a6f61",
    fontSize: 10,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
    margin: "0 0 7px",
    fontWeight: 900,
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const panelTitleStyle: React.CSSProperties = {
    color: "#3d2d27",
    fontSize: 17,
    lineHeight: 1.08,
    margin: "0 0 6px",
    fontFamily: "'Playfair Display', Georgia, serif",
    fontStyle: "italic",
    fontWeight: 800,
  };
  const panelCopyStyle: React.CSSProperties = {
    color: "#7c6658",
    fontSize: 10.5,
    lineHeight: 1.45,
    margin: "0 0 14px",
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const libraryCardStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(166,135,92,0.18)",
    borderRadius: 14,
    background: "linear-gradient(180deg,rgba(255,252,247,0.94),rgba(244,238,228,0.72))",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 10px 22px rgba(54,42,34,0.075)",
    transition: "transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease",
  };
  const liftLibraryCard = (element: HTMLButtonElement) => {
    element.style.transform = "translateY(-1px)";
    element.style.borderColor = "rgba(166,135,92,0.40)";
    element.style.boxShadow = "0 14px 28px rgba(54,42,34,0.12)";
  };
  const settleLibraryCard = (element: HTMLButtonElement) => {
    element.style.transform = "translateY(0)";
    element.style.borderColor = "rgba(166,135,92,0.18)";
    element.style.boxShadow = "0 10px 22px rgba(54,42,34,0.075)";
  };

  if (tool === "text") {
    const textPresets: Array<{
      id: "title" | "subtitle" | "paragraph";
      label: string;
      description: string;
      sample: string;
      fontFamily: string;
      fontSize: number;
      fontStyle?: string;
    }> = [
      { id: "title", label: "Titulo editorial", description: "Hero o nombre principal", sample: "Kenia", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontStyle: "italic" },
      { id: "subtitle", label: "Subtitulo", description: "Linea elegante de apoyo", sample: "Una noche especial", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14 },
      { id: "paragraph", label: "Parrafo", description: "Mensaje breve o detalle", sample: "Celebremos juntos", fontFamily: "Inter, system-ui, sans-serif", fontSize: 12 },
    ];

    return (
      <div style={panelShellStyle}>
        <p style={eyebrowStyle}>
          Texto
        </p>
        <h3 style={panelTitleStyle}>Presets tipograficos</h3>
        <p style={panelCopyStyle}>Agrega textos limpios para titular, acompanar o narrar la invitacion.</p>
        {textPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onAddText(preset.id)}
            style={{
              ...libraryCardStyle,
              display: "grid",
              gap: 6,
              marginBottom: 8,
              padding: "11px 12px",
            }}
            onMouseEnter={(e) => liftLibraryCard(e.currentTarget)}
            onMouseLeave={(e) => settleLibraryCard(e.currentTarget)}
          >
            <span style={{ color: "#4b342d", fontSize: 12, fontWeight: 850, fontFamily: "Inter, system-ui, sans-serif" }}>
              {preset.label}
            </span>
            <span style={{ color: "#7c6658", fontSize: 9.8, fontFamily: "Inter, system-ui, sans-serif" }}>
              {preset.description}
            </span>
            <span style={{ color: "#342620", fontSize: preset.fontSize, fontFamily: preset.fontFamily, fontStyle: preset.fontStyle, lineHeight: 1.12 }}>
              {preset.sample}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (tool === "elements") {
    const basics: { id: InvitationBlockKind; icon: string; label: string; description: string; preview: string }[] = [
      { id: "date", icon: "12", label: "Fecha", description: "Dia, mes, ano y hora", preview: "linear-gradient(135deg,rgba(255,252,247,0.96),rgba(184,146,90,0.20))" },
      { id: "dresscode", icon: "◐", label: "Vestimenta", description: "Tenida y gama de colores", preview: "linear-gradient(135deg,rgba(250,247,241,0.96),rgba(94,79,69,0.16))" },
      { id: "message", icon: "❞", label: "Mensaje", description: "Texto editorial para invitados", preview: "linear-gradient(135deg,rgba(255,252,247,0.96),rgba(199,183,160,0.24))" },
    ];
    const decorations: { kind: string; label: string; description: string; preview: React.ReactNode }[] = [
      {
        kind: "soft-card",
        label: "Tarjeta suave",
        description: "Base glass para contenido",
        preview: <span style={{ width: 44, height: 24, borderRadius: 9, background: "rgba(255,252,247,0.86)", border: "1px solid rgba(184,146,90,0.28)", boxShadow: "0 8px 18px rgba(75,39,53,0.10)" }} />,
      },
      {
        kind: "glow-circle",
        label: "Circulo glow",
        description: "Luz decorativa radial",
        preview: <span style={{ width: 38, height: 38, borderRadius: 999, background: "radial-gradient(circle,rgba(255,252,247,0.95),rgba(199,183,160,0.48),rgba(184,146,90,0.18))", border: "1px solid rgba(184,146,90,0.22)" }} />,
      },
      {
        kind: "rose-soft",
        label: "Rosa soft",
        description: "Ornamento floral sutil",
        preview: <span style={{ width: 42, height: 42, borderRadius: 999, background: "radial-gradient(circle,rgba(250,247,241,0.92),rgba(184,146,90,0.34),transparent 72%)", border: "1px solid rgba(166,135,92,0.22)" }} />,
      },
      {
        kind: "spark",
        label: "Destello",
        description: "Punto de luz dorado",
        preview: <span style={{ width: 36, height: 36, borderRadius: 999, background: "radial-gradient(circle,rgba(244,210,138,0.90),rgba(184,146,90,0.30),transparent 72%)" }} />,
      },
      {
        kind: "soft-glow",
        label: "Resplandor",
        description: "Fondo luminoso suave",
        preview: <span style={{ width: 54, height: 34, borderRadius: 999, background: "radial-gradient(ellipse,rgba(184,146,90,0.30),rgba(59,48,42,0.12),transparent 74%)" }} />,
      },
      {
        kind: "ambient-glow",
        label: "Ambient glow",
        description: "Luz azul/dorada envolvente",
        preview: <span style={{ width: 56, height: 36, borderRadius: 999, background: "radial-gradient(ellipse at 35% 30%,rgba(212,175,55,0.28),transparent 62%),radial-gradient(ellipse at 72% 68%,rgba(37,99,235,0.24),transparent 70%)" }} />,
      },
      {
        kind: "cinematic-haze",
        label: "Cinematic haze",
        description: "Velo ambiental suave",
        preview: <span style={{ width: 56, height: 34, borderRadius: 12, background: "radial-gradient(120% 64% at 50% 0%,rgba(212,175,55,0.16),transparent 64%),linear-gradient(180deg,rgba(37,99,235,0.08),rgba(255,255,255,0.04))" }} />,
      },
      {
        kind: "gold-contamination",
        label: "Gold contamination",
        description: "Derrame dorado atmosférico",
        preview: <span style={{ width: 56, height: 36, borderRadius: 999, background: "radial-gradient(ellipse at 28% 22%,rgba(212,175,55,0.34),rgba(212,175,55,0.12),transparent 70%),radial-gradient(ellipse at 76% 76%,rgba(212,175,55,0.18),transparent 72%)" }} />,
      },
      {
        kind: "blue-ambient-light",
        label: "Blue ambient light",
        description: "Luz fría cinematográfica",
        preview: <span style={{ width: 56, height: 36, borderRadius: 999, background: "radial-gradient(ellipse at 42% 38%,rgba(37,99,235,0.34),rgba(37,99,235,0.14),transparent 72%),radial-gradient(ellipse at 70% 70%,rgba(212,175,55,0.10),transparent 78%)" }} />,
      },
      {
        kind: "editorial-fog",
        label: "Editorial fog",
        description: "Niebla editorial integrada",
        preview: <span style={{ width: 56, height: 34, borderRadius: 12, background: "radial-gradient(140% 76% at 18% 24%,rgba(37,99,235,0.12),transparent 60%),linear-gradient(115deg,transparent,rgba(212,175,55,0.10),rgba(37,99,235,0.08),transparent)" }} />,
      },
      {
        kind: "editorial-line",
        label: "Linea editorial",
        description: "Separador fino premium",
        preview: <span style={{ width: 56, height: 2, borderRadius: 999, background: "linear-gradient(90deg,transparent,#b8925a,transparent)" }} />,
      },
      {
        kind: "dots",
        label: "Puntos",
        description: "Separador minimal",
        preview: <span style={{ display: "flex", gap: 5 }}>{[0, 1, 2, 3].map((dot) => <span key={dot} style={{ width: 7, height: 7, borderRadius: 999, background: dot === 0 || dot === 3 ? "rgba(184,146,90,0.45)" : "#d4aa72" }} />)}</span>,
      },
    ];
    const sectionTitleStyle: React.CSSProperties = {
      color: "#8a6f61",
      fontSize: 10,
      letterSpacing: "0.11em",
      textTransform: "uppercase",
      margin: "18px 0 9px",
      fontWeight: 900,
      fontFamily: "Inter, system-ui, sans-serif",
    };
    const cardStyle: React.CSSProperties = {
      width: "100%",
      border: "1px solid rgba(184,146,90,0.18)",
      borderRadius: 14,
      background: "linear-gradient(180deg,rgba(255,252,247,0.90),rgba(255,247,237,0.66))",
      cursor: "pointer",
      textAlign: "left",
      boxShadow: "0 10px 22px rgba(67,43,30,0.08)",
      transition: "transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease",
    };
    const liftCard = (element: HTMLButtonElement) => {
      element.style.transform = "translateY(-1px)";
      element.style.borderColor = "rgba(184,146,90,0.42)";
      element.style.boxShadow = "0 14px 28px rgba(67,43,30,0.13)";
    };
    const settleCard = (element: HTMLButtonElement) => {
      element.style.transform = "translateY(0)";
      element.style.borderColor = "rgba(184,146,90,0.18)";
      element.style.boxShadow = "0 10px 22px rgba(67,43,30,0.08)";
    };
    return (
      <div style={panelShellStyle}>
        <p style={panelTitleStyle}>
          Elementos curados
        </p>
        <p style={panelCopyStyle}>
          Bloques y detalles listos para componer tu invitacion.
        </p>

        <p style={{ ...sectionTitleStyle, marginTop: 0 }}>Basicos</p>
        <div style={{ display: "grid", gap: 8 }}>
          {basics.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => onAddInvitationBlock(block.id)}
              style={{ ...cardStyle, display: "grid", gridTemplateColumns: "48px 1fr", gap: 10, alignItems: "center", padding: 10 }}
              onMouseEnter={(e) => liftCard(e.currentTarget)}
              onMouseLeave={(e) => settleCard(e.currentTarget)}
            >
              <span style={{ width: 48, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: block.preview, color: "#4b2735", fontSize: 12, fontWeight: 900, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.42)" }}>
                {block.icon}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "#4b2735", fontSize: 12, fontWeight: 850, fontFamily: "Inter, system-ui, sans-serif" }}>
                  {block.label}
                </span>
                <span style={{ display: "block", marginTop: 2, color: "#8a6b58", fontSize: 10, lineHeight: 1.3, fontFamily: "Inter, system-ui, sans-serif" }}>
                  {block.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p style={sectionTitleStyle}>Decoraciones</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {decorations.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => onAddElement(item.kind)}
              style={{ ...cardStyle, minHeight: 112, padding: 10, display: "grid", gridTemplateRows: "42px auto", gap: 8, justifyItems: "start" }}
              onMouseEnter={(e) => liftCard(e.currentTarget)}
              onMouseLeave={(e) => settleCard(e.currentTarget)}
            >
              <span style={{ width: "100%", height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg,rgba(255,252,247,0.80),rgba(184,146,90,0.10))", overflow: "hidden" }}>
                {item.preview}
              </span>
              <span>
                <span style={{ display: "block", color: "#4b2735", fontSize: 11.5, fontWeight: 850, fontFamily: "Inter, system-ui, sans-serif" }}>
                  {item.label}
                </span>
                <span style={{ display: "block", marginTop: 2, color: "#8a6b58", fontSize: 9.5, lineHeight: 1.28, fontFamily: "Inter, system-ui, sans-serif" }}>
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>

      </div>
    );
  }

  if (tool === "apps") {
    const appList: Array<{ id: string; icon: string; label: string; description: string; accent: string }> = [
      { id: "countdown", icon: "00", label: "Cuenta regresiva", description: "Dias, horas y minutos en vivo", accent: "linear-gradient(135deg,#2d2621,#b8925a)" },
      { id: "rsvp", icon: "✓", label: "RSVP", description: "Confirmacion de asistencia", accent: "linear-gradient(135deg,#4b3a2e,#b8925a)" },
      { id: "whatsapp", icon: "WA", label: "WhatsApp", description: "Contacto directo con invitados", accent: "linear-gradient(135deg,#26352d,#9fb99f)" },
      { id: "maps", icon: "⌖", label: "Google Maps", description: "Boton funcional de ubicacion", accent: "linear-gradient(135deg,#2f3437,#b7a98f)" },
      { id: "qr", icon: "QR", label: "Codigo QR", description: "Acceso escaneable al evento", accent: "linear-gradient(135deg,#191716,#c8a96a)" },
      { id: "album", icon: "AL", label: "Album en vivo", description: "Fotos compartidas en tiempo real", accent: "linear-gradient(135deg,#2e2930,#b7a98f)" },
      { id: "live", icon: "TV", label: "Pantalla en vivo", description: "Visual para recepcion o salon", accent: "linear-gradient(135deg,#111827,#9ca3af)" },
    ];

    return (
      <div style={panelShellStyle}>
        <p style={panelTitleStyle}>
          Apps interactivas
        </p>
        <p style={panelCopyStyle}>
          Bloques con accion real para tus invitados.
        </p>
        <p style={eyebrowStyle}>
          Bloques interactivos
        </p>
        {appList.map((app) => {
          const gate = APP_GATE[app.id];
          const isLocked = gate
            ? !eventHasFeature(eventFeatureSource, gate.featureKey)
            : false;

          if (isLocked && gate) {
            // ── Locked block — premium elegante ────────────────────────────────
            return (
              <div
                key={app.id}
                style={{
                  display: "grid", gridTemplateColumns: "42px 1fr auto", alignItems: "center", gap: 10,
                  width: "100%", marginBottom: 6,
                  padding: "10px 14px",
                  background: "linear-gradient(180deg,rgba(248,245,240,0.58),rgba(255,252,247,0.36))",
                  border: "1px solid rgba(184,146,90,0.14)",
                  borderRadius: 14,
                  cursor: "default",
                  boxSizing: "border-box",
                  position: "relative",
                }}
              >
                {/* Icon + label — muted */}
                <span style={{ width: 42, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: app.accent, color: "#fff7ef", fontSize: 10, fontWeight: 900, opacity: 0.28 }}>
                  {app.icon}
                </span>
                <span style={{ minWidth: 0, opacity: 0.55 }}>
                  <span style={{ display: "block", color: "#4b2735", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 850 }}>
                    {app.label}
                  </span>
                  <span style={{ display: "block", marginTop: 2, color: "#8a6b58", fontSize: 10, lineHeight: 1.3, fontFamily: "Inter, system-ui, sans-serif" }}>
                    {app.description}
                  </span>
                </span>
                {/* Right side: lock + plan badge */}
                <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, opacity: 0.4, color: "#b8925a" }}>🔒</span>
                  <span style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.07em",
                    color: "#b8925a",
                    background: "rgba(184,146,90,0.10)",
                    border: "1px solid rgba(184,146,90,0.26)",
                    borderRadius: 6,
                    padding: "2px 6px",
                    whiteSpace: "nowrap",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}>
                    {gate.minPlanLabel}
                  </span>
                </span>
              </div>
            );
          }

          // ── Available block ─────────────────────────────────────────────────
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => onAddApp(app.id)}
              style={{
                display: "grid", gridTemplateColumns: "42px 1fr", alignItems: "center", gap: 10,
                width: "100%", marginBottom: 6,
                padding: "10px 12px",
                background: "linear-gradient(180deg,rgba(255,252,247,0.92),rgba(255,247,237,0.68))",
                border: "1px solid rgba(184,146,90,0.22)",
                borderRadius: 14, cursor: "pointer", textAlign: "left",
                transition: "border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",
                boxSizing: "border-box",
                boxShadow: "0 10px 22px rgba(67,43,30,0.08)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(184,146,90,0.55)";
                e.currentTarget.style.background = "linear-gradient(180deg,rgba(255,252,247,1),rgba(255,247,237,0.82))";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 14px 28px rgba(67,43,30,0.13)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(184,146,90,0.22)";
                e.currentTarget.style.background = "linear-gradient(180deg,rgba(255,252,247,0.92),rgba(255,247,237,0.68))";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 10px 22px rgba(67,43,30,0.08)";
              }}
            >
              <span style={{
                width: 42, height: 38, borderRadius: 12, flexShrink: 0,
                display: "grid", placeItems: "center",
                background: app.accent,
                color: "#fff7ef",
                fontSize: 10,
                fontWeight: 900,
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
              }}>
                {app.icon}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "#4b2735", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 850 }}>
                  {app.label}
                </span>
                <span style={{ display: "block", marginTop: 2, color: "#8a6b58", fontSize: 10, lineHeight: 1.3, fontFamily: "Inter, system-ui, sans-serif" }}>
                  {app.description}
                </span>
              </span>
            </button>
          );
        })}

        {/* ── Plan info footer ─────────────────────────────────────────────── */}
        {eventFeatureSource && (
          <p style={{
            marginTop: 14,
            fontSize: 9.5, color: "#b8925a", lineHeight: 1.5,
            fontFamily: "Inter, system-ui, sans-serif",
            padding: "8px 10px",
            background: "rgba(184,146,90,0.06)",
            border: "1px solid rgba(184,146,90,0.14)",
            borderRadius: 8,
          }}>
            Plan <strong style={{ color: "#a06840" }}>
              {(eventFeatureSource.package_key ?? "essential").charAt(0).toUpperCase() +
               (eventFeatureSource.package_key ?? "essential").slice(1)}
            </strong>.
            {" "}Los bloques bloqueados están disponibles en planes superiores.
          </p>
        )}
      </div>
    );
  }

  if (tool === "templates") {
    const templateFallbackGradients = [
      "linear-gradient(155deg,#211323 0%,#6f3a4e 48%,#d7b271 100%)",
      "linear-gradient(155deg,#111827 0%,#2f3d55 52%,#c8a96a 100%)",
      "linear-gradient(155deg,#fff8f0 0%,#d8b6a4 48%,#8b5a65 100%)",
      "linear-gradient(155deg,#171312 0%,#4c3a2d 50%,#b8925a 100%)",
      "linear-gradient(155deg,#f8f5ef 0%,#b7a98f 50%,#2f3437 100%)",
    ];
    const pickTemplateGradient = (seed: string, index = 0) => {
      const charTotal = seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
      return templateFallbackGradients[(charTotal + index) % templateFallbackGradients.length];
    };
    const renderTemplateMockup = ({
      previewUrl,
      gradient,
      initial,
      isPremium,
    }: {
      previewUrl?: string | null;
      gradient: string;
      initial: string;
      isPremium?: boolean;
    }) => (
      <span
        style={{
          width: 62,
          height: 92,
          borderRadius: 18,
          position: "relative",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          flexShrink: 0,
          background: previewUrl
            ? `linear-gradient(rgba(18,14,20,0.12),rgba(18,14,20,0.12)),url(${previewUrl}) center/cover`
            : gradient,
          boxShadow: "0 12px 24px rgba(38,21,16,0.18), inset 0 0 0 1px rgba(255,255,255,0.30)",
        }}
      >
        {!previewUrl && (
          <>
            <span style={{ position: "absolute", inset: 7, borderRadius: 14, border: "1px solid rgba(255,255,255,0.22)" }} />
            <span style={{ position: "absolute", top: 12, left: 14, right: 14, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.70),transparent)" }} />
            <span style={{ position: "absolute", bottom: 13, left: 16, right: 16, height: 18, borderRadius: 999, background: "rgba(255,252,247,0.18)", border: "1px solid rgba(255,255,255,0.18)" }} />
            <span style={{ position: "absolute", width: 34, height: 34, borderRadius: 999, background: "radial-gradient(circle,rgba(255,255,255,0.46),rgba(255,255,255,0.08),transparent 72%)" }} />
            <span style={{ color: "#fff7ef", fontSize: 20, fontWeight: 850, fontFamily: "'Playfair Display', Georgia, serif", textShadow: "0 8px 18px rgba(0,0,0,0.28)", zIndex: 1 }}>
              {initial}
            </span>
          </>
        )}
        <span style={{
          position: "absolute",
          right: 6,
          top: 6,
          width: 7,
          height: 7,
          borderRadius: 999,
          background: isPremium ? "#f4d28a" : "rgba(255,255,255,0.76)",
          boxShadow: "0 0 0 1px rgba(20,14,16,0.12)",
        }} />
      </span>
    );
    const compactTemplateCardStyle: React.CSSProperties = {
      marginBottom: 9,
      padding: 9,
      borderRadius: 17,
      border: "1px solid rgba(184,146,90,0.20)",
      background: "linear-gradient(180deg,rgba(255,252,247,0.94),rgba(246,239,228,0.76))",
      boxShadow: "0 10px 22px rgba(67,43,30,0.085)",
      transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
    };
    const liftTemplateCard = (element: HTMLDivElement) => {
      element.style.transform = "translateY(-1px)";
      element.style.boxShadow = "0 14px 28px rgba(67,43,30,0.14)";
      element.style.borderColor = "rgba(184,146,90,0.40)";
    };
    const settleTemplateCard = (element: HTMLDivElement) => {
      element.style.transform = "translateY(0)";
      element.style.boxShadow = "0 10px 22px rgba(67,43,30,0.085)";
      element.style.borderColor = "rgba(184,146,90,0.20)";
    };
    const compactTagStyle: React.CSSProperties = {
      padding: "2px 5px",
      borderRadius: 999,
      background: "rgba(184,146,90,0.10)",
      color: "#7a5a40",
      fontSize: 7.8,
      fontWeight: 850,
      letterSpacing: "0.045em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    };

    return (
      <div style={panelShellStyle}>
        <p style={eyebrowStyle}>
          Galeria KAIS
        </p>
        <h3 style={panelTitleStyle}>
          Disenos listos para tu evento
        </h3>
        <p style={panelCopyStyle}>
          Aplica una composicion visual y conserva nombres, fechas, ubicacion y mensajes reales.
        </p>
        {templateApplyError && (
          <div style={{
            marginBottom: 12,
            padding: "9px 10px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.22)",
            color: "#fecaca",
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily: "Inter, system-ui, sans-serif",
          }}>
            {templateApplyError}
          </div>
        )}
        {canvasTemplates.length === 0 ? (
          <div style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 14,
            background: "linear-gradient(135deg,rgba(255,252,247,0.84),rgba(184,146,90,0.10))",
            border: "1px solid rgba(184,146,90,0.18)",
          }}>
            <p style={{ color: "#4b2735", fontSize: 12, fontWeight: 800, margin: "0 0 4px", fontFamily: "Inter, system-ui, sans-serif" }}>
              Todavia no hay disenos activos
            </p>
            <p style={{ color: "#8a6b58", fontSize: 10.5, lineHeight: 1.45, margin: 0, fontFamily: "Inter, system-ui, sans-serif" }}>
              Activa plantillas en la galeria interna para usarlas aqui sin salir de KAIS Studio.
            </p>
          </div>
        ) : (
          canvasTemplates.map((template, index) => {
            const previewUrl = template.thumbnailUrl || template.previewImageUrl;
            const isApplying = isApplyingTemplate && applyingTemplateId === template.id;
            return (
              <div
                key={template.id}
                onMouseEnter={(e) => liftTemplateCard(e.currentTarget)}
                onMouseLeave={(e) => settleTemplateCard(e.currentTarget)}
                style={compactTemplateCardStyle}
              >
                <div style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 10, alignItems: "center" }}>
                  {renderTemplateMockup({
                    previewUrl,
                    gradient: pickTemplateGradient(template.name || template.slug, index),
                    initial: template.name.slice(0, 1).toUpperCase(),
                    isPremium: template.isPremium,
                  })}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <p style={{ color: "#4b2735", fontSize: 12.5, fontWeight: 850, margin: 0, fontFamily: "Inter, system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {template.name}
                      </p>
                      <span style={{ ...compactTagStyle, background: template.isPremium ? "rgba(184,146,90,0.18)" : "rgba(80,70,60,0.08)", color: template.isPremium ? "#9a6d32" : "#706259" }}>
                        {template.isPremium ? "Premium" : "Libre"}
                      </span>
                    </div>
                    <p style={{ color: "#8a6b58", fontSize: 9.6, lineHeight: 1.32, margin: "0 0 7px", fontFamily: "Inter, system-ui, sans-serif", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {template.description || template.visualCategory || "Composicion editable para KAIS Studio."}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {template.visualCategory && (
                        <span style={compactTagStyle}>
                          {template.visualCategory}
                        </span>
                      )}
                      {template.compatibleEventTypes.slice(0, 3).map((eventType) => (
                        <span
                          key={eventType}
                          style={compactTagStyle}
                        >
                          {eventType}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isApplyingTemplate}
                      onClick={() => onApplyTemplateFromDb(template)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        borderRadius: 10,
                        border: "1px solid rgba(184,146,90,0.28)",
                        background: isApplying
                          ? "rgba(184,146,90,0.18)"
                          : "linear-gradient(135deg,#2b1b24,#b8925a)",
                        color: "#fff7ef",
                        cursor: isApplyingTemplate ? "wait" : "pointer",
                        fontSize: 10,
                        fontWeight: 850,
                        letterSpacing: "0.035em",
                        boxShadow: "0 8px 16px rgba(61,35,21,0.14)",
                        fontFamily: "Inter, system-ui, sans-serif",
                        opacity: isApplyingTemplate && !isApplying ? 0.58 : 1,
                      }}
                    >
                      {isApplying ? "Aplicando..." : "Usar plantilla"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {/* ── Premium templates ── */}
        <p style={{ ...eyebrowStyle, marginTop: 20, marginBottom: 10 }}>
          Disenos clasicos
        </p>
        {PREMIUM_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            onMouseEnter={(e) => liftTemplateCard(e.currentTarget)}
            onMouseLeave={(e) => settleTemplateCard(e.currentTarget)}
            style={compactTemplateCardStyle}
          >
            <div style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 10, alignItems: "center" }}>
              {renderTemplateMockup({
                gradient: tpl.previewGradient,
                initial: tpl.emoji,
                isPremium: true,
              })}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <p style={{ color: "#4b342d", fontSize: 12.5, fontWeight: 850, margin: 0, fontFamily: "Inter, system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {tpl.label}
                  </p>
                  <span style={{ ...compactTagStyle, background: "rgba(184,146,90,0.18)", color: "#9a6d32" }}>
                    Premium
                  </span>
                </div>
                <p style={{ color: "#7c6658", fontSize: 9.6, lineHeight: 1.32, margin: "0 0 7px", fontFamily: "Inter, system-ui, sans-serif", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {tpl.description}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  <span style={compactTagStyle}>{tpl.category}</span>
                  <span style={compactTagStyle}>Clasico</span>
                </div>
              <button
                type="button"
                onClick={() => onApplyPremiumTemplate(tpl.id)}
                style={{
                  width: "100%", padding: "7px 9px", borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg,#2d2621,#b8925a)",
                  color: "#fffaf2", cursor: "pointer",
                  fontSize: 10, fontWeight: 850, letterSpacing: "0.035em",
                  boxShadow: "0 8px 16px rgba(54,42,34,0.14)",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                Usar plantilla
              </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === "uploaded") {
    return (
      <div style={panelShellStyle}>
        <p style={eyebrowStyle}>Subidos</p>
        <h3 style={panelTitleStyle}>Recursos del evento</h3>
        <p style={panelCopyStyle}>Proximamente podras cargar imagenes, audios y recursos para usarlos en KAIS Studio.</p>
        <div
          aria-disabled="true"
          style={{
            borderRadius: 18,
            border: "1px dashed rgba(166,135,92,0.32)",
            background: "linear-gradient(180deg,rgba(255,252,247,0.92),rgba(244,238,228,0.66))",
            padding: 16,
            minHeight: 180,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            boxShadow: "0 12px 28px rgba(54,42,34,0.08)",
          }}
        >
          <span style={{
            width: 72,
            height: 96,
            borderRadius: 22,
            display: "grid",
            placeItems: "center",
            marginBottom: 12,
            background: "radial-gradient(circle at 35% 20%,rgba(255,252,247,0.92),transparent 28%),linear-gradient(160deg,#2d2621,#b8925a)",
            color: "#fffaf2",
            fontSize: 22,
            fontWeight: 900,
            boxShadow: "0 18px 32px rgba(54,42,34,0.18), inset 0 0 0 1px rgba(255,255,255,0.22)",
          }}>
            +
          </span>
          <span style={{ display: "block", color: "#4b342d", fontSize: 12, fontWeight: 850, fontFamily: "Inter, system-ui, sans-serif", marginBottom: 5 }}>
            Biblioteca personal
          </span>
          <span style={{ display: "block", color: "#7c6658", fontSize: 10.5, lineHeight: 1.45, fontFamily: "Inter, system-ui, sans-serif" }}>
            Este espacio se activara cuando integremos uploads seguros.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...panelShellStyle, color: "#7c6658", fontSize: 12, textAlign: "center" }}>
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
  panelMode = "properties",
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
  panelMode?: "properties" | "layers";
}) {
  const [pendingDelete, setPendingDelete] = React.useState<"element" | "section" | null>(null);
  const [openGroup, setOpenGroup] = React.useState<InspectorGroup>("content");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showHexEditors, setShowHexEditors] = React.useState(false);
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
    const ROW_H = 54; // row height + gap in px
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
    background: "linear-gradient(180deg, rgba(255,252,247,0.97), rgba(252,248,241,0.97))",
    borderLeft: "1px solid rgba(184,146,90,0.16)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  };

  const labelStyle: React.CSSProperties = {
    color: "#9a7f72", fontSize: 10, letterSpacing: "0.04em",
    textTransform: "uppercase", display: "block", marginBottom: 6,
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: 700,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px",
    background: "rgba(255,255,255,0.66)", border: "1px solid rgba(184,146,90,0.18)",
    borderRadius: 10, color: "#4b2735", fontSize: 12,
    fontFamily: "Inter, system-ui, sans-serif",
    outline: "none", boxSizing: "border-box",
  };
  const actionBtnStyle: React.CSSProperties = {
    padding: "7px 10px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(184,146,90,0.22)",
    borderRadius: 999,
    cursor: "pointer",
    color: "#6c4d57",
    fontSize: 11,
    fontFamily: "Inter, system-ui, sans-serif",
    textAlign: "center",
    transition: "all 0.12s",
    width: "100%",
    fontWeight: 650,
  };
  const panelBadgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const colorPalettes = [
    { label: "Rosados", colors: ["#f2d8dc", "#e9b9c1", "#d39aa6", "#c87583", "#8a4f63"] },
    { label: "Dorados", colors: ["#f4d28a", "#d7b77e", "#c8a96a", "#b8925a", "#8a6a3c"] },
    { label: "Neutros", colors: ["#fff8f0", "#f4ece2", "#e8ddcf", "#d1c0ae", "#9e8675"] },
    { label: "Verdes", colors: ["#dce8dd", "#c2d6c2", "#9fb99f", "#7e9e86", "#3f5e46"] },
    { label: "Azules", colors: ["#d8e2ee", "#b8c8dd", "#8ea7c8", "#5d7ea7", "#243753"] },
    { label: "Morados", colors: ["#e3daf0", "#cbb7e4", "#ad8fce", "#7e63a6", "#4d365f"] },
    { label: "Rojos", colors: ["#f2d9d5", "#d99a90", "#ba6f63", "#9a4b43", "#6f2a2e"] },
    { label: "Oscuros", colors: ["#473b35", "#3d3230", "#2f2626", "#252126", "#16161f"] },
  ] as const;
  const swatchShellStyle: React.CSSProperties = {
    border: "1px solid rgba(184,146,90,0.18)",
    borderRadius: 12,
    padding: "10px 10px 8px",
    background: "rgba(255,255,255,0.62)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
  const renderSwatches = (value: string | undefined, onPick: (next: string) => void) => (
    <div style={swatchShellStyle}>
      {colorPalettes.map((group) => (
        <div key={group.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ ...labelStyle, marginBottom: 0, fontSize: 9 }}>{group.label}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {group.colors.map((color) => {
              const active = (value ?? "").toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onPick(color)}
                  title={color}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: active ? "1px solid rgba(75,39,53,0.85)" : "1px solid rgba(75,39,53,0.22)",
                    boxShadow: active ? "0 0 0 2px rgba(184,146,90,0.24)" : "none",
                    background: color,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                  }}
                >
                  {active ? <span style={{ fontSize: 9, color: "#fff" }}>✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
  const hasEffectControls = element ? (element.type !== "app" || Boolean(normalizeAppType(element))) : false;
  const hasAtmosphereControls = element?.type === "decoration" && Boolean(element.config?.effect);
  const updateEffectConfig = (patch: Partial<NonNullable<V3Element["config"]>>) => {
    if (!element) return;
    onChange(element.id, { config: { ...(element.config ?? {}), ...patch } });
  };
  const effectPresetBtnStyle: React.CSSProperties = {
    ...actionBtnStyle,
    textAlign: "center",
    fontSize: 10,
    padding: "6px 8px",
    borderRadius: 10,
  };
  const applyEffectPreset = (preset:
    | "soft-shadow"
    | "editorial-shadow"
    | "glow-gold"
    | "glow-rose"
    | "glow-white"
    | "deep-shadow"
    | "glass"
    | "gold"
    | "fade-bottom"
    | "fade-top"
    | "vignette"
  ) => {
    if (!element) return;
    if (element.type === "text") {
      if (preset === "soft-shadow") return onChange(element.id, { textShadow: "0 3px 12px rgba(26,19,18,0.22)" });
      if (preset === "editorial-shadow") return onChange(element.id, { textShadow: "0 6px 20px rgba(30,20,18,0.34)" });
      if (preset === "glow-gold") return onChange(element.id, { textShadow: "0 0 16px rgba(200,169,106,0.62), 0 0 30px rgba(200,169,106,0.28)" });
      if (preset === "glow-rose") return onChange(element.id, { textShadow: "0 0 14px rgba(200,117,131,0.58), 0 0 26px rgba(200,117,131,0.28)" });
      if (preset === "glow-white") return onChange(element.id, { textShadow: "0 0 16px rgba(255,255,255,0.62), 0 0 30px rgba(255,255,255,0.28)" });
      if (preset === "deep-shadow") return onChange(element.id, { textShadow: "0 10px 26px rgba(15,10,10,0.52)" });
      if (preset === "fade-bottom") return onChange(element.id, { color: "rgba(75,39,53,0.78)" });
      if (preset === "fade-top") return onChange(element.id, { color: "rgba(75,39,53,0.88)" });
      if (preset === "vignette") return onChange(element.id, { textShadow: "0 0 2px rgba(0,0,0,0.25), 0 0 24px rgba(0,0,0,0.34)" });
      return;
    }

    const currentPrimary = element.config?.primaryColor ?? element.background ?? "rgba(255,255,255,0.1)";
    if (preset === "soft-shadow") return onChange(element.id, { blur: 6 });
    if (preset === "editorial-shadow") return onChange(element.id, { blur: 10, opacity: Math.min(1, (element.opacity ?? 1) * 0.95) });
    if (preset === "glow-gold") return onChange(element.id, { background: "linear-gradient(135deg,rgba(244,210,138,0.34),rgba(184,146,90,0.14))", blur: 8 });
    if (preset === "glow-rose") return onChange(element.id, { background: "linear-gradient(135deg,rgba(233,185,193,0.34),rgba(200,117,131,0.12))", blur: 8 });
    if (preset === "glow-white") return onChange(element.id, { background: "linear-gradient(135deg,rgba(255,255,255,0.45),rgba(255,255,255,0.10))", blur: 6 });
    if (preset === "deep-shadow") return onChange(element.id, { blur: 14, opacity: Math.max(0.55, (element.opacity ?? 1) * 0.88) });
    if (preset === "glass") return onChange(element.id, { background: "linear-gradient(160deg,rgba(255,255,255,0.46),rgba(255,255,255,0.16))", blur: 12, borderColor: "rgba(255,255,255,0.42)", borderWidth: 1, borderStyle: "solid" });
    if (preset === "gold") return onChange(element.id, { background: "linear-gradient(135deg,rgba(244,210,138,0.34),rgba(184,146,90,0.22),rgba(138,106,60,0.24))", config: element.type === "app" ? { ...(element.config ?? {}), primaryColor: "linear-gradient(135deg,rgba(244,210,138,0.34),rgba(184,146,90,0.22),rgba(138,106,60,0.24))" } : element.config });
    if (preset === "fade-bottom") return onChange(element.id, { background: `linear-gradient(180deg,${currentPrimary},rgba(255,255,255,0))` });
    if (preset === "fade-top") return onChange(element.id, { background: `linear-gradient(0deg,${currentPrimary},rgba(255,255,255,0))` });
    if (preset === "vignette") return onChange(element.id, { background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 28%, rgba(26,22,24,0.26) 100%)" });
  };
  const applyFadeDirection = (direction: "up" | "down" | "left" | "right" | "center" | "diag") => {
    if (!element) return;
    const base = element.config?.primaryColor ?? element.background ?? "rgba(184,146,90,0.26)";
    if (element.type === "text") {
      const nextOpacity = direction === "center" ? 0.9 : 0.72;
      onChange(element.id, { color: element.color ?? "#4b2735", opacity: nextOpacity });
      return;
    }
    if (direction === "up") return onChange(element.id, { background: `linear-gradient(0deg,${base},rgba(255,255,255,0))` });
    if (direction === "down") return onChange(element.id, { background: `linear-gradient(180deg,${base},rgba(255,255,255,0))` });
    if (direction === "left") return onChange(element.id, { background: `linear-gradient(270deg,${base},rgba(255,255,255,0))` });
    if (direction === "right") return onChange(element.id, { background: `linear-gradient(90deg,${base},rgba(255,255,255,0))` });
    if (direction === "diag") return onChange(element.id, { background: `linear-gradient(135deg,${base},rgba(255,255,255,0))` });
    return onChange(element.id, { background: `radial-gradient(circle at 50% 50%,${base},rgba(255,255,255,0))` });
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
  const getPremiumLayerIcon = (el: V3Element): string => {
    if (el.type === "text") return "T";
    if (el.type === "app") {
      const app = el.appKind ?? el.appType ?? "";
      if (app === "whatsapp") return "WA";
      if (app === "rsvp") return "RS";
      if (app === "countdown") return "CD";
      if (app === "maps") return "MP";
      if (app === "live-album" || app === "album") return "AL";
      if (app === "live-screen" || app === "live") return "LV";
      if (app === "qr") return "QR";
      return "AP";
    }
    if (el.type === "decoration") return "D";
    if (el.config?.url || /\burl\(/i.test(el.background ?? "")) return "IMG";
    return "F";
  };
  const getPremiumLayerType = (el: V3Element): string => {
    if (el.type === "text") return "Texto";
    if (el.type === "app") return "App";
    if (el.type === "decoration") return "Decoracion";
    if (el.config?.url || /\burl\(/i.test(el.background ?? "")) return "Imagen";
    return "Forma";
  };
  const getPremiumLayerName = (el: V3Element): string => {
    if (el.type === "text") {
      const txt = (el.content ?? "").trim();
      return txt.length > 30 ? `${txt.slice(0, 30)}...` : txt || "Texto";
    }
    if (el.type === "app") {
      const app = el.appKind ?? el.appType ?? "";
      if (app === "whatsapp") return "WhatsApp";
      if (app === "rsvp") return "RSVP";
      if (app === "countdown") return "Cuenta regresiva";
      if (app === "maps") return "Mapa";
      if (app === "live-album" || app === "album") return "Album";
      if (app === "live-screen" || app === "live") return "Pantalla en vivo";
      if (app === "qr") return "Codigo QR";
      return el.content || "Aplicacion";
    }
    if (el.type === "decoration") {
      const effect = el.config?.effect;
      if (effect === "blue-ambient-light") return "Luz azul ambiental";
      if (effect === "gold-contamination") return "Contaminacion dorada";
      if (effect === "cinematic-haze") return "Haze cinematografico";
      if (effect === "editorial-fog") return "Niebla editorial";
      if (effect === "ambient-glow") return "Glow ambiental";
      return el.content || "Decoracion";
    }
    if (el.config?.url || /\burl\(/i.test(el.background ?? "")) return el.content || "Imagen";
    return "Forma";
  };
  const layerActionButtonStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    border: "1px solid rgba(184,146,90,0.14)",
    background: "rgba(255,255,255,0.54)",
    color: "#7c5d4d",
    cursor: "pointer",
    borderRadius: 9,
    fontSize: 10,
    fontWeight: 800,
    display: "grid",
    placeItems: "center",
    padding: 0,
    lineHeight: 1,
  };

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
    <div style={{ background: "linear-gradient(180deg,rgba(255,252,247,0.78),rgba(255,255,255,0.54))", borderBottom: "1px solid rgba(184,146,90,0.12)" }}>
      {/* header */}
      <button
        type="button"
        onClick={() => setLayersOpen((v) => !v)}
        style={{
          width: "100%", padding: "12px 14px 10px", border: "none", background: "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 10, color: "#b8925a" }}>⧉</span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a6f61" }}>Capas</span>
          <span style={{ fontSize: 9, color: "#8a6f61", background: "rgba(255,255,255,0.72)", border: "1px solid rgba(184,146,90,0.22)", borderRadius: 99, padding: "1px 6px" }}>{sectionElements.length}</span>
        </span>
        <span style={{ fontSize: 9, color: "#9a8a80" }}>{layersOpen ? "−" : "+"}</span>
      </button>
      {layersOpen && (
        <div ref={layerListRef} style={{ display: "flex", flexDirection: "column", gap: 7, padding: "4px 10px 12px" }}>
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
                    display: "grid",
                    gridTemplateColumns: "16px 34px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 8px 8px 6px",
                    borderRadius: 14,
                    background: isDragSrc
                      ? "rgba(184,146,90,0.10)"
                      : isSel ? "linear-gradient(135deg,rgba(255,252,247,0.94),rgba(244,232,212,0.72))" : "rgba(255,255,255,0.42)",
                    border: isSel ? "1px solid rgba(184,146,90,0.32)" : "1px solid rgba(184,146,90,0.10)",
                    boxShadow: isSel ? "0 12px 28px rgba(62,42,30,0.10), inset 0 0 0 1px rgba(255,255,255,0.38)" : "0 6px 16px rgba(62,42,30,0.045)",
                    opacity: isHid ? 0.42 : isDragSrc ? 0.55 : 1,
                    cursor: isDragging ? "grabbing" : "pointer",
                    transition: "background 0.14s ease, opacity 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease",
                    userSelect: "none",
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
                      fontSize: 12, width: 14, flexShrink: 0,
                      cursor: "grab",
                      color: "rgba(138,111,97,0.54)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      userSelect: "none",
                      lineHeight: 1,
                    }}
                  >
                    ⠿
                  </span>
                  {/* type icon */}
                  <span style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    flexShrink: 0,
                    color: isSel ? "#4b2735" : "#8a6f61",
                    background: isSel ? "rgba(184,146,90,0.18)" : "rgba(255,252,247,0.74)",
                    border: "1px solid rgba(184,146,90,0.16)",
                    fontSize: getPremiumLayerIcon(el).length > 1 ? 8 : 12,
                    fontWeight: 900,
                    letterSpacing: "0.02em",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}>
                    {getPremiumLayerIcon(el)}
                  </span>
                  {/* name */}
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{
                      fontSize: 12,
                      fontFamily: "Inter, system-ui, sans-serif",
                      color: isSel ? "#4b2735" : "#5c4a43",
                      fontWeight: isSel ? 850 : 720,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                    }}>
                      {getPremiumLayerName(el)}
                    </span>
                    <span style={{ fontSize: 9, color: "#a18b7e", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>
                      {getPremiumLayerType(el)} - z {el.zIndex}
                    </span>
                  </div>
                  {/* controls: eye + lock */}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" title="Subir capa"
                      onClick={() => onLayerMoveUp(el.id)}
                      style={layerActionButtonStyle}>
                      UP
                    </button>
                    <button type="button" title="Bajar capa"
                      onClick={() => onLayerMoveDown(el.id)}
                      style={layerActionButtonStyle}>
                      DN
                    </button>
                    <button type="button" title={isHid ? "Mostrar" : "Ocultar"}
                      onClick={() => onToggleVisible(el.id)}
                      style={{ ...layerActionButtonStyle, opacity: isHid ? 0.58 : 1 }}>
                    {isHid ? "🙈" : "👁"}
                    </button>
                    <button type="button" title={isLocked ? "Desbloquear" : "Bloquear"}
                      onClick={() => onToggleLocked(el.id)}
                      style={{ ...layerActionButtonStyle, color: isLocked ? "#9f6f2f" : "#7c5d4d", background: isLocked ? "rgba(184,146,90,0.16)" : layerActionButtonStyle.background }}>
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

  if (panelMode === "layers") {
    return (
      <div style={s}>
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(184,146,90,0.14)" }}>
          <p style={{ color: "#8a6f61", fontSize: 10, letterSpacing: "0.08em", fontFamily: "Inter, system-ui, sans-serif", margin: 0, textTransform: "uppercase", fontWeight: 850 }}>
            Capas
          </p>
          <p style={{ color: "#4b2735", fontSize: 17, fontWeight: 750, fontFamily: "Inter, system-ui, sans-serif", margin: "5px 0 0" }}>
            Orden del lienzo
          </p>
          <p style={{ color: "#9a8a80", fontSize: 11, margin: "6px 0 0", lineHeight: 1.45 }}>
            Selecciona, oculta, bloquea o arrastra elementos de la seccion activa.
          </p>
        </div>
        {LayersPanel ?? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 20 }}>
            <p style={{ color: "#8884a8", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", textAlign: "center", margin: 0 }}>
              Esta seccion todavia no tiene elementos.
            </p>
          </div>
        )}
      </div>
    );
  }

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
      <div style={{ background: "rgba(255,255,255,0.58)", border: "1px solid rgba(184,146,90,0.16)", borderRadius: 14, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setOpenGroup(id)}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "none",
            borderBottom: isOpen ? "1px solid rgba(184,146,90,0.14)" : "none",
            background: isOpen ? "rgba(255,255,255,0.74)" : "transparent",
            color: isOpen ? "#4b2735" : "#7c675d",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: isOpen ? "#b8925a" : "#b29a8d" }}>{icon}</span>
            {title}
          </span>
          <span style={{ color: "#b29a8d" }}>{isOpen ? "−" : "+"}</span>
        </button>
        {isOpen && (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>
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
          <div style={{ padding: "16px", borderBottom: "1px solid rgba(184,146,90,0.14)" }}>
            <span style={{ ...panelBadgeStyle, color: "#f4d28a", background: "rgba(200,169,106,0.12)", border: "1px solid rgba(200,169,106,0.24)" }}>
              Sección
            </span>
            <p style={{ color: "#4b2735", fontSize: 19, fontWeight: "700", fontFamily: "Inter, system-ui, sans-serif", margin: "10px 0 0" }}>
              {section.label}
            </p>
          </div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" onClick={onDuplicateSection} style={actionBtnStyle}>⧉ Duplicar sección</button>
            <button type="button" onClick={onMoveSectionUp} style={actionBtnStyle}>↑ Subir sección</button>
            <button type="button" onClick={onMoveSectionDown} style={actionBtnStyle}>↓ Bajar sección</button>
            <div style={{ height: 1, background: "rgba(184,146,90,0.14)", margin: "4px 0" }} />
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
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(184,146,90,0.14)" }}>
        <p style={{ color: "#8a6f61", fontSize: 10, letterSpacing: "0.06em", fontFamily: "Inter, system-ui, sans-serif", margin: 0, textTransform: "uppercase", opacity: 0.9 }}>Elemento</p>
        <p style={{ color: "#4b2735", fontSize: 15, fontWeight: "650", fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>
          {element.type === "text" ? "Texto" : element.type === "app" ? "Bloque de aplicación" : element.type === "decoration" ? "Decoración" : "Forma"}
          {element.locked && <span style={{ marginLeft: 8, color: "#c8a96a", fontSize: 10 }}>🔒</span>}
        </p>
        <p style={{ color: "#9a8a80", fontSize: 11, margin: "6px 0 0", lineHeight: 1.45 }}>
          Mostrando ajustes principales. Usa "Más opciones" para controles avanzados.
        </p>
      </div>
      <div style={{ padding: "14px 16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {renderGroup("content", "Contenido", (
          <>
            {element.type === "text" && <div><span style={labelStyle}>Texto</span><textarea value={element.content ?? ""} rows={4} onChange={(e) => onChange(element.id, { content: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} /></div>}
            {element.type === "app" && normalizeAppType(element) && <><div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.68)", border: "1px solid rgba(184,146,90,0.18)", borderRadius: 12 }}><p style={{ color: "#6f625c", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>{APP_DEMO_LABELS[normalizeAppType(element)!]?.icon} {APP_DEMO_LABELS[normalizeAppType(element)!]?.label}</p><p style={{ color: "#a08e84", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>Bloque visual de muestra</p></div><div><span style={labelStyle}>Texto del bloque</span><input type="text" value={element.content ?? APP_DEMO_LABELS[normalizeAppType(element)!]?.label ?? ""} onChange={(e) => onChange(element.id, { content: e.target.value })} style={inputStyle} /></div>
            {normalizeAppType(element) === "whatsapp" && (
              <div>
                <span style={labelStyle}>Estilo visual</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
                  {([
                    { label: "Botanical 🌿", bg: "linear-gradient(160deg,#0d3d21,#1a6b3a)", color: "#e8f5ee", border: undefined },
                    { label: "Luxury ✦",    bg: "linear-gradient(135deg,#c8a96a,#8f6a2d)", color: "#1a0a18", border: undefined },
                    { label: "Soft",         bg: "rgba(20,90,45,0.13)",                     color: "#0d4a28", border: "1px solid rgba(20,90,45,0.28)" },
                    { label: "Outline",      bg: "transparent",                              color: "#c8a96a", border: "1px solid rgba(200,169,106,0.55)" },
                  ] as { label: string; bg: string; color: string; border?: string }[]).map((p) => (
                    <button key={p.label} type="button"
                      onClick={() => onChange(element.id, {
                        background: p.bg,
                        color: p.color,
                        border: p.border,
                        config: { ...(element.config ?? {}), primaryColor: p.bg, textColor: p.color },
                      })}
                      style={{
                        padding: "8px 8px",
                        borderRadius: 10,
                        border: p.border ?? "1px solid rgba(184,146,90,0.24)",
                        background: p.bg === "transparent" ? "rgba(255,252,248,0.92)" : p.bg,
                        color: p.label.startsWith("Soft") ? "#0d4a28" : p.label.startsWith("Outline") ? "#8f6a2d" : p.color,
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        letterSpacing: "0.03em", textAlign: "center" as const,
                        fontFamily: "Inter, system-ui, sans-serif",
                        minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            )}
            </>}
            {(element.type === "shape" || element.type === "decoration") && <p style={{ color: "#9a8a80", fontSize: 12, lineHeight: 1.5, margin: 0 }}>Edita primero color, opacidad y bordes para definir el tono visual.</p>}
          </>
        ), true, element.type === "text" ? "Texto" : element.type === "app" ? "Bloque" : "Forma")}
        {renderGroup("typography", "Tipografía", <><div><span style={labelStyle}>Color de texto</span>{renderSwatches(element.color ?? "#4b2735", (next) => onChange(element.id, { color: next }))}</div><button type="button" onClick={() => setShowHexEditors((v) => !v)} style={{ ...actionBtnStyle, width: "auto", padding: "6px 10px", alignSelf: "flex-start" }}>{showHexEditors ? "Ocultar HEX" : "Editar HEX"}</button>{showHexEditors && <input type="text" value={element.color ?? "#ffffff"} onChange={(e) => onChange(element.id, { color: e.target.value })} style={{ ...inputStyle, flex: 1 }} />}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><div><span style={labelStyle}>Tamaño</span><input type="number" min={8} max={120} value={element.fontSize ?? 16} onChange={(e) => onChange(element.id, { fontSize: Number(e.target.value) })} style={inputStyle} /></div><div><span style={labelStyle}>Peso</span><input type="text" value={element.fontWeight ?? "400"} onChange={(e) => onChange(element.id, { fontWeight: e.target.value })} style={inputStyle} /></div></div><div><span style={labelStyle}>Fuente</span><select value={element.fontFamily ?? "Inter, system-ui, sans-serif"} onChange={(e) => onChange(element.id, { fontFamily: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}><option value="Inter, system-ui, sans-serif">Inter</option><option value="'Playfair Display', Georgia, serif">Playfair Display</option><option value="Georgia, serif">Georgia</option><option value="'Dancing Script', cursive">Dancing Script</option></select></div></>, element.type === "text", "Aa")}
        {renderGroup("fill", "Color", <><div><span style={labelStyle}>Relleno</span>{renderSwatches(element.config?.primaryColor ?? element.background ?? "#fff8f0", (next) => onChange(element.id, { background: next, config: element.type === "app" ? { ...(element.config ?? {}), primaryColor: next } : element.config }))}</div>{element.type === "app" && <div><span style={labelStyle}>Color de texto</span>{renderSwatches(element.color ?? element.config?.textColor ?? "#4b2735", (next) => onChange(element.id, { color: next, config: { ...(element.config ?? {}), textColor: next } }))}</div>}<button type="button" onClick={() => setShowHexEditors((v) => !v)} style={{ ...actionBtnStyle, width: "auto", padding: "6px 10px", alignSelf: "flex-start" }}>{showHexEditors ? "Ocultar HEX" : "Editar HEX"}</button>{showHexEditors && <><div><span style={labelStyle}>Fondo (HEX/valor)</span><input type="text" value={element.config?.primaryColor ?? element.background ?? ""} placeholder="Color, rgba(...) o linear-gradient(...)" onChange={(e) => onChange(element.id, { background: e.target.value, config: element.type === "app" ? { ...(element.config ?? {}), primaryColor: e.target.value } : element.config })} style={inputStyle} /></div>{element.type === "app" && <div><span style={labelStyle}>Texto (HEX)</span><input type="text" value={element.color ?? element.config?.textColor ?? ""} onChange={(e) => onChange(element.id, { color: e.target.value, config: { ...(element.config ?? {}), textColor: e.target.value } })} style={inputStyle} /></div>}</>}<div><span style={labelStyle}>Opacidad {Math.round((element.opacity ?? 1) * 100)}%</span><input type="range" min={0} max={1} step={0.01} value={element.opacity ?? 1} onChange={(e) => onChange(element.id, { opacity: Number(e.target.value) })} style={{ width: "100%", accentColor: "#b8925a" }} /></div></>, element.type !== "text", "Color")}
        {renderGroup("atmosphere", "Atmósfera", (
          <>
            <div>
              <span style={labelStyle}>Color principal</span>
              {renderSwatches(element.config?.color ?? element.config?.primaryColor ?? "#d4af37", (next) => updateEffectConfig({ color: next }))}
            </div>
            <div>
              <span style={labelStyle}>Color secundario</span>
              {renderSwatches(element.config?.accentColor ?? "#2563eb", (next) => updateEffectConfig({ accentColor: next }))}
            </div>
            {showHexEditors && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={labelStyle}>Principal HEX</span>
                  <input type="text" value={element.config?.color ?? ""} placeholder="#d4af37" onChange={(e) => updateEffectConfig({ color: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <span style={labelStyle}>Acento HEX</span>
                  <input type="text" value={element.config?.accentColor ?? ""} placeholder="#2563eb" onChange={(e) => updateEffectConfig({ accentColor: e.target.value })} style={inputStyle} />
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 12, background: "rgba(255,255,255,0.62)", border: "1px solid rgba(184,146,90,0.16)" }}>
              <div>
                <span style={{ ...labelStyle, marginBottom: 2 }}>Mezclar con fondo</span>
                <p style={{ margin: 0, color: "#9a8a80", fontSize: 11, lineHeight: 1.35 }}>Suaviza bordes y funde el efecto.</p>
              </div>
              <button
                type="button"
                onClick={() => updateEffectConfig({ blendWithBackground: !element.config?.blendWithBackground })}
                style={{ width: 42, height: 24, borderRadius: 999, border: "none", background: element.config?.blendWithBackground ? "#b8925a" : "rgba(184,146,90,0.24)", cursor: "pointer", position: "relative", flexShrink: 0 }}
                aria-pressed={Boolean(element.config?.blendWithBackground)}
              >
                <span style={{ position: "absolute", top: 3, left: element.config?.blendWithBackground ? 21 : 3, width: 18, height: 18, background: "#fffaf2", borderRadius: 999, boxShadow: "0 2px 6px rgba(75,39,53,0.18)", transition: "left 0.16s ease" }} />
              </button>
            </div>
            <div>
              <span style={labelStyle}>Intensidad {Math.round(clamp01(element.config?.intensity, 1) * 100)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={clamp01(element.config?.intensity, 1)} onChange={(e) => updateEffectConfig({ intensity: Number(e.target.value) })} style={{ width: "100%", accentColor: "#b8925a" }} />
            </div>
            <div>
              <span style={labelStyle}>Oscuridad {Math.round(clamp01(element.config?.darkness, 0) * 100)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={clamp01(element.config?.darkness, 0)} onChange={(e) => updateEffectConfig({ darkness: Number(e.target.value) })} style={{ width: "100%", accentColor: "#4b2735" }} />
            </div>
            <div>
              <span style={labelStyle}>Transparencia general {Math.round((1 - (element.opacity ?? 1)) * 100)}%</span>
              <input type="range" min={0.05} max={1} step={0.01} value={element.opacity ?? 1} onChange={(e) => onChange(element.id, { opacity: Number(e.target.value) })} style={{ width: "100%", accentColor: "#8ea7c8" }} />
            </div>
          </>
        ), hasAtmosphereControls, "FX")}
        {renderGroup("spacing", "Espaciado básico", <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{(["x", "y", "width", "height"] as const).map((k) => <div key={k}><span style={{ ...labelStyle, fontSize: 9 }}>{k === "x" ? "Posición X" : k === "y" ? "Posición Y" : k === "width" ? "Ancho" : "Alto"}</span><input type="number" value={Math.round(element[k] as number) || 0} disabled={element.locked} onChange={(e) => onChange(element.id, { [k]: Number(e.target.value) })} style={{ ...inputStyle, opacity: element.locked ? 0.5 : 1 }} /></div>)}</div>, true, "Ajustes")}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 999,
            padding: "8px 12px",
            background: "rgba(184,146,90,0.12)",
            color: "#7a5a4f",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {showAdvanced ? "Ocultar más opciones" : "Más opciones"}
        </button>
        {showAdvanced && renderGroup("shadow", "Efectos visuales", <>
          {!hasEffectControls ? (
            <p style={{ margin: 0, color: "#9a8a80", fontSize: 12, lineHeight: 1.45 }}>
              Este elemento no tiene efectos visuales disponibles en el renderer actual.
            </p>
          ) : (
            <>
              <div>
                <span style={labelStyle}>Presets premium</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  <button type="button" onClick={() => applyEffectPreset("soft-shadow")} style={effectPresetBtnStyle}>Suave</button>
                  <button type="button" onClick={() => applyEffectPreset("glow-gold")} style={effectPresetBtnStyle}>Glow oro</button>
                  <button type="button" onClick={() => applyEffectPreset("glass")} style={effectPresetBtnStyle}>Cristal</button>
                  <button type="button" onClick={() => applyEffectPreset("gold")} style={effectPresetBtnStyle}>Dorado</button>
                  <button type="button" onClick={() => applyEffectPreset("fade-bottom")} style={effectPresetBtnStyle}>Fade abajo</button>
                  <button type="button" onClick={() => applyEffectPreset("fade-top")} style={effectPresetBtnStyle}>Fade arriba</button>
                  <button type="button" onClick={() => applyEffectPreset("glow-rose")} style={effectPresetBtnStyle}>Glow rosa</button>
                  <button type="button" onClick={() => applyEffectPreset("glow-white")} style={effectPresetBtnStyle}>Glow blanco</button>
                  <button type="button" onClick={() => applyEffectPreset("vignette")} style={effectPresetBtnStyle}>Viñeta</button>
                </div>
              </div>
              <div>
                <span style={labelStyle}>Dirección de transparencia</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  <button type="button" onClick={() => applyFadeDirection("up")} style={effectPresetBtnStyle}>Arriba</button>
                  <button type="button" onClick={() => applyFadeDirection("down")} style={effectPresetBtnStyle}>Abajo</button>
                  <button type="button" onClick={() => applyFadeDirection("left")} style={effectPresetBtnStyle}>Izquierda</button>
                  <button type="button" onClick={() => applyFadeDirection("right")} style={effectPresetBtnStyle}>Derecha</button>
                  <button type="button" onClick={() => applyFadeDirection("center")} style={effectPresetBtnStyle}>Centro</button>
                  <button type="button" onClick={() => applyFadeDirection("diag")} style={effectPresetBtnStyle}>Diagonal</button>
                </div>
              </div>
              {element.type === "text" && (
                <div>
                  <span style={labelStyle}>Sombra / glow (avanzado)</span>
                  <input
                    type="text"
                    value={element.textShadow ?? ""}
                    placeholder="0 2px 10px rgba(...)"
                    onChange={(e) => onChange(element.id, { textShadow: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              )}
              {(element.type === "shape" || element.type === "decoration" || element.type === "app") && (
                <div>
                  <span style={labelStyle}>Desenfoque: {element.blur ?? 0}px</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={element.blur ?? 0}
                    onChange={(e) => onChange(element.id, { blur: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#b8925a" }}
                  />
                </div>
              )}
              <div style={{ border: "1px dashed rgba(184,146,90,0.34)", borderRadius: 10, padding: "8px 10px", background: "rgba(255,255,255,0.56)" }}>
                <span style={{ ...labelStyle, marginBottom: 4 }}>Reflejo</span>
                <p style={{ margin: 0, color: "#8a6f61", fontSize: 11, lineHeight: 1.45 }}>
                  Reflejo real (espejo arriba/abajo con degradado) requiere soporte de transform/mask en renderer.
                  Alternativa actual: usa presets Fade + Glow para simular profundidad.
                </p>
              </div>
            </>
          )}
        </>, true, "FX")}
        {showAdvanced && renderGroup("stroke", "Contorno", <><div><span style={labelStyle}>Borde redondeado: {element.borderRadius ?? 0}px</span><input type="range" min={0} max={999} step={1} value={element.borderRadius ?? 0} onChange={(e) => onChange(element.id, { borderRadius: Number(e.target.value) })} style={{ width: "100%", accentColor: "#b8925a" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ ...labelStyle, margin: 0 }}>Contorno</span><button type="button" onClick={() => onChange(element.id, hasBorder(element) ? { borderWidth: 0, borderStyle: "none" } : { borderWidth: 1, borderStyle: "solid", borderColor: element.borderColor ?? "#c8a96a" })} style={{ ...actionBtnStyle, width: "auto", padding: "6px 12px" }}>{hasBorder(element) ? "Activo" : "Inactivo"}</button></div>{hasBorder(element) && <><div><span style={labelStyle}>Color de contorno</span>{renderSwatches(element.borderColor ?? "#c8a96a", (next) => onChange(element.id, { borderColor: next }))}</div>{showHexEditors && <input type="text" value={element.borderColor ?? ""} placeholder="#c8a96a" onChange={(e) => onChange(element.id, { borderColor: e.target.value })} style={inputStyle} />}<input type="range" min={1} max={12} step={1} value={element.borderWidth ?? 1} onChange={(e) => onChange(element.id, { borderWidth: Number(e.target.value) })} style={{ width: "100%", accentColor: "#b8925a" }} /><div style={{ display: "flex", gap: 6 }}>{(["solid", "dashed"] as const).map((borderStyle) => <button key={borderStyle} type="button" onClick={() => onChange(element.id, { borderStyle })} style={{ ...actionBtnStyle, background: (element.borderStyle ?? "solid") === borderStyle ? "rgba(184,146,90,0.22)" : "rgba(255,255,255,0.78)" }}>{borderStyle === "solid" ? "Sólido" : "Discontinuo"}</button>)}</div></>}</>, element.type !== "text", "Contorno")}
        {showAdvanced && renderGroup("action", "Acciones", <>
          {element.type === "app" && normalizeAppType(element) !== "countdown" && (() => {
            const appKind = normalizeAppType(element);
            const url = element.config?.url ?? "";
            const isWhatsappUnconfigured = appKind === "whatsapp" && (url === "" || url === "https://wa.me/");
            const isMapsUnconfigured = appKind === "maps" && (url === "" || url === "https://maps.google.com");
            const showWarning = isWhatsappUnconfigured || isMapsUnconfigured;
            const warningText = isWhatsappUnconfigured
              ? "⚠ Configura el WhatsApp del evento en Ajustes para que este botón funcione."
              : "⚠ Configura la ubicación del evento en Ajustes para que este botón funcione.";
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={labelStyle}>URL de muestra</span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => onChange(element.id, { config: { ...(element.config ?? {}), url: e.target.value } })}
                  style={inputStyle}
                />
                {showWarning && (
                  <div style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "rgba(200,169,106,0.13)",
                    border: "1px solid rgba(200,169,106,0.32)",
                    color: "#b8925a",
                    fontSize: 11,
                    lineHeight: 1.45,
                    fontWeight: 500,
                  }}>
                    {warningText}
                  </div>
                )}
              </div>
            );
          })()}
          {element.type === "app" && normalizeAppType(element) === "countdown" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ ...labelStyle, fontWeight: 700, color: "#7a5a4f" }}>⏱ Cuenta Regresiva</span>
              <div>
                <span style={labelStyle}>Fuente de la fecha</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["event", "custom"] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => onChange(element.id, { config: { ...(element.config ?? {}), countdownMode: mode } })} style={{ ...actionBtnStyle, flex: 1, textAlign: "center", background: (element.config?.countdownMode ?? "event") === mode ? "rgba(184,146,90,0.24)" : "rgba(255,255,255,0.72)", color: (element.config?.countdownMode ?? "event") === mode ? "#7a5a4f" : "#866f62" }}>
                      {mode === "event" ? "Fecha del evento" : "Personalizada"}
                    </button>
                  ))}
                </div>
              </div>
              {(element.config?.countdownMode ?? "event") === "event" && (
                <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(184,146,90,0.12)", border: "1px solid rgba(184,146,90,0.22)" }}>
                  <span style={{ ...labelStyle, margin: 0, color: eventDate ? "#7a5a4f" : "#b42336" }}>
                    {eventDate ? `📅 ${new Date(eventDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}` : "⚠ Sin fecha configurada en el evento"}
                  </span>
                </div>
              )}
              {element.config?.countdownMode === "custom" && (
                <div>
                  <span style={labelStyle}>Fecha y hora objetivo</span>
                  <input type="datetime-local" value={element.config?.countdownTarget ? element.config.countdownTarget.slice(0, 16) : ""} onChange={(e) => onChange(element.id, { config: { ...(element.config ?? {}), countdownTarget: e.target.value ? new Date(e.target.value).toISOString() : "" } })} style={inputStyle} />
                </div>
              )}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" onClick={onDuplicate} style={{ ...actionBtnStyle, textAlign: "center" }}>Duplicar</button><button type="button" onClick={onBringToFront} style={{ ...actionBtnStyle, textAlign: "center" }}>Traer al frente</button><button type="button" onClick={onSendToBack} style={{ ...actionBtnStyle, textAlign: "center" }}>Enviar atrás</button><button type="button" onClick={() => setPendingDelete("element")} style={{ ...actionBtnStyle, textAlign: "center", color: "#f87171" }}>Eliminar</button></div>
          {pendingDelete === "element" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => { onDelete(); setPendingDelete(null); }}
                style={{ ...actionBtnStyle, flex: 1, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.32)", color: "#b42336" }}>
                Confirmar eliminación
              </button>
              <button type="button" onClick={() => setPendingDelete(null)}
                style={{ ...actionBtnStyle, width: "auto", padding: "7px 14px", color: "#8a6f61" }}>
                Cancelar
              </button>
            </div>
          )}
        </>, true, "Acción")}
        {showAdvanced && renderGroup("visibility", "Visibilidad", <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ ...labelStyle, margin: 0 }}>Visible</span><button type="button" onClick={() => onChange(element.id, { visible: !element.visible })} style={{ width: 36, height: 20, borderRadius: 10, background: element.visible ? "#b8925a" : "rgba(184,146,90,0.26)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}><span style={{ position: "absolute", top: 2, left: element.visible ? 18 : 2, width: 16, height: 16, background: "#fff", borderRadius: 8, transition: "left 0.2s" }} /></button></div>, true, "Vista")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

// ── EventFeatureSource — minimal shape needed by eventHasFeature ──────────────
type V3FeatureSource = {
  package_key?: string | null;
  enabled_features?: readonly string[] | null;
  disabled_features?: readonly string[] | null;
};

type CanvasV3TemplateGalleryItem = {
  id: string;
  name: string;
  slug: string;
  compatibleEventTypes: string[];
  visualCategory?: string | null;
  description?: string | null;
  templateScope?: "full" | "section" | "component";
  previewImageUrl?: string | null;
  thumbnailUrl?: string | null;
  isPremium?: boolean;
};

type CanvasEditorV3Props = {
  eventId: string;
  eventSlug?: string;
  eventTitle: string;
  initialDesign?: unknown;
  eventDate?: string; // "YYYY-MM-DDTHH:mm:ss"
  // Plan & feature gates
  packageKey?: string | null;
  enabledFeatures?: string[] | null;
  disabledFeatures?: string[] | null;
  // Event data available for future auto-configuration (Sprint 2)
  whatsappPhone?: string | null;
  googleMapsLink?: string | null;
  musicUrl?: string | null;
  canvasTemplates?: CanvasV3TemplateGalleryItem[];
};

export function CanvasEditorV3({
  eventId, eventSlug, eventTitle, initialDesign = null, eventDate,
  packageKey, enabledFeatures, disabledFeatures,
  // Sprint 2: used for auto-configuring WhatsApp and Maps blocks on insert
  whatsappPhone,
  googleMapsLink,
  musicUrl: _musicUrl,
  canvasTemplates = [],
}: CanvasEditorV3Props) {
  const router = useRouter();
  // Feature source passed to eventHasFeature — null = legacy luxury fallback (all enabled)
  const featureSource: V3FeatureSource | null =
    packageKey != null || enabledFeatures != null || disabledFeatures != null
      ? { package_key: packageKey, enabled_features: enabledFeatures, disabled_features: disabledFeatures }
      : null;
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
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [pinnedLibraryTool, setPinnedLibraryTool] = useState<ToolId | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [viewportMode, setViewportMode] = useState<"mobile" | "desktop">("mobile");
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [templateApplyError, setTemplateApplyError] = useState<string | null>(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [templateToApply, setTemplateToApply] = useState<CanvasV3TemplateGalleryItem | null>(null);
  const [isApplyingTemplate, startApplyTemplateTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [multiToolbarMenuOpen, setMultiToolbarMenuOpen] = useState(false);
  const [elementContextMenu, setElementContextMenu] = useState<ElementContextMenuState | null>(null);
  const [topToolbarPopover, setTopToolbarPopover] = useState<"color" | "accentColor" | "font" | null>(null);

  const studioRef = useRef<HTMLDivElement>(null);
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
  const inspectorHasContext = Boolean(selected && !preview);
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? DEFAULT_SECTIONS[0];
  const documentHeight = sections.at(-1) ? sections.at(-1)!.y + sections.at(-1)!.height : DEFAULT_DOCUMENT_H;
  const canvasW = viewportMode === "desktop" ? 1000 : CANVAS_W;
  const SNAP_TOLERANCE = 6;
  const DRAG_START_THRESHOLD = 2;

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    if (selectedIds.length <= 1 || preview) setMultiToolbarMenuOpen(false);
  }, [selectedIds.length, preview]);

  useEffect(() => {
    if (preview) setElementContextMenu(null);
  }, [preview]);

  useEffect(() => {
    if (!selectedId || preview) setTopToolbarPopover(null);
  }, [preview, selectedId]);

  useEffect(() => {
    const node = studioRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setZoom((current) => {
        const step = event.shiftKey ? 0.05 : 0.08;
        return Math.max(0.3, Math.min(2, Number((current + direction * step).toFixed(2))));
      });
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!elementContextMenu) return;

    const closeMenu = () => setElementContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [elementContextMenu]);

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
        const otherHeight = estimateElementRenderHeight(el);
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

  const shouldIgnoreWorkspaceSelectionStart = useCallback((target: HTMLElement | null) => {
    if (!target) return true;
    if (target.closest("[data-element-id]")) return true;
    if (target.closest("[data-canvas-control='true']")) return true;
    if (target.closest("button, a, input, textarea, select, option, label, [role='button'], [contenteditable='true']")) return true;
    return false;
  }, []);

  const beginMarqueeSelection = useCallback((e: React.MouseEvent) => {
    if (preview || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (shouldIgnoreWorkspaceSelectionStart(target)) return;
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
  }, [getCanvasPoint, preview, shouldIgnoreWorkspaceSelectionStart]);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    beginMarqueeSelection(e);
  }, [beginMarqueeSelection]);

  const onWorkspaceMouseDown = useCallback((e: React.MouseEvent) => {
    // Start marquee from workspace too (outside visual canvas).
    // If the click starts inside the canvas, canvas handler will own it.
    if (canvasRef.current?.contains(e.target as Node)) return;
    beginMarqueeSelection(e);
  }, [beginMarqueeSelection]);

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
    const sectionY = activeSection?.y ?? 0;
    const stamp = Date.now();

    // ── Premium preset library ──────────────────────────────────────────────
    // Each entry is a list of V3Elements with zIndex=0 (remapped on insertion).
    const PRESETS: Record<string, V3Element[]> = {
      "soft-card": [{
        id: `deco-soft-card-${stamp}`, type: "decoration",
        x: cx(230), y: sectionY + 86, width: 230, height: 150,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(110% 72% at 78% 92%,rgba(37,99,235,0.10) 0%,transparent 70%),radial-gradient(92% 64% at 42% 18%,rgba(255,255,255,0.05) 0%,transparent 58%),linear-gradient(180deg,rgba(34,36,42,0.62),rgba(8,12,27,0.90))",
        config: { effect: "soft-card", color: "#111827", accentColor: "#2563eb", intensity: 1, darkness: 0.25, blendWithBackground: false },
        border: undefined,
        borderRadius: 34, opacity: 0.88,
      }],
      "glow-circle": [{
        id: `deco-glow-circle-${stamp}`, type: "decoration",
        x: cx(172), y: sectionY + 58, width: 172, height: 172,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(36% 28% at 30% 23%,rgba(255,255,255,0.72) 0%,rgba(255,255,255,0.20) 18%,transparent 38%),radial-gradient(116% 116% at 50% 50%,rgba(47,48,54,0.22) 0%,rgba(31,32,37,0.84) 58%,rgba(5,8,18,0.96) 100%)",
        config: { effect: "glow-circle", color: "#2f3036", accentColor: "#ffffff", intensity: 0.96, darkness: 0.42, blendWithBackground: false },
        border: undefined,
        borderRadius: 999, opacity: 0.92,
      }],
      "rose-soft": [{
        id: `deco-rose-soft-${stamp}`, type: "decoration",
        x: cx(172), y: sectionY + 58, width: 172, height: 172,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(18% 12% at 45% 25%,rgba(255,255,255,0.72) 0%,rgba(255,255,255,0.18) 34%,transparent 58%),conic-gradient(from 18deg at 50% 50%,rgba(17,18,30,0.94),rgba(123,59,118,0.22),rgba(96,55,94,0.42),rgba(18,18,31,0.86),rgba(123,59,118,0.14),rgba(9,11,21,0.96))",
        config: { effect: "rose-soft", color: "#7b3b76", accentColor: "#ffffff", intensity: 0.94, darkness: 0.32, blendWithBackground: false },
        border: undefined,
        borderRadius: 999, opacity: 0.90,
      }],
      "spark": [{
        id: `deco-spark-${stamp}`, type: "decoration",
        x: cx(128), y: sectionY + 72, width: 128, height: 128,
        locked: false, visible: true, zIndex: 0,
        background: "linear-gradient(86deg,transparent 0 42%,rgba(255,255,255,0.52) 48%,rgba(255,255,255,0.18) 52%,transparent 59%),linear-gradient(82deg,transparent 0 36%,rgba(212,175,55,0.50) 47%,rgba(212,175,55,0.18) 55%,transparent 68%),radial-gradient(96% 96% at 50% 50%,rgba(255,255,255,0.05) 0%,rgba(13,16,25,0.84) 58%,rgba(3,6,15,0.97) 100%)",
        config: { effect: "spark", color: "#d4af37", accentColor: "#ffffff", intensity: 0.96, darkness: 0.25, blendWithBackground: false },
        borderRadius: 999, opacity: 0.92,
      }],
      "soft-glow": [{
        id: `deco-soft-glow-${stamp}`, type: "decoration",
        x: cx(164), y: sectionY + 54, width: 164, height: 164,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(44% 58% at 28% 25%,rgba(255,255,255,0.72) 0%,rgba(255,255,255,0.18) 22%,transparent 46%),radial-gradient(94% 112% at 50% 52%,rgba(37,40,51,0.18) 0%,rgba(23,27,37,0.76) 54%,rgba(4,8,18,0.96) 100%)",
        config: { effect: "soft-glow", color: "#252833", accentColor: "#ffffff", intensity: 0.94, darkness: 0.36, blendWithBackground: false },
        borderRadius: 999, opacity: 0.92,
      }],
      "ambient-glow": [{
        id: `deco-ambient-glow-${stamp}`, type: "decoration",
        x: cx(380), y: sectionY - 10, width: 380, height: 420,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(70% 62% at 42% 46%,rgba(138,122,66,0.16) 0%,rgba(138,122,66,0.09) 24%,transparent 58%),radial-gradient(92% 82% at 58% 52%,rgba(37,99,235,0.09) 0%,transparent 70%)",
        config: { effect: "ambient-glow", color: "#8a7a42", accentColor: "#2563eb", intensity: 0.82, darkness: 0, blendWithBackground: true },
        border: undefined,
        borderRadius: 0, opacity: 0.92, blur: 0,
      }],
      "cinematic-haze": [{
        id: `deco-cinematic-haze-${stamp}`, type: "decoration",
        x: cx(390), y: sectionY - 12, width: 390, height: 460,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(76% 64% at 52% 48%,rgba(37,99,235,0.14) 0%,rgba(37,99,235,0.05) 42%,transparent 78%),radial-gradient(112% 96% at 48% 52%,rgba(15,29,74,0.22) 0%,rgba(8,13,31,0.10) 58%,transparent 86%)",
        config: { effect: "cinematic-haze", color: "#0f1d4a", accentColor: "#2563eb", intensity: 0.8, darkness: 0, blendWithBackground: true },
        border: undefined,
        borderRadius: 0, opacity: 0.86, blur: 0,
      }],
      "gold-contamination": [{
        id: `deco-gold-contamination-${stamp}`, type: "decoration",
        x: cx(380), y: sectionY - 8, width: 380, height: 420,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(74% 58% at 34% 28%,rgba(212,175,55,0.18) 0%,rgba(212,175,55,0.08) 34%,transparent 76%),radial-gradient(96% 82% at 50% 50%,rgba(99,82,33,0.08) 0%,transparent 82%)",
        config: { effect: "gold-contamination", color: "#d4af37", accentColor: "#fff4c6", intensity: 0.82, darkness: 0, blendWithBackground: true },
        border: undefined,
        borderRadius: 0, opacity: 0.92, blur: 0,
      }],
      "blue-ambient-light": [{
        id: `deco-blue-ambient-light-${stamp}`, type: "decoration",
        x: cx(390), y: sectionY - 18, width: 390, height: 520,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(62% 58% at 44% 46%,rgba(185,156,77,0.08) 0%,rgba(185,156,77,0.04) 28%,transparent 58%),radial-gradient(86% 78% at 56% 52%,rgba(37,99,235,0.18) 0%,rgba(37,99,235,0.11) 38%,rgba(37,99,235,0.04) 66%,transparent 88%),radial-gradient(122% 104% at 50% 50%,rgba(28,41,92,0.20) 0%,rgba(19,28,67,0.11) 48%,transparent 82%)",
        config: { effect: "blue-ambient-light", color: "#111827", accentColor: "#2563eb", intensity: 0.86, darkness: 0, blendWithBackground: true },
        border: undefined,
        borderRadius: 0, opacity: 0.94, blur: 0,
      }],
      "editorial-fog": [{
        id: `deco-editorial-fog-${stamp}`, type: "decoration",
        x: cx(390), y: sectionY - 10, width: 390, height: 430,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(110% 78% at 54% 72%,rgba(37,99,235,0.08) 0%,transparent 72%),radial-gradient(92% 72% at 22% 18%,rgba(255,255,255,0.02) 0%,transparent 62%),radial-gradient(120% 90% at 52% 50%,rgba(10,15,31,0.12) 0%,transparent 84%)",
        config: { effect: "editorial-fog", color: "#111827", accentColor: "#2563eb", intensity: 0.78, darkness: 0, blendWithBackground: true },
        border: undefined,
        borderRadius: 0, opacity: 0.90, blur: 0,
      }],
      "editorial-line": [{
        id: `deco-editorial-line-${stamp}`, type: "decoration",
        x: cx(280), y: sectionY + 90, width: 280, height: 14,
        locked: false, visible: true, zIndex: 0,
        background: "linear-gradient(90deg,transparent 0%,rgba(184,146,90,0.18) 18%,rgba(184,146,90,0.66) 50%,rgba(184,146,90,0.18) 82%,transparent 100%),linear-gradient(180deg,transparent 0 36%,rgba(255,252,247,0.72) 44%,rgba(184,146,90,0.90) 50%,rgba(255,252,247,0.72) 56%,transparent 64% 100%)",
        config: { effect: "editorial-line", color: "#b8925a", accentColor: "#fffaf2" },
        borderRadius: 999, opacity: 0.82,
      }],
      "dots": [{
        id: `deco-dots-${stamp}`, type: "decoration",
        x: cx(146), y: sectionY + 84, width: 146, height: 28,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(circle at 14% 50%,rgba(184,146,90,0.44) 0 4px,transparent 6px),radial-gradient(circle at 38% 50%,rgba(184,146,90,0.66) 0 5px,transparent 7px),radial-gradient(circle at 62% 50%,rgba(184,146,90,0.66) 0 5px,transparent 7px),radial-gradient(circle at 86% 50%,rgba(184,146,90,0.44) 0 4px,transparent 6px),radial-gradient(ellipse at 50% 50%,rgba(184,146,90,0.10),transparent 72%)",
        config: { effect: "dots", color: "#b8925a", accentColor: "#fffaf2" },
        borderRadius: 999, opacity: 0.78,
      }],

      // ── FORMAS ─────────────────────────────────────────────────────────────
      "Rectángulo": [{
        id: `deco-rect-${stamp}`, type: "decoration",
        x: cx(300), y: sectionY + 80, width: 300, height: 90,
        locked: false, visible: true, zIndex: 0,
        background: "rgba(255,252,248,0.92)",
        border: "1px solid rgba(184,146,90,0.30)",
        borderRadius: 16, opacity: 1,
      }],
      "Círculo": [{
        id: `deco-circ-${stamp}`, type: "decoration",
        x: cx(100), y: sectionY + 80, width: 100, height: 100,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(ellipse at 42% 38%,rgba(255,252,248,0.95),rgba(242,200,206,0.60))",
        border: "1px solid rgba(184,146,90,0.32)",
        borderRadius: 999, opacity: 1,
      }],
      "Línea": [{
        id: `deco-line-${stamp}`, type: "decoration",
        x: cx(240), y: sectionY + 80, width: 240, height: 2,
        locked: false, visible: true, zIndex: 0,
        background: "linear-gradient(90deg,transparent,#b8925a,transparent)",
        borderRadius: 0, opacity: 1,
      }],

      // ── FLORES ─────────────────────────────────────────────────────────────
      "Rosa": [{
        id: `deco-rosa-${stamp}`, type: "decoration",
        x: cx(120), y: sectionY + 70, width: 120, height: 120,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(ellipse at 48% 46%,rgba(242,200,206,0.92) 0%,rgba(212,132,142,0.55) 44%,rgba(200,160,180,0.22) 70%,transparent 100%)",
        border: "1px solid rgba(212,132,142,0.28)",
        borderRadius: 999, opacity: 0.88,
      }],
      "Flor 1": [{
        id: `deco-flor1-${stamp}`, type: "decoration",
        x: cx(88), y: sectionY + 70, width: 88, height: 88,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(ellipse at 50% 50%,rgba(255,252,248,0.95) 0%,rgba(242,200,206,0.68) 40%,rgba(201,176,212,0.42) 72%,transparent 100%)",
        border: "1px solid rgba(201,176,212,0.42)",
        borderRadius: 999, opacity: 0.90,
      }],
      "Flor 2": [{
        id: `deco-flor2-${stamp}`, type: "decoration",
        x: cx(110), y: sectionY + 72, width: 110, height: 64,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(ellipse at 50% 50%,rgba(201,176,212,0.62) 0%,rgba(242,200,206,0.38) 55%,transparent 100%)",
        border: "1px solid rgba(201,176,212,0.26)",
        borderRadius: 999, opacity: 0.82,
      }],

      // ── BRILLOS ────────────────────────────────────────────────────────────
      "Destello": [{
        id: `deco-spark-${stamp}`, type: "decoration",
        x: cx(64), y: sectionY + 72, width: 64, height: 64,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(ellipse at 50% 50%,rgba(212,170,114,0.82) 0%,rgba(212,170,114,0.35) 42%,transparent 72%)",
        borderRadius: 999, opacity: 0.90,
      }],
      "Resplandor": [{
        id: `deco-glow-${stamp}`, type: "decoration",
        x: cx(300), y: sectionY + 50, width: 300, height: 200,
        locked: false, visible: true, zIndex: 0,
        background: "radial-gradient(ellipse at 50% 50%,rgba(212,132,142,0.22) 0%,rgba(201,176,212,0.13) 55%,transparent 100%)",
        borderRadius: 999, opacity: 1,
      }],
      "Polvo": [
        { id: `deco-dust-a-${stamp}`,   type: "decoration", x: 38,  y: sectionY + 74, width: 42, height: 42, locked: false, visible: true, zIndex: 0, background: "radial-gradient(ellipse at 50% 50%,rgba(212,170,114,0.72) 0%,transparent 70%)", borderRadius: 999, opacity: 0.75 },
        { id: `deco-dust-b-${stamp+1}`, type: "decoration", x: 172, y: sectionY + 54, width: 30, height: 30, locked: false, visible: true, zIndex: 1, background: "radial-gradient(ellipse at 50% 50%,rgba(242,200,206,0.82) 0%,transparent 70%)", borderRadius: 999, opacity: 0.72 },
        { id: `deco-dust-c-${stamp+2}`, type: "decoration", x: 318, y: sectionY + 82, width: 36, height: 36, locked: false, visible: true, zIndex: 2, background: "radial-gradient(ellipse at 50% 50%,rgba(201,176,212,0.72) 0%,transparent 70%)", borderRadius: 999, opacity: 0.74 },
      ],

      // ── SEPARADORES ────────────────────────────────────────────────────────
      "Línea dorada": [{
        id: `sep-gold-${stamp}`, type: "decoration",
        x: cx(240), y: sectionY + 80, width: 240, height: 1,
        locked: false, visible: true, zIndex: 0,
        background: "linear-gradient(90deg,transparent,#b8925a,transparent)",
        borderRadius: 0, opacity: 1,
      }],
      "Ola": [{
        id: `sep-wave-${stamp}`, type: "decoration",
        x: cx(290), y: sectionY + 80, width: 290, height: 10,
        locked: false, visible: true, zIndex: 0,
        background: "linear-gradient(90deg,transparent,rgba(184,146,90,0.55) 30%,rgba(242,200,206,0.52) 50%,rgba(184,146,90,0.55) 70%,transparent)",
        borderRadius: 999, opacity: 0.85,
      }],
      "Puntos": [
        { id: `sep-dot-a-${stamp}`,   type: "decoration", x: cx(96) - 36, y: sectionY + 82, width: 8, height: 8, locked: false, visible: true, zIndex: 0, background: "#b8925a", borderRadius: 999, opacity: 0.58 },
        { id: `sep-dot-b-${stamp+1}`, type: "decoration", x: cx(96) - 12, y: sectionY + 82, width: 8, height: 8, locked: false, visible: true, zIndex: 1, background: "#d4aa72", borderRadius: 999, opacity: 0.78 },
        { id: `sep-dot-c-${stamp+2}`, type: "decoration", x: cx(96) + 12, y: sectionY + 82, width: 8, height: 8, locked: false, visible: true, zIndex: 2, background: "#d4aa72", borderRadius: 999, opacity: 0.78 },
        { id: `sep-dot-d-${stamp+3}`, type: "decoration", x: cx(96) + 36, y: sectionY + 82, width: 8, height: 8, locked: false, visible: true, zIndex: 3, background: "#b8925a", borderRadius: 999, opacity: 0.58 },
      ],

      // ── BOTONES ────────────────────────────────────────────────────────────
      "Primario": [{
        id: `btn-pri-${stamp}`, type: "text",
        x: cx(240), y: sectionY + 80, width: 240, height: 52,
        locked: false, visible: true, zIndex: 0,
        content: "CONFIRMAR ASISTENCIA",
        fontSize: 13, fontWeight: "700",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#fdf8f2", textAlign: "center",
        letterSpacing: 0.10, lineHeight: 1,
        background: "linear-gradient(135deg,#d4848e,#a0526a)",
        borderRadius: 18, opacity: 1,
      }],
      "Contorno": [{
        id: `btn-out-${stamp}`, type: "text",
        x: cx(220), y: sectionY + 80, width: 220, height: 50,
        locked: false, visible: true, zIndex: 0,
        content: "VER MÁS",
        fontSize: 12, fontWeight: "600",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#b8925a", textAlign: "center",
        letterSpacing: 0.12, lineHeight: 1,
        background: "transparent",
        border: "1.5px solid rgba(184,146,90,0.72)",
        borderRadius: 16, opacity: 1,
      }],
      "Sutil": [{
        id: `btn-sub-${stamp}`, type: "text",
        x: cx(200), y: sectionY + 80, width: 200, height: 48,
        locked: false, visible: true, zIndex: 0,
        content: "Ver detalles",
        fontSize: 12, fontWeight: "500",
        fontFamily: "'Playfair Display', Georgia, serif",
        fontStyle: "italic",
        color: "#7a5060", textAlign: "center",
        letterSpacing: 0.04, lineHeight: 1,
        background: "rgba(255,252,248,0.90)",
        border: "1px solid rgba(184,146,90,0.28)",
        borderRadius: 14, opacity: 1,
      }],
    };

    const templates = PRESETS[kind];

    if (templates) {
      setElements((prev) => {
        const baseZ = prev.length;
        return [...prev, ...templates.map((t, i) => ({ ...t, zIndex: baseZ + i }))];
      });
      setSelectedIds(templates.map((t) => t.id));
    } else {
      // fallback for unknown kinds
      const id = `deco-${stamp}`;
      setElements((prev) => [...prev, {
        id, type: "decoration" as ElType,
        x: cx(200), y: sectionY + 80, width: 200, height: 80,
        locked: false, visible: true, zIndex: prev.length,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(200,169,106,0.2)",
        borderRadius: 16, opacity: 1,
      }]);
      setSelectedIds([id]);
    }
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
        // Sprint 2: use event data when available; fall back to generic placeholders
        url: appType === "maps"
          ? (googleMapsLink ?? "https://maps.google.com")
          : appType === "whatsapp"
          ? (whatsappPhone ? `https://wa.me/${whatsappPhone.replace(/\D/g, "")}` : "")
          : "",
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
    // Sprint 2: auto-inject event data into config.url when available
    const autoUrl =
      appType === "whatsapp" && whatsappPhone
        ? `https://wa.me/${whatsappPhone.replace(/\D/g, "")}`
        : appType === "maps" && googleMapsLink
        ? googleMapsLink
        : defaults.url ?? "";
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
        url: autoUrl,
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

  const deleteElementById = (id: string) => {
    pushHistory(snapshot());
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedIds((prev) => prev.filter((selected) => selected !== id));
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

  const duplicateElementById = (id: string) => {
    const el = elements.find((item) => item.id === id);
    if (!el) return;
    pushHistory(snapshot());
    const newEl: V3Element = { ...el, id: `el-${Date.now()}`, x: el.x + 14, y: el.y + 14, zIndex: elements.length };
    setElements((prev) => [...prev, newEl]);
    setSelectedIds([newEl.id]);
  };

  const openSelectedInspector = () => {
    if (!selectedId) return;
    setInspectorOpen(true);
  };

  const editSelectedText = () => {
    if (!selectedId) return;
    const el = elements.find((item) => item.id === selectedId);
    if (!el) return;
    const next = window.prompt("Editar texto", el.content ?? "");
    if (next === null || next === el.content) return;
    patchElement(selectedId, { content: next });
  };

  const quickColorSelected = () => {
    if (!selectedId) return;
    const el = elements.find((item) => item.id === selectedId);
    if (!el) return;
    const palette = ["#fff7ef", "#3b1721", "#b8925a", "#f472b6", "#111827"];
    const current = el.type === "decoration" ? el.config?.color ?? el.config?.primaryColor : el.type === "text" || el.content ? el.color : el.background;
    const index = Math.max(0, palette.indexOf(current ?? ""));
    const nextColor = palette[(index + 1) % palette.length];
    if (el.type === "text" || el.content) {
      patchElement(selectedId, { color: nextColor });
    } else if (el.type === "decoration") {
      const nextConfig = { ...(el.config ?? {}), color: nextColor, primaryColor: nextColor };
      patchElement(selectedId, { config: nextConfig, background: buildDecorationBackground({ ...el, config: nextConfig }) });
    } else {
      patchElement(selectedId, { background: nextColor });
    }
  };

  const replaceSelectedImage = () => {
    if (!selectedId) return;
    const next = window.prompt("Pegar URL de imagen", "");
    if (!next) return;
    patchElement(selectedId, {
      background: `url(${next.trim()}) center/cover no-repeat`,
      config: { ...(selected?.config ?? {}), url: next.trim() },
    });
  };

  const cropSelectedImage = () => {
    if (!selectedId) return;
    setInspectorOpen(true);
  };

  const editSelectedQr = () => {
    if (!selectedId) return;
    setInspectorOpen(true);
  };

  const downloadSelectedQr = () => {
    const el = selected;
    if (!el || normalizeAppType(el) !== "qr") return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" rx="20" fill="#fffaf0"/><g fill="#1a0a18">${Array.from({ length: 25 }).map((_, index) => {
      const x = 38 + (index % 5) * 28;
      const y = 38 + Math.floor(index / 5) * 28;
      return index % 3 === 0 || index % 7 === 0 ? `<rect x="${x}" y="${y}" width="20" height="20" rx="3"/>` : "";
    }).join("")}</g><text x="110" y="196" text-anchor="middle" font-family="Arial" font-size="12" fill="#1a0a18">${el.content ?? "QR del evento"}</text></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kais-qr.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  const bringToFront = () => {
    if (!selectedId) return;
    pushHistory(snapshot());
    const maxZ = Math.max(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === selectedId ? { ...e, zIndex: maxZ + 1 } : e));
  };

  const bringElementToFront = (id: string) => {
    pushHistory(snapshot());
    const maxZ = Math.max(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === id ? { ...e, zIndex: maxZ + 1 } : e));
  };

  const sendToBack = () => {
    if (!selectedId) return;
    pushHistory(snapshot());
    const minZ = Math.min(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === selectedId ? { ...e, zIndex: minZ - 1 } : e));
  };

  const sendElementToBack = (id: string) => {
    pushHistory(snapshot());
    const minZ = Math.min(...elements.map((e) => e.zIndex));
    setElements((prev) => prev.map((e) => e.id === id ? { ...e, zIndex: minZ - 1 } : e));
  };

  const toggleElementLocked = (id: string) => {
    patchElement(id, { locked: !(elements.find((el) => el.id === id)?.locked ?? false) });
  };

  const getSelectedGroupBounds = useCallback((ids: string[], source = elementsRef.current) => {
    const selectedElements = source.filter((el) => ids.includes(el.id) && el.visible);
    if (selectedElements.length <= 1) return null;
    const minX = Math.min(...selectedElements.map((el) => el.x));
    const minY = Math.min(...selectedElements.map((el) => el.y));
    const maxX = Math.max(...selectedElements.map((el) => el.x + el.width));
    const maxY = Math.max(...selectedElements.map((el) => el.y + estimateElementRenderHeight(el)));
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
        const height = estimateElementRenderHeight(el);
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
    const lastHeight = estimateElementRenderHeight(last);
    const availableSpace = (last.y + lastHeight) - first.y;
    const totalHeight = selectedElements.reduce((sum, el) => sum + estimateElementRenderHeight(el), 0);
    const gap = (availableSpace - totalHeight) / (selectedElements.length - 1);
    let nextY = first.y;
    const positions: Record<string, number> = {};
    selectedElements.forEach((el, index) => {
      positions[el.id] = index === selectedElements.length - 1 ? last.y : Math.round(nextY);
      nextY += estimateElementRenderHeight(el) + gap;
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
    const legacyHydratedElements = hydratePremiumTemplateElements(newElements, elementsRef.current, {
      eventTitle,
      eventDate,
      googleMapsLink,
      whatsappPhone
    });
    const currentDesign = createV3Design(elementsRef.current, sections, themeId);
    const templateDesign = createV3Design(legacyHydratedElements, newSections, tpl.themeId);
    const hydratedDesign = hydrateCanvasV3Template(
      templateDesign as unknown as SharedCanvasV3Design,
      createTemplateHydrationEventData({
        eventId,
        eventSlug,
        eventTitle,
        eventDate,
        googleMapsLink,
        whatsappPhone,
        packageKey,
        currentDesign,
      }),
      currentDesign as unknown as SharedCanvasV3Design
    ) as unknown as CanvasV3Design | null;
    setSections(hydratedDesign?.sections ?? newSections);
    setElements(hydratedDesign?.elements ?? legacyHydratedElements);
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

  const applyTemplateFromDb = (template: CanvasV3TemplateGalleryItem) => {
    setTemplateApplyError(null);
    setTemplateToApply(template);
  };

  const confirmApplyTemplateFromDb = () => {
    const template = templateToApply;
    if (!template || isApplyingTemplate) return;

    setTemplateApplyError(null);
    setApplyingTemplateId(template.id);
    startApplyTemplateTransition(() => {
      void (async () => {
        const result = await applyCanvasV3TemplateToEvent(eventId, template.id);
        if (!result.ok) {
          setTemplateApplyError(result.error);
          setApplyingTemplateId(null);
          return;
        }

        setSaved(true);
        setSaveStatus("saved");
        setActiveTool(null);
        setTemplateToApply(null);
        setSelectedIds([]);
        router.refresh();
        window.setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
          setApplyingTemplateId(null);
        }, 50);
      })();
    });
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
    false
  );
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setVw(w);
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
  const showInspector = inspectorOpen && inspectorHasContext;
  const showLayersPanel = layersPanelOpen && !preview;

  useEffect(() => {
    if (!inspectorHasContext) setInspectorOpen(false);
  }, [inspectorHasContext]);

  useEffect(() => {
    const availableWidth = vw - ICON_SIDEBAR_W - 96;
    const nextZoom = Math.max(0.3, Math.min(1, Math.floor((availableWidth / canvasW) * 100) / 100));
    setZoom((current) => Math.abs(current - nextZoom) > 0.03 ? nextZoom : current);
  }, [canvasW, vw]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        if (elementContextMenu) {
          setElementContextMenu(null);
          return;
        }
        if (selectedIds.length > 0) {
          setSelectedIds([]);
          setSelectionBox(null);
          selectionBoxRef.current = null;
        }
        return;
      }
      if (!ctrl) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [elementContextMenu, undo, redo, selectedIds.length]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  const countSectionElements = (section: V3Section) =>
    elements.filter((el) => el.y >= section.y && el.y < section.y + section.height).length;

  const openElementContextMenu = (event: React.MouseEvent, elementId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (preview) return;
    if (!selectedIds.includes(elementId)) {
      setSelectedIds(expandSelectionWithGroups([elementId]));
    }

    const MENU_W = 176;
    const MENU_H = 198;
    const GAP = 10;
    const x = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, event.clientX + GAP));
    const y = Math.max(8, Math.min(window.innerHeight - MENU_H - 8, event.clientY + GAP));
    setElementContextMenu({ elementId, x, y });
  };
  const contextMenuElement = elementContextMenu
    ? elements.find((element) => element.id === elementContextMenu.elementId) ?? null
    : null;
  const selectedAppType = selected ? normalizeAppType(selected) : null;
  const selectedLooksLikeImage = Boolean(selected && selected.type !== "app" && (selected.config?.url || /\burl\(/i.test(selected.background ?? "")));
  const selectedIsTextLike = Boolean(selected && (selected.type === "text" || (selected.content && selected.type !== "app")));
  const selectedIsShapeLike = Boolean(selected && (selected.type === "shape" || selected.type === "decoration"));
  const selectedIsAppLike = Boolean(selected && selected.type === "app");
  const selectedHasAtmosphere = Boolean(selected?.type === "decoration" && selected.config?.effect);
  const selectedAccentColor = selected?.config?.accentColor ?? "#2563eb";
  const selectedToolbarColor = selectedIsTextLike
    ? selected?.color ?? "#4b2735"
    : selectedIsAppLike
      ? selected?.config?.primaryColor ?? selected?.background ?? "#b8925a"
      : selected?.type === "decoration"
        ? selected?.config?.color ?? selected?.config?.primaryColor ?? "#b8925a"
        : selected?.background ?? "#b8925a";
  const topToolbarColorPalettes = [
    { label: "Boda", colors: ["#fffaf2", "#e7d8c4", "#c9a96a", "#8b6f47", "#2f2a26", "#ffffff"] },
    { label: "Quince", colors: ["#fff1f5", "#f8c8dc", "#d67b9a", "#b8925a", "#7c3aed", "#3b1721"] },
    { label: "Infantil", colors: ["#fff7b2", "#ffd6e7", "#a7f3d0", "#93c5fd", "#c4b5fd", "#f97316"] },
    { label: "Luxury", colors: ["#0f0f17", "#1f1720", "#c8a96a", "#f4d28a", "#ffffff", "#5b4636"] },
    { label: "Rose gold", colors: ["#fff7ef", "#f2c8ce", "#c87583", "#b8925a", "#8f6f52", "#4b2735"] },
    { label: "Dark neon", colors: ["#030712", "#111827", "#22d3ee", "#a78bfa", "#f472b6", "#25d366"] },
    { label: "Pastel", colors: ["#fef3c7", "#fde2e4", "#d8f3dc", "#dbeafe", "#ede9fe", "#ffffff"] },
  ];
  const topToolbarFonts = [
    {
      category: "Elegantes",
      fonts: [
        { label: "Playfair", value: "'Playfair Display', Georgia, serif" },
        { label: "Cormorant", value: "'Cormorant Garamond', Georgia, serif" },
        { label: "Lora", value: "'Lora', Georgia, serif" },
      ],
    },
    {
      category: "Serif",
      fonts: [
        { label: "Merriweather", value: "'Merriweather', Georgia, serif" },
        { label: "Libre Baskerville", value: "'Libre Baskerville', Georgia, serif" },
        { label: "EB Garamond", value: "'EB Garamond', Georgia, serif" },
      ],
    },
    {
      category: "Script",
      fonts: [
        { label: "Dancing Script", value: "'Dancing Script', cursive" },
        { label: "Great Vibes", value: "'Great Vibes', cursive" },
        { label: "Caveat", value: "'Caveat', cursive" },
      ],
    },
    {
      category: "Modernas",
      fonts: [
        { label: "Montserrat", value: "'Montserrat', Inter, system-ui, sans-serif" },
        { label: "Poppins", value: "'Poppins', Inter, system-ui, sans-serif" },
        { label: "Raleway", value: "'Raleway', Inter, system-ui, sans-serif" },
      ],
    },
    {
      category: "Minimal",
      fonts: [
        { label: "Inter", value: "Inter, system-ui, sans-serif" },
        { label: "Nunito", value: "'Nunito', Inter, system-ui, sans-serif" },
        { label: "Quicksand", value: "'Quicksand', Inter, system-ui, sans-serif" },
      ],
    },
    {
      category: "Infantiles",
      fonts: [
        { label: "Fredoka", value: "'Fredoka', Inter, system-ui, sans-serif" },
        { label: "Baloo 2", value: "'Baloo 2', Inter, system-ui, sans-serif" },
        { label: "Nunito", value: "'Nunito', Inter, system-ui, sans-serif" },
      ],
    },
    {
      category: "Formales",
      fonts: [
        { label: "Cinzel", value: "'Cinzel', Georgia, serif" },
        { label: "Cormorant", value: "'Cormorant Garamond', Georgia, serif" },
        { label: "Libre Baskerville", value: "'Libre Baskerville', Georgia, serif" },
      ],
    },
    {
      category: "Luxury",
      fonts: [
        { label: "Bodoni Moda", value: "'Bodoni Moda', Georgia, serif" },
        { label: "Playfair", value: "'Playfair Display', Georgia, serif" },
        { label: "Cinzel", value: "'Cinzel', Georgia, serif" },
      ],
    },
  ];
  const topToolbarFontPreview = "Quinceañera Ñandutí, José, María, corazón, ilusión";
  const applyTopToolbarColor = (color: string, target: "primary" | "accent" = "primary") => {
    if (!selected) return;
    if (target === "accent" && selected.type === "decoration") {
      const nextConfig = { ...(selected.config ?? {}), accentColor: color };
      patchElement(selected.id, {
        config: nextConfig,
        background: buildDecorationBackground({ ...selected, config: nextConfig }),
      });
    } else if (selectedIsTextLike) {
      patchElement(selected.id, { color });
    } else if (selectedIsAppLike) {
      patchElement(selected.id, {
        background: color,
        config: { ...(selected.config ?? {}), primaryColor: color },
      });
    } else if (selected.type === "decoration") {
      const nextConfig = { ...(selected.config ?? {}), color, primaryColor: color };
      patchElement(selected.id, {
        config: nextConfig,
        background: buildDecorationBackground({ ...selected, config: nextConfig }),
      });
    } else {
      patchElement(selected.id, { background: color });
    }
    setTopToolbarPopover(null);
  };
  const applyTopToolbarFont = (fontFamily: string) => {
    if (!selected || !selectedIsTextLike) return;
    patchElement(selected.id, { fontFamily });
    setTopToolbarPopover(null);
  };
  const topContextButtonStyle: React.CSSProperties = {
    height: 26,
    minWidth: 28,
    border: "1px solid rgba(184,146,90,0.12)",
    borderRadius: 9,
    background: "rgba(255,252,247,0.54)",
    color: "#4b2735",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "0 7px",
    fontSize: 10,
    fontWeight: 800,
    fontFamily: "Inter, system-ui, sans-serif",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
    whiteSpace: "nowrap",
  };
  const topContextIconButtonStyle: React.CSSProperties = {
    ...topContextButtonStyle,
    width: 28,
    minWidth: 28,
    padding: 0,
  };
  const getTopContextIconButtonStyle = (active: boolean): React.CSSProperties => ({
    ...topContextIconButtonStyle,
    background: active ? "rgba(184,146,90,0.24)" : topContextIconButtonStyle.background,
    border: active ? "1px solid rgba(184,146,90,0.36)" : topContextIconButtonStyle.border,
    color: active ? "#2f1d24" : topContextIconButtonStyle.color,
    boxShadow: active
      ? "inset 0 1px 0 rgba(255,255,255,0.34), 0 5px 12px rgba(80,45,30,0.10)"
      : topContextIconButtonStyle.boxShadow,
  });
  const topContextDisabledButtonStyle: React.CSSProperties = {
    ...topContextButtonStyle,
    opacity: 0.42,
    cursor: "not-allowed",
  };
  const topContextDividerStyle: React.CSSProperties = {
    width: 1,
    height: 16,
    background: "rgba(184,146,90,0.16)",
    flexShrink: 0,
  };
  const topContextGroupStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: 2,
    borderRadius: 12,
    background: "rgba(255,255,255,0.18)",
    flexShrink: 0,
  };
  const topContextPopoverStyle: React.CSSProperties = {
    position: "absolute",
    top: 38,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 2,
    minWidth: 164,
    padding: 6,
    borderRadius: 14,
    background: "rgba(255,252,247,0.94)",
    border: "1px solid rgba(184,146,90,0.18)",
    boxShadow: "0 18px 42px rgba(38,24,30,0.18)",
    backdropFilter: "blur(10px)",
  };
  const topContextColorSwatchStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: selectedToolbarColor,
    border: "2px solid rgba(255,255,255,0.82)",
    boxShadow: "0 0 0 1px rgba(75,39,53,0.18), 0 4px 10px rgba(38,24,30,0.16)",
    display: "inline-block",
    flexShrink: 0,
  };
  const topContextAccentSwatchStyle: React.CSSProperties = {
    ...topContextColorSwatchStyle,
    width: 16,
    height: 16,
    background: selectedAccentColor,
  };
  const topContextTinyRangeStyle: React.CSSProperties = {
    width: 62,
    accentColor: "#b8925a",
    cursor: "pointer",
  };
  const patchSelectedEffectConfig = (patch: Partial<NonNullable<V3Element["config"]>>) => {
    if (!selected || selected.type !== "decoration") return;
    const nextConfig = { ...(selected.config ?? {}), ...patch };
    patchElement(selected.id, {
      config: nextConfig,
      background: buildDecorationBackground({ ...selected, config: nextConfig }),
    });
  };

  return (
    <div ref={studioRef} style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", width: "100vw", maxWidth: "100vw", minWidth: 0,
      background: "#0f0f17", overflow: "hidden",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* ── TOP BAR ── */}
      <div style={{
        height: 46, flexShrink: 0,
        background: "linear-gradient(180deg,#1c1b22 0%,#1a1820 100%)",
        borderBottom: "1px solid rgba(149,129,112,0.24)",
        display: "flex", alignItems: "center",
        padding: "0 14px", gap: 8, zIndex: 50,
        minWidth: 0,
      }}>
        {/* Back */}
        <a
          href={`/dashboard/eventos/${eventId}`}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            color: "#b7a89a", fontSize: 11, textDecoration: "none",
            padding: "4px 9px", borderRadius: 999, flexShrink: 0,
            border: "1px solid rgba(149,129,112,0.26)", background: "rgba(255,255,255,0.04)",
            letterSpacing: "0.02em",
          }}
        >
          ← Volver
        </a>

        {/* Event name */}
        <div style={{
          flex: 1, textAlign: "center", minWidth: 0,
          color: "#d9cec2", fontSize: 12, fontWeight: "550",
          letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          opacity: 0.9,
        }}>
          {eventTitle} · KAIS Studio
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
            style={{ ...topBtnStyle, padding: "4px 8px", fontSize: 15 }}>−</button>
          <span style={{ color: "#9f9287", fontSize: 10, minWidth: 32, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
            style={{ ...topBtnStyle, padding: "4px 8px", fontSize: 15 }}>+</button>
        </div>

        {/* Viewport toggle */}
        <div style={{ width: 1, height: 18, background: "rgba(149,129,112,0.28)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0, border: "1px solid rgba(149,129,112,0.22)", borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
          {(["mobile", "desktop"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewportMode(mode)}
              title={mode === "mobile" ? "Móvil 390px" : "Escritorio 1000px"}
              style={{
                padding: "4px 9px", fontSize: 12,
                background: viewportMode === mode ? "rgba(149,129,112,0.30)" : "transparent",
                color: viewportMode === mode ? "#f0e5db" : "#a19388",
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
        <div style={{ width: 1, height: 18, background: "rgba(149,129,112,0.28)", flexShrink: 0 }} />
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
        <div style={{ width: 1, height: 18, background: "rgba(149,129,112,0.28)", flexShrink: 0 }} />
        <button type="button" onClick={() => setPreview(!preview)} style={{ ...topBtnStyle, flexShrink: 0 }}>
          {preview ? "✎ Editar" : "👁 Vista previa"}
        </button>
        <button type="button" onClick={handleSave}
          disabled={saveStatus === "saving"}
          style={{ ...topBtnStyle, flexShrink: 0, background: saved ? "rgba(86,165,118,0.24)" : saveStatus === "error" ? "rgba(190,76,88,0.22)" : "rgba(255,255,255,0.06)", color: saved ? "#b4f0c7" : saveStatus === "error" ? "#f7b2bb" : "#d5c7bc", borderColor: saved ? "rgba(86,165,118,0.50)" : saveStatus === "error" ? "rgba(190,76,88,0.50)" : "rgba(149,129,112,0.26)", opacity: saveStatus === "saving" ? 0.75 : 1 }}>
          {saveStatus === "saving" ? "Guardando..." : saved ? "✓ Guardado" : saveStatus === "error" ? "Error" : "Guardar"}
        </button>
        {saveError && (
          <span
            title={saveError}
            style={{ color: "#f2b4bb", fontSize: 10, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            ⚠ {saveError}
          </span>
        )}
        <button
          type="button"
          disabled={!eventSlug}
          onClick={() => eventSlug && window.open(`/evento/${eventSlug}/preview-v3`, "_blank")}
          title={eventSlug ? `Abrir /evento/${eventSlug}/preview-v3` : "Guardá el diseño primero"}
          style={{ ...topBtnStyle, flexShrink: 0, background: "linear-gradient(135deg,#b8925a,#8f6f52)", color: "#fffaf2", borderColor: "rgba(230,205,176,0.34)", boxShadow: "0 6px 14px rgba(26,19,14,0.18)", opacity: eventSlug ? 1 : 0.5 }}
        >
          Publicar ↗
        </button>

      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0, position: "relative" }}>
        {selected && !preview && (
          <div
            data-canvas-control="true"
            onMouseDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 48,
              maxWidth: "min(760px, calc(100vw - 112px))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 4,
              padding: 4,
              borderRadius: 15,
              background: "linear-gradient(180deg,rgba(255,252,247,0.76),rgba(255,244,232,0.54))",
              border: "1px solid rgba(184,146,90,0.14)",
              boxShadow: "0 16px 40px rgba(38,24,30,0.14), inset 0 1px 0 rgba(255,255,255,0.44)",
              backdropFilter: "blur(10px)",
              overflow: "visible",
              fontFamily: "Inter, system-ui, sans-serif",
              animation: "kaisTopContextIn 140ms ease-out",
            }}
          >
            <style>{`@keyframes kaisTopContextIn{from{opacity:0;transform:translateX(-50%) translateY(-4px) scale(.985)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}`}</style>
            <span style={{ color: "#8a6f61", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 5px", whiteSpace: "nowrap" }}>
              {selectedIsTextLike ? "Texto" : selectedHasAtmosphere ? "Atmósfera" : selectedIsAppLike ? "App" : selectedLooksLikeImage ? "Imagen" : "Elemento"}
            </span>

            {selectedIsTextLike && (
              <span style={topContextGroupStyle}>
                <button type="button" title="Fuente" onClick={() => setTopToolbarPopover(topToolbarPopover === "font" ? null : "font")} style={topContextButtonStyle}>Aa</button>
                <button type="button" title="Reducir tamano" onClick={() => patchElement(selected.id, { fontSize: Math.max(8, (selected.fontSize ?? 14) - 1) })} style={topContextButtonStyle}>-</button>
                <span style={{ minWidth: 24, textAlign: "center", fontSize: 11, color: "#4b2735", fontWeight: 850 }}>{selected.fontSize ?? 14}</span>
                <button type="button" title="Aumentar tamano" onClick={() => patchElement(selected.id, { fontSize: Math.min(140, (selected.fontSize ?? 14) + 1) })} style={topContextButtonStyle}>+</button>
                <button type="button" title="Color" onClick={() => setTopToolbarPopover(topToolbarPopover === "color" ? null : "color")} style={{ ...topContextButtonStyle, width: 34, padding: 0 }}><span style={topContextColorSwatchStyle} /></button>
                <button type="button" title="Negrita" onClick={() => patchElement(selected.id, { fontWeight: selected.fontWeight === "700" || selected.fontWeight === "800" ? "400" : "700" })} style={{ ...topContextButtonStyle, background: selected.fontWeight === "700" || selected.fontWeight === "800" ? "rgba(184,146,90,0.22)" : topContextButtonStyle.background }}>B</button>
                <button type="button" title="Italic" onClick={() => patchElement(selected.id, { fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })} style={{ ...topContextButtonStyle, fontStyle: "italic", background: selected.fontStyle === "italic" ? "rgba(184,146,90,0.22)" : topContextButtonStyle.background }}>I</button>
                <button type="button" title="Subrayado disponible desde propiedades" disabled style={topContextDisabledButtonStyle}>U</button>
              </span>
            )}

            {selectedIsTextLike && (
              <span style={topContextGroupStyle}>
                <button type="button" aria-label="Alinear izquierda" title="Alinear izquierda" onClick={() => patchElement(selected.id, { textAlign: "left" })} style={getTopContextIconButtonStyle((selected.textAlign ?? "left") === "left")}><AlignmentIcon kind="left" /></button>
                <button type="button" aria-label="Centrar horizontal" title="Centrar horizontal" onClick={() => patchElement(selected.id, { textAlign: "center" })} style={getTopContextIconButtonStyle(selected.textAlign === "center")}><AlignmentIcon kind="center" /></button>
                <button type="button" aria-label="Alinear derecha" title="Alinear derecha" onClick={() => patchElement(selected.id, { textAlign: "right" })} style={getTopContextIconButtonStyle(selected.textAlign === "right")}><AlignmentIcon kind="right" /></button>
                <span style={topContextDividerStyle} />
                <button type="button" aria-label="Alinear arriba" title="Alinear arriba" onClick={() => patchElement(selected.id, { verticalAlign: "top" })} style={getTopContextIconButtonStyle((selected.verticalAlign ?? "top") === "top")}><AlignmentIcon kind="top" /></button>
                <button type="button" aria-label="Centrar vertical" title="Centrar vertical" onClick={() => patchElement(selected.id, { verticalAlign: "center" })} style={getTopContextIconButtonStyle(selected.verticalAlign === "center")}><AlignmentIcon kind="middle" /></button>
                <button type="button" aria-label="Alinear abajo" title="Alinear abajo" onClick={() => patchElement(selected.id, { verticalAlign: "bottom" })} style={getTopContextIconButtonStyle(selected.verticalAlign === "bottom")}><AlignmentIcon kind="bottom" /></button>
                <button type="button" title="Espaciado" onClick={openSelectedInspector} style={topContextButtonStyle}>Esp</button>
                <button type="button" title="Efectos" onClick={openSelectedInspector} style={topContextButtonStyle}>Fx</button>
              </span>
            )}

            {selectedHasAtmosphere && selected && (
              <span style={topContextGroupStyle}>
                <button type="button" title="Color principal" onClick={() => setTopToolbarPopover(topToolbarPopover === "color" ? null : "color")} style={{ ...topContextButtonStyle, width: 34, padding: 0 }}><span style={topContextColorSwatchStyle} /></button>
                <button type="button" title="Color secundario" onClick={() => setTopToolbarPopover(topToolbarPopover === "accentColor" ? null : "accentColor")} style={{ ...topContextButtonStyle, width: 32, padding: 0 }}><span style={topContextAccentSwatchStyle} /></button>
                <span title="Intensidad" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 5px", color: "#6f564e", fontSize: 9, fontWeight: 850 }}>
                  Int
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={clamp01(selected.config?.intensity, 1)}
                    onChange={(event) => patchSelectedEffectConfig({ intensity: Number(event.target.value) })}
                    style={topContextTinyRangeStyle}
                  />
                </span>
                <button
                  type="button"
                  title="Mezclar con fondo"
                  onClick={() => patchSelectedEffectConfig({ blendWithBackground: !selected.config?.blendWithBackground })}
                  style={{ ...topContextButtonStyle, background: selected.config?.blendWithBackground ? "rgba(184,146,90,0.24)" : topContextButtonStyle.background }}
                >
                  Mix
                </button>
                <button type="button" title="Menos transparencia" onClick={() => patchElement(selected.id, { opacity: Math.min(1, Math.round(((selected.opacity ?? 1) + 0.1) * 10) / 10) })} style={topContextButtonStyle}>Op+</button>
                <button type="button" title="Más transparencia" onClick={() => patchElement(selected.id, { opacity: Math.max(0.05, Math.round(((selected.opacity ?? 1) - 0.1) * 10) / 10) })} style={topContextButtonStyle}>Op-</button>
                <button type="button" title="Más ajustes" onClick={openSelectedInspector} style={topContextButtonStyle}>Fx</button>
              </span>
            )}

            {(selectedIsShapeLike || selectedLooksLikeImage) && !selectedHasAtmosphere && (
              <>
              <span style={topContextGroupStyle}>
                <button type="button" title="Color o relleno" onClick={() => setTopToolbarPopover(topToolbarPopover === "color" ? null : "color")} style={{ ...topContextButtonStyle, width: 34, padding: 0 }}><span style={topContextColorSwatchStyle} /></button>
                <button type="button" title="Menos opacidad" onClick={() => patchElement(selected.id, { opacity: Math.max(0.1, Math.round(((selected.opacity ?? 1) - 0.1) * 10) / 10) })} style={topContextButtonStyle}>Op-</button>
                <button type="button" title="Mas opacidad" onClick={() => patchElement(selected.id, { opacity: Math.min(1, Math.round(((selected.opacity ?? 1) + 0.1) * 10) / 10) })} style={topContextButtonStyle}>Op+</button>
                <button type="button" title="Borde y contorno" onClick={openSelectedInspector} style={topContextButtonStyle}>Bd</button>
                <button type="button" title="Sombra y efectos" onClick={openSelectedInspector} style={topContextButtonStyle}>Fx</button>
              </span>
                {selectedLooksLikeImage && (
                  <span style={topContextGroupStyle}>
                    <button type="button" title="Reemplazar imagen" onClick={replaceSelectedImage} style={topContextButtonStyle}>Img</button>
                    <button type="button" title="Recortar" onClick={cropSelectedImage} style={topContextButtonStyle}>Crop</button>
                  </span>
                )}
              </>
            )}

            {selectedIsAppLike && (
              <span style={topContextGroupStyle}>
                {selectedAppType === "qr" && (
                  <>
                    <button type="button" title="Editar QR" onClick={editSelectedQr} style={topContextButtonStyle}>QR</button>
                    <button type="button" title="Descargar QR" onClick={downloadSelectedQr} style={topContextButtonStyle}>↓</button>
                  </>
                )}
                <button type="button" title="Color" onClick={() => setTopToolbarPopover(topToolbarPopover === "color" ? null : "color")} style={{ ...topContextButtonStyle, width: 34, padding: 0 }}><span style={topContextColorSwatchStyle} /></button>
                <button type="button" title="Configurar bloque" onClick={openSelectedInspector} style={topContextButtonStyle}>Cfg</button>
              </span>
            )}

            <span style={topContextDividerStyle} />
            <span style={topContextGroupStyle}>
            <button type="button" title="Animar" disabled style={topContextDisabledButtonStyle}>Ani</button>
            <button type="button" title="Posicion y tamano" onClick={openSelectedInspector} style={topContextButtonStyle}>Pos</button>
            <button type="button" title="Traer adelante" onClick={bringToFront} style={topContextButtonStyle}>↑</button>
            <button type="button" title="Enviar atras" onClick={sendToBack} style={topContextButtonStyle}>↓</button>
            <button type="button" title="Duplicar" onClick={duplicateElement} style={topContextButtonStyle}>⧉</button>
            <button type="button" title={selected.locked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLayerLocked(selected.id)} style={topContextButtonStyle}>
              {selected.locked ? "🔒" : "🔓"}
            </button>
            </span>

            {(topToolbarPopover === "color" || topToolbarPopover === "accentColor") && (
              <div style={{ ...topContextPopoverStyle, width: 254 }}>
                <p style={{ margin: "0 0 6px", color: "#8a6f61", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {topToolbarPopover === "accentColor" ? "Color secundario" : "Color principal"}
                </p>
                <div style={{ display: "grid", gap: 7 }}>
                  {topToolbarColorPalettes.map((palette) => (
                    <div key={palette.label} style={{ display: "grid", gap: 4 }}>
                      <span style={{ color: "#8a6f61", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {palette.label}
                      </span>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {palette.colors.map((color) => (
                          <button
                            key={`${palette.label}-${color}`}
                            type="button"
                            title={`${palette.label} ${color}`}
                            onClick={() => applyTopToolbarColor(color, topToolbarPopover === "accentColor" ? "accent" : "primary")}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              border: "1px solid rgba(75,39,53,0.16)",
                              background: color,
                              cursor: "pointer",
                              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.34), 0 5px 12px rgba(38,24,30,0.10)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {topToolbarPopover === "font" && selectedIsTextLike && (
              <div style={{ ...topContextPopoverStyle, width: 330, maxHeight: "min(62vh, 460px)", overflowY: "auto" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {topToolbarFonts.map((group) => (
                    <div key={group.category} style={{ display: "grid", gap: 4 }}>
                      <span style={{ color: "#8a6f61", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {group.category}
                      </span>
                      <div style={{ display: "grid", gap: 3 }}>
                        {group.fonts.map((font) => (
                          <button
                            key={`${group.category}-${font.value}`}
                            type="button"
                            onClick={() => applyTopToolbarFont(font.value)}
                            style={{
                              minHeight: 42,
                              border: "none",
                              borderRadius: 10,
                              background: selected.fontFamily === font.value ? "rgba(184,146,90,0.16)" : "rgba(255,255,255,0.34)",
                              color: "#4b2735",
                              cursor: "pointer",
                              textAlign: "left",
                              padding: "5px 9px",
                              fontFamily: "Inter, system-ui, sans-serif",
                            }}
                          >
                            <span style={{ display: "block", fontSize: 11, fontWeight: 850, marginBottom: 2 }}>
                              {font.label}
                            </span>
                            <span style={{ display: "block", fontFamily: font.value, fontSize: 14, lineHeight: 1.25, color: "#3c2430" }}>
                              {topToolbarFontPreview}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(() => {
          const visibleLibraryTool = sidebarHovered && activeTool ? activeTool : pinnedLibraryTool;

          return (
        <div
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
          style={{
            display: "flex",
            flexShrink: 0,
            position: "relative",
            alignSelf: "stretch",
            height: "100%",
            zIndex: 40,
          }}
        >
        {/* -- LEFT SIDEBAR -- */}
        <div style={{
          width: ICON_SIDEBAR_W,
          minWidth: ICON_SIDEBAR_W,
          flexShrink: 0,
          background: "#f8f5ef",
          borderRight: "1px solid rgba(184,146,90,0.16)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px 6px",
          gap: 9,
          overflowY: "auto",
        }}>
          <p style={{ color: "#8a6f61", fontSize: 8, fontWeight: 850, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", margin: "0 0 4px", width: "100%" }}>
            Biblioteca
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center", width: "100%" }}>
            {TOOLS.filter((tool) => tool.id !== "projects").map((tool) => {
              const active = visibleLibraryTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onMouseEnter={() => setActiveTool(tool.id)}
                  onClick={() => {
                    setActiveTool(tool.id);
                    setPinnedLibraryTool((current) => current === tool.id ? null : tool.id);
                  }}
                  title={tool.label}
                  style={{
                    width: 58,
                    minHeight: 52,
                    borderRadius: 12,
                    background: active ? "linear-gradient(135deg,rgba(255,252,247,1),rgba(232,216,181,0.44))" : "rgba(255,252,247,0.55)",
                    border: active ? "1px solid rgba(184,146,90,0.62)" : "1px solid rgba(184,146,90,0.10)",
                    cursor: "pointer",
                    color: active ? "#4b2735" : "#806f66",
                    fontSize: 18,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    boxShadow: active ? "0 8px 18px rgba(100,70,40,0.12)" : "none",
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
        {visibleLibraryTool && (
          <div style={{
            position: "absolute",
            left: ICON_SIDEBAR_W,
            top: 0,
            bottom: 0,
            width: EXPANDED_PANEL_W, maxWidth: EXPANDED_PANEL_W, minWidth: 0,
            background: "rgba(255,252,247,0.98)",
            borderRight: "1px solid rgba(184,146,90,0.18)",
            borderLeft: "1px solid rgba(255,255,255,0.72)",
            overflow: "hidden", zIndex: 55,
            display: "flex", flexDirection: "column",
            boxShadow: "18px 0 40px rgba(70,50,35,0.14)",
            backdropFilter: "blur(18px)",
          }}>
            <div style={{
              padding: "14px 14px 10px", flexShrink: 0,
              borderBottom: "1px solid rgba(184,146,90,0.14)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "#4b2735", fontSize: 13, fontWeight: "700" }}>
                {TOOLS.find(t => t.id === visibleLibraryTool)?.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPinnedLibraryTool(null);
                  setActiveTool(null);
                  setSidebarHovered(false);
                }}
                style={{ background: "none", border: "none", color: "#8884a8", cursor: "pointer", fontSize: 14, padding: 0 }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ExpandedPanel
                tool={visibleLibraryTool}
                onAddText={addText}
                onAddElement={addElement}
                onAddApp={addApp}
                onAddInvitationBlock={addInvitationBlock}
                onApplyTheme={applyTheme}
                activeThemeId={themeId}
                onApplyPremiumTemplate={applyPremiumTemplate}
                canvasTemplates={canvasTemplates}
                onApplyTemplateFromDb={applyTemplateFromDb}
                applyingTemplateId={applyingTemplateId}
                isApplyingTemplate={isApplyingTemplate}
                templateApplyError={templateApplyError}
                eventFeatureSource={featureSource}
              />
            </div>
          </div>
        )}
        </div>
          );
        })()}

        {/* -- CANVAS WORKSPACE -- */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          // Slightly cooler, lighter neutral — reduces the beige tint bleed onto the canvas
          background: "linear-gradient(180deg,#e2ddd8 0%,#d5d0cb 100%)",
          overflow: "hidden",
          // Defensive: no inherited @keyframes animation can breathe through this wrapper
          animation: "none",
        }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "auto",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: vw < 1400 ? "14px 8px" : "22px 16px",
              // Haze dialed from 0.14 → 0.05 — no more warm-white wash over the canvas
              background: "radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.05) 0%, rgba(210,205,200,0) 68%)",
            }}
            ref={scrollRef}
            onMouseDown={onWorkspaceMouseDown}
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
                  // Sharper, colder shadow — precise drop, no diffuse warm haze
                  // Ring thinned from 0.20 → 0.12 so canvas edge is crisp, not smoky
                  boxShadow: "0 12px 28px rgba(60,55,50,0.18), 0 2px 6px rgba(60,55,50,0.10), 0 0 0 1px rgba(110,105,100,0.12)",
                  // Defensive: explicit no-animation on canvas root — prevents any future
                  // CSS @keyframes from reaching this element regardless of class ancestry
                  animation: "none",
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
                  .map((el) => {
                    const elH = estimateElementRenderHeight(el);
                    const sec =
                      sections.find((s) => el.y >= s.y && el.y < s.y + s.height) ??
                      (el.y < (sections[0]?.y ?? 0)
                        ? sections[0]
                        : sections[sections.length - 1]);
                    const clipTop = sec ? Math.max(0, sec.y - el.y) : 0;
                    const clipBottom = sec ? Math.max(0, el.y + elH - (sec.y + sec.height)) : 0;
                    return (
                      <RenderElement
                        key={el.id}
                        el={el}
                        clipTop={clipTop}
                        clipBottom={clipBottom}
                        selected={el.id === selectedId && !preview}
                        highlighted={selectedIds.length > 1 && selectedIds.includes(el.id) && !preview}
                        onMouseDown={(e) => !preview && onMoveStart(e, el.id)}
                        onContextMenu={(event) => openElementContextMenu(event, el.id)}
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
                        onInlineTextCommit={(content) => patchElement(el.id, { content })}
                        onReplaceImage={replaceSelectedImage}
                        onEditQr={editSelectedQr}
                      />
                    );
                  })}

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
                  const TOOLBAR_W = 310;
                  const TOOLBAR_H = 30;
                  const GAP = 10;
                  const minX = Math.min(...selEls.map((el) => el.x)) - PAD;
                  const minY = Math.min(...selEls.map((el) => el.y)) - PAD;
                  const maxX = Math.max(...selEls.map((el) => el.x + el.width)) + PAD;
                  const maxY = Math.max(...selEls.map((el) => el.y + estimateElementRenderHeight(el))) + PAD;
                  const canPlaceTop = minY - TOOLBAR_H - GAP >= 8;
                  const canPlaceBottom = maxY + GAP + TOOLBAR_H <= documentHeight - 8;
                  const toolbarTop = canPlaceTop
                    ? minY - TOOLBAR_H - GAP
                    : canPlaceBottom
                      ? maxY + GAP
                      : Math.max(8, Math.min(documentHeight - TOOLBAR_H - 8, minY + 4));
                  const toolbarLeft = Math.max(8, Math.min(canvasW - TOOLBAR_W - 8, minX));
                  const groupToolbarButton: React.CSSProperties = {
                    minWidth: 44,
                    height: 22,
                    border: "1px solid rgba(184,146,90,0.30)",
                    borderRadius: 999,
                    background: "rgba(255,252,247,0.86)",
                    color: "#4b2735",
                    cursor: "pointer",
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "Inter, system-ui, sans-serif",
                    padding: "0 7px",
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 12px rgba(70,50,35,0.08)",
                  };
                  const canDistribute = selEls.filter((el) => !el.locked).length >= 3;
                  const ungroupButtonStyle: React.CSSProperties = {
                    ...groupToolbarButton,
                    minWidth: 74,
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
                          border: "1px solid rgba(184,146,90,0.85)",
                          borderRadius: 8,
                          pointerEvents: "none",
                          zIndex: 9997,
                          boxShadow: "0 0 0 3px rgba(184,146,90,0.10)",
                        }}
                      >
                        <div style={{
                          position: "absolute",
                          top: -26, left: 0,
                          background: "rgba(255,252,247,0.84)",
                          color: "#4b2735",
                          fontSize: 9, fontWeight: 700,
                          padding: "2px 7px", borderRadius: 999,
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
                          left: toolbarLeft,
                          top: toolbarTop,
                          zIndex: 10002,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 5px",
                          borderRadius: 999,
                          background: "rgba(255,252,247,0.82)",
                          backdropFilter: "blur(6px)",
                          border: "1px solid rgba(184,146,90,0.34)",
                          boxShadow: "0 8px 22px rgba(70,50,35,0.14)",
                          pointerEvents: "auto",
                          maxWidth: TOOLBAR_W,
                        }}
                      >
                        <button type="button" title="Alinear" onClick={() => alignSelectedGroup("centerX")} style={{ ...groupToolbarButton, minWidth: 54 }}>Alinear</button>
                        <button type="button" title="Agrupar elementos seleccionados" onClick={groupSelected} style={{ ...groupToolbarButton, minWidth: 52 }}>Agrupar</button>
                        <button type="button" title="Desagrupar selección" disabled={!canUngroupSelection} onClick={ungroupSelected} style={ungroupButtonStyle}>Desagrupar</button>
                        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(184,146,90,0.24)" }} />
                        <button type="button" title="Duplicar grupo" onClick={duplicateSelectedGroup} style={{ ...groupToolbarButton, minWidth: 50, color: "#8a5d22" }}>Duplicar</button>
                        <button type="button" title="Eliminar grupo" onClick={deleteSelectedGroup} style={{ ...groupToolbarButton, minWidth: 46, color: "#b42336" }}>Eliminar</button>
                        <div style={{ position: "relative" }}>
                          <button
                            type="button"
                            title="Más acciones"
                            onClick={() => setMultiToolbarMenuOpen((v) => !v)}
                            style={{ ...groupToolbarButton, minWidth: 42 }}
                          >
                            Mas
                          </button>
                          {multiToolbarMenuOpen && (
                            <div
                              style={{
                                position: "absolute",
                                top: 26,
                                right: 0,
                                minWidth: 170,
                                padding: 6,
                                borderRadius: 12,
                                background: "rgba(255,252,247,0.95)",
                                border: "1px solid rgba(184,146,90,0.30)",
                                boxShadow: "0 10px 22px rgba(70,50,35,0.14)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                zIndex: 10003,
                              }}
                            >
                              <button type="button" onClick={() => { alignSelectedGroup("left"); setMultiToolbarMenuOpen(false); }} style={groupToolbarButton}>Alinear izquierda</button>
                              <button type="button" onClick={() => { alignSelectedGroup("right"); setMultiToolbarMenuOpen(false); }} style={groupToolbarButton}>Alinear derecha</button>
                              <button type="button" onClick={() => { alignSelectedGroup("top"); setMultiToolbarMenuOpen(false); }} style={groupToolbarButton}>Alinear arriba</button>
                              <button type="button" onClick={() => { alignSelectedGroup("centerY"); setMultiToolbarMenuOpen(false); }} style={groupToolbarButton}>Centro vertical</button>
                              <button type="button" onClick={() => { alignSelectedGroup("bottom"); setMultiToolbarMenuOpen(false); }} style={groupToolbarButton}>Alinear abajo</button>
                              <button type="button" onClick={() => { distributeSelectedGroup("horizontal"); setMultiToolbarMenuOpen(false); }} disabled={!canDistribute} style={{ ...groupToolbarButton, opacity: canDistribute ? 1 : 0.45, cursor: canDistribute ? "pointer" : "not-allowed" }}>Distribuir horizontal</button>
                              <button type="button" onClick={() => { distributeSelectedGroup("vertical"); setMultiToolbarMenuOpen(false); }} disabled={!canDistribute} style={{ ...groupToolbarButton, opacity: canDistribute ? 1 : 0.45, cursor: canDistribute ? "pointer" : "not-allowed" }}>Distribuir vertical</button>
                            </div>
                          )}
                        </div>
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
                color: "#8a7b72",
                fontSize: 10,
                letterSpacing: "0.08em",
                fontFamily: "Inter, system-ui, sans-serif",
              }}>
                {canvasW} × {documentHeight} px · {viewportMode === "desktop" ? "Escritorio" : "Móvil"}
              </p>
            </div>
          </div>

          <div style={{
            minHeight: 78,
            flexShrink: 0,
            background: "linear-gradient(180deg, rgba(221,215,207,0.96), rgba(214,208,200,0.98))",
            borderTop: "1px solid rgba(150,128,112,0.20)",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
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
                    width: 118,
                    minWidth: 118,
                    height: 58,
                    borderRadius: 12,
                    border: active ? "1px solid rgba(184,146,90,0.72)" : "1px solid rgba(184,146,90,0.14)",
                    background: active ? "rgba(184,146,90,0.14)" : "rgba(255,255,255,0.58)",
                    color: active ? "#4b2735" : "#6f625c",
                    cursor: "pointer",
                    padding: 6,
                    display: "grid",
                    gridTemplateColumns: "32px 1fr",
                    alignItems: "center",
                    gap: 7,
                    boxShadow: active ? "0 8px 18px rgba(100,70,40,0.10)" : "none",
                    fontFamily: "Inter, system-ui, sans-serif",
                    textAlign: "left",
                  }}
                >
                  <span style={{
                    width: 32,
                    height: 42,
                    borderRadius: 7,
                    background: section.background,
                    border: "1px solid rgba(75,39,53,0.10)",
                    boxShadow: "inset 0 0 14px rgba(70,50,35,0.16)",
                  }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 850, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {section.label}
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontSize: 9, color: active ? "#8a5d22" : "#9a8a80" }}>
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
                width: 90,
                minWidth: 90,
                height: 58,
                borderRadius: 12,
                border: "1px dashed rgba(184,146,90,0.55)",
                background: "rgba(255,255,255,0.48)",
                color: "#7a5262",
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

        {/* ── LAYERS PANEL — floating overlay, independent from properties ── */}
        {showLayersPanel && (
          <div
            data-canvas-control="true"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              top: 10,
              right: showInspector ? INSPECTOR_W + 22 : 10,
              bottom: 10,
              width: Math.min(300, INSPECTOR_W),
              minWidth: Math.min(300, INSPECTOR_W),
              height: "auto",
              flexShrink: 0,
              zIndex: 49,
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "-18px 20px 48px rgba(24,16,22,0.20)",
              transform: "translateX(0)",
              opacity: 1,
              transition: "opacity 180ms ease, transform 180ms ease",
            }}
          >
            <button
              type="button"
              title="Cerrar capas"
              onClick={() => setLayersPanelOpen(false)}
              style={{
                position: "absolute",
                right: 10,
                top: 12,
                zIndex: 2,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "1px solid rgba(184,146,90,0.18)",
                background: "rgba(255,252,247,0.72)",
                color: "#4b2735",
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(38,24,30,0.14)",
                backdropFilter: "blur(8px)",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <RightPanel
              element={null}
              onChange={patchElement}
              onDuplicate={duplicateElement}
              onDelete={deleteSelected}
              onBringToFront={bringToFront}
              onSendToBack={sendToBack}
              section={null}
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
              panelMode="layers"
            />
          </div>
        )}

        {/* ── RIGHT INSPECTOR — floating overlay, never shifts the canvas ── */}
        {showInspector && (
          <div
            data-canvas-control="true"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
            position: "absolute",
            top: 10,
            right: 10,
            bottom: 10,
            width: INSPECTOR_W,
            minWidth: INSPECTOR_W,
            height: "auto",
            flexShrink: 0, zIndex: 50,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "-18px 20px 48px rgba(24,16,22,0.24)",
            transform: "translateX(0)",
            opacity: 1,
            transition: "opacity 180ms ease, transform 180ms ease",
          }}>
            <button
              type="button"
              title="Cerrar propiedades"
              onClick={() => setInspectorOpen(false)}
              style={{
                position: "absolute",
                right: 10,
                top: 12,
                zIndex: 2,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "1px solid rgba(184,146,90,0.18)",
                background: "rgba(255,252,247,0.72)",
                color: "#4b2735",
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(38,24,30,0.14)",
                backdropFilter: "blur(8px)",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <RightPanel
              element={selected && !preview ? selected : null}
              onChange={patchElement}
              onDuplicate={duplicateElement}
              onDelete={deleteSelected}
              onBringToFront={bringToFront}
              onSendToBack={sendToBack}
              section={null}
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
              panelMode="properties"
            />
          </div>
        )}

        {/* Floating toggle when inspector is closed */}
        {inspectorHasContext && !inspectorOpen && (
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

        {!preview && !layersPanelOpen && (
          <button
            type="button"
            title="Abrir capas"
            onClick={() => setLayersPanelOpen(true)}
            style={{
              position: "absolute", right: 12, top: inspectorHasContext ? "calc(50% + 76px)" : "50%", transform: "translateY(-50%)",
              zIndex: 45, width: 28, height: 64, borderRadius: 8,
              background: "#1e1e2d", border: "1px solid #2a2a3d",
              cursor: "pointer", color: "#8884a8", fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              writingMode: "vertical-rl",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f4d28a"; e.currentTarget.style.borderColor = "#b8925a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8884a8"; e.currentTarget.style.borderColor = "#2a2a3d"; }}
          >
            Capas
          </button>
        )}

        {elementContextMenu && contextMenuElement && !preview && (
          <div
            role="menu"
            aria-label="Acciones del elemento"
            onMouseDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "fixed",
              left: elementContextMenu.x,
              top: elementContextMenu.y,
              zIndex: 90,
              width: 176,
              padding: 5,
              borderRadius: 14,
              background: "rgba(255,252,247,0.82)",
              border: "1px solid rgba(184,146,90,0.16)",
              boxShadow: "0 16px 38px rgba(38,24,30,0.16)",
              backdropFilter: "blur(8px)",
              display: "grid",
              gap: 3,
              fontFamily: "Inter, system-ui, sans-serif",
              animation: "kaisContextMenuIn 120ms ease-out",
            }}
          >
            <style>{`@keyframes kaisContextMenuIn{from{opacity:0;transform:translateY(-2px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
            {[
              {
                label: "Duplicar",
                action: () => duplicateElementById(contextMenuElement.id),
              },
              {
                label: contextMenuElement.locked ? "Desbloquear" : "Bloquear",
                action: () => toggleElementLocked(contextMenuElement.id),
              },
              {
                label: "Traer adelante",
                action: () => bringElementToFront(contextMenuElement.id),
              },
              {
                label: "Enviar atras",
                action: () => sendElementToBack(contextMenuElement.id),
              },
              {
                label: "Eliminar",
                danger: true,
                action: () => deleteElementById(contextMenuElement.id),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setElementContextMenu(null);
                  item.action();
                }}
                style={{
                  height: 30,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: item.danger ? "#9f1d2f" : "#49313b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 9px",
                  fontSize: 11,
                  fontWeight: 750,
                  letterSpacing: "0.01em",
                  textAlign: "left",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = item.danger
                    ? "rgba(159,29,47,0.08)"
                    : "rgba(184,146,90,0.10)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {templateToApply && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 80,
              display: "grid",
              placeItems: "center",
              padding: 18,
              background: "rgba(21,13,20,0.58)",
              backdropFilter: "blur(10px)",
            }}
            onClick={() => {
              if (!isApplyingTemplate) setTemplateToApply(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(380px, 100%)",
                borderRadius: 24,
                padding: 18,
                background: "linear-gradient(180deg,rgba(255,252,247,0.98),rgba(255,244,232,0.94))",
                border: "1px solid rgba(184,146,90,0.28)",
                boxShadow: "0 28px 80px rgba(16,10,14,0.44)",
                color: "#3c2430",
              }}
            >
              <div style={{
                width: 78,
                height: 124,
                margin: "0 auto 14px",
                borderRadius: 22,
                background: templateToApply.thumbnailUrl || templateToApply.previewImageUrl
                  ? `linear-gradient(rgba(18,14,20,0.14),rgba(18,14,20,0.14)),url(${templateToApply.thumbnailUrl || templateToApply.previewImageUrl}) center/cover`
                  : "radial-gradient(circle at 32% 18%,rgba(255,255,255,0.78),transparent 24%),radial-gradient(circle at 70% 78%,rgba(184,146,90,0.45),transparent 30%),linear-gradient(160deg,#211323,#6f3a4e 44%,#d7b271)",
                boxShadow: "0 18px 36px rgba(38,21,16,0.22), inset 0 0 0 1px rgba(255,255,255,0.34)",
              }} />
              <p style={{ color: "#b8925a", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px", textAlign: "center", fontWeight: 900 }}>
                Aplicar diseno
              </p>
              <h3 style={{ margin: "0 0 8px", textAlign: "center", fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 25, lineHeight: 1.05, color: "#3c2430" }}>
                {templateToApply.name}
              </h3>
              <p style={{ margin: "0 0 16px", color: "#7c5d4d", fontSize: 12, lineHeight: 1.55, textAlign: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
                Se reemplazara la composicion visual actual. Los nombres, fechas, ubicacion, mensajes y apps del evento se conservaran.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  disabled={isApplyingTemplate}
                  onClick={confirmApplyTemplateFromDb}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(184,146,90,0.34)",
                    borderRadius: 14,
                    padding: "12px 14px",
                    background: isApplyingTemplate ? "rgba(184,146,90,0.22)" : "linear-gradient(135deg,#2b1b24,#b8925a)",
                    color: "#fff7ef",
                    cursor: isApplyingTemplate ? "wait" : "pointer",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                    boxShadow: "0 14px 28px rgba(61,35,21,0.18)",
                  }}
                >
                  {isApplyingTemplate ? "Aplicando..." : "Aplicar diseno"}
                </button>
                <button
                  type="button"
                  disabled={isApplyingTemplate}
                  onClick={() => setTemplateToApply(null)}
                  style={{
                    width: "100%",
                    border: "1px solid rgba(184,146,90,0.18)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.62)",
                    color: "#7c5d4d",
                    cursor: isApplyingTemplate ? "wait" : "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Mantener mi diseno actual
                </button>
              </div>
            </div>
          </div>
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
  padding: "4px 10px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(149,129,112,0.24)",
  borderRadius: 999,
  cursor: "pointer",
  color: "#c8baaf",
  fontSize: 11,
  fontWeight: 550,
  fontFamily: "Inter, system-ui, sans-serif",
  whiteSpace: "nowrap",
  transition: "all 0.15s",
};
