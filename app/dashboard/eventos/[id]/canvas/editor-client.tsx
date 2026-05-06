"use client";

import { useReducer, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Save, X, Eye, Copy, Lock, Unlock, EyeOff, BringToFront, SendToBack } from "lucide-react";
import { saveCanvasDesign, clearCanvasDesign } from "@/app/actions/canvas";
import { CanvasMobileRenderer } from "@/components/public-invitation/canvas-mobile-renderer";
import type { CanvasResizeHandle } from "@/components/public-invitation/canvas-mobile-renderer";
import {
  DEFAULT_MOBILE_CANVAS_SECTIONS,
  MOBILE_CANVAS_HEIGHT,
  getGlobalYPercent,
  normalizeCanvasDesign,
} from "@/lib/canvas/normalize-canvas-design";
import { DECORATIONS } from "@/lib/decorations";
import type { Decoration } from "@/lib/decorations";
import type { CanvasDesign, CanvasElement, CanvasTextElement, CanvasImageElement, CanvasSectionId } from "@/lib/types";
import type { Event } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REF_W = 390;
const REF_H = 844;
const HANDLE_PX = 9;
const FONT_OPTIONS = [
  { label: "Serif (defecto)", value: "Georgia, serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Great Vibes", value: "'Great Vibes', cursive" },
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Sans-serif", value: "system-ui, sans-serif" },
];

const ANIMATION_OPTIONS = [
  { label: "Sin animacion", value: "none" },
  { label: "Fade up", value: "fade-up" },
  { label: "Fade in", value: "fade-in" },
  { label: "Zoom in", value: "zoom-in" },
  { label: "Float soft", value: "float-soft" },
  { label: "Pulse glow", value: "pulse-glow" },
  { label: "Shimmer", value: "shimmer" },
  { label: "Parallax soft", value: "parallax-soft" },
];

const EFFECT_PRESETS = [
  { label: "Circulo blur", value: "blur-circle" },
  { label: "Brillo", value: "glow" },
  { label: "Flor/shape", value: "flower-shape" },
  { label: "Overlay degradado", value: "gradient-overlay" },
  { label: "Separador", value: "divider" },
] as const;

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Great+Vibes&family=Dancing+Script:wght@400;700&family=Montserrat:wght@300;400;600&display=swap";


const CANVAS_SECTIONS: { id: CanvasSectionId; label: string }[] = [
  { id: "hero",          label: "Hero" },
  { id: "countdown",    label: "Cuenta regresiva" },
  { id: "presentation", label: "Presentación" },
  { id: "messages",     label: "Mensajes" },
  { id: "details",      label: "Detalles" },
  { id: "church",       label: "Iglesia" },
  { id: "dresscode",    label: "Vestimenta" },
  { id: "rsvp",         label: "RSVP" },
  { id: "footer",       label: "Footer" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drag state — union of move / resize modes
// ─────────────────────────────────────────────────────────────────────────────

type DragMove = {
  kind: "move";
  elementId: string;
  startMouseX: number;
  startMouseY: number;
  startElX: number;
  startElY: number;
};

type DragResize = {
  kind: "resize";
  elementId: string;
  handle: CanvasResizeHandle;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  elementType: "text" | "image";
};

type DragState = DragMove | DragResize;

// ─────────────────────────────────────────────────────────────────────────────
// State & Reducer
// ─────────────────────────────────────────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "error";
type EffectPreset = (typeof EFFECT_PRESETS)[number]["value"];

type EditorState = {
  design: CanvasDesign;
  selectedId: string | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
};

type EditorAction =
  | { type: "ADD_TEXT"; sectionId: CanvasSectionId }
  | { type: "ADD_EFFECT"; preset: EffectPreset; sectionId: CanvasSectionId }
  | { type: "ADD_IMAGE_URL"; url: string; sectionId: CanvasSectionId }
  | { type: "SELECT"; id: string | null }
  | { type: "UPDATE_TEXT"; id: string; patch: Partial<CanvasTextElement> }
  | { type: "UPDATE_ELEMENT"; id: string; patch: Partial<CanvasElement> }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "RESIZE"; id: string; x?: number; y?: number; width: number; height?: number }
  | { type: "DUPLICATE"; id: string }
  | { type: "DELETE"; id: string }
  | { type: "BRING_FORWARD"; id: string }
  | { type: "SEND_BACKWARD"; id: string }
  | { type: "BRING_TO_FRONT"; id: string }
  | { type: "SEND_TO_BACK"; id: string }
  | { type: "MARK_SAVING" }
  | { type: "MARK_SAVED" }
  | { type: "MARK_ERROR" }
  | { type: "ADD_IMAGE"; url: string; sectionId: CanvasSectionId }
  | { type: "SET_SECTION_ID"; id: string; sectionId: CanvasSectionId }
  | { type: "UPDATE_IMAGE"; id: string; patch: Partial<CanvasImageElement> }
  | { type: "CLEAR" }
  | { type: "RESTORE"; design: CanvasDesign };

function createEmptyDesign(): CanvasDesign {
  return {
    version: 1,
    viewport: "mobile",
    width: REF_W,
    height: MOBILE_CANVAS_HEIGHT,
    refWidth: REF_W,
    refHeight: REF_H,
    sections: DEFAULT_MOBILE_CANVAS_SECTIONS,
    background: { type: "none" },
    elements: [],
    updatedAt: new Date().toISOString(),
  };
}

function createTextElement(sectionId: CanvasSectionId): CanvasTextElement {
  return {
    id: crypto.randomUUID().slice(0, 8),
    type: "text",
    sectionId,
    x: ((REF_W - 280) / 2 / REF_W) * 100,
    y: getGlobalYPercent(sectionId, 50),
    width: 280,
    height: null,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    locked: false,
    visible: true,
    device: "all",
    content: "Texto nuevo",
    fontFamily: "Georgia, serif",
    fontSize: 32,
    fontWeight: "400",
    fontStyle: "normal",
    textAlign: "center",
    color: "#ffffff",
    lineHeight: 1.2,
    letterSpacing: 0,
    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
    textDecoration: "none",
    autoHeight: true,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// ─── Decoration color helpers ─────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildDecorationBackground(
  preset: string,
  color = "#ffffff",
  accentColor = "#f4d27a"
): string {
  switch (preset) {
    case "blur-circle":
      return `radial-gradient(circle, ${hexToRgba(color, 1)} 0%, ${hexToRgba(accentColor, 0.9)} 30%, ${hexToRgba(accentColor, 0.45)} 55%, ${hexToRgba(accentColor, 0)} 75%)`;
    case "glow":
      return `radial-gradient(circle, ${hexToRgba(color, 1)} 0%, ${hexToRgba(accentColor, 0.92)} 28%, ${hexToRgba(accentColor, 0.55)} 52%, ${hexToRgba(accentColor, 0)} 76%)`;
    case "flower-shape":
      return `radial-gradient(circle at 40% 40%, ${hexToRgba(color, 1)} 0%, ${hexToRgba(accentColor, 0.86)} 38%, ${hexToRgba(accentColor, 0.38)} 60%, ${hexToRgba(accentColor, 0)} 78%)`;
    case "gradient-overlay":
      return `linear-gradient(to bottom, ${hexToRgba(color, 0)} 0%, ${hexToRgba(color, 0.35)} 42%, ${hexToRgba(color, 0.85)} 100%)`;
    case "divider":
      return `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${hexToRgba(accentColor, 1)} 28%, ${hexToRgba(color, 1)} 50%, ${hexToRgba(accentColor, 1)} 72%, rgba(255,255,255,0) 100%)`;
    default:
      return `radial-gradient(circle, ${hexToRgba(color, 1)} 0%, ${hexToRgba(color, 0.5)} 52%, ${hexToRgba(color, 0)} 76%)`;
  }
}

function createImageElement(url: string, sectionId: CanvasSectionId): import("@/lib/types").CanvasImageElement {
  return {
    id: crypto.randomUUID().slice(0, 8),
    type: "image",
    sectionId,
    x: ((REF_W - 120) / 2 / REF_W) * 100,
    y: getGlobalYPercent(sectionId, 30),
    width: 120,
    height: 120,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    locked: false,
    visible: true,
    device: "all",
    url,
    storagePath: null,
    objectFit: "contain",
    effect: "none",
    glowColor: "#f4d27a",
    glowStrength: "medium",
    flipX: false,
    flipY: false,
  };
}

function createEffectElement(preset: EffectPreset, sectionId: CanvasSectionId): CanvasTextElement {
  // x=50 => CSS left:50% + translate(-50%) => element is centered
  const base: CanvasTextElement = {
    id: crypto.randomUUID().slice(0, 8),
    type: "text",
    sectionId,
    x: 50,
    y: getGlobalYPercent(sectionId, 50),
    width: 180,
    height: 180,
    rotation: 0,
    opacity: 1,
    zIndex: 3,
    locked: false,
    visible: true,
    device: "all",
    content: "",
    fontFamily: "system-ui, sans-serif",
    fontSize: 14,
    fontWeight: "400",
    fontStyle: "normal",
    textAlign: "center",
    color: "#ffffff",
    lineHeight: 1.2,
    letterSpacing: 0,
    textShadow: null,
    textDecoration: "none",
    autoHeight: false,
    style: {
      borderRadius: 999,
      opacity: 1,
      mixBlendMode: "screen",
      decorationPreset: preset,
      color: "#ffffff",
      accentColor: "#f4d27a",
    },
  };

  if (preset === "blur-circle") {
    return {
      ...base,
      width: 200,
      height: 200,
      style: {
        ...base.style,
        background: buildDecorationBackground("blur-circle", "#ffe696", "#ffb43c"),
        blur: 10,
        borderRadius: 9999,
        opacity: 1,
        mixBlendMode: "screen",
        color: "#ffe696",
        accentColor: "#ffb43c",
      },
    };
  }

  if (preset === "glow") {
    return {
      ...base,
      width: 140,
      height: 140,
      style: {
        ...base.style,
        background: buildDecorationBackground("glow", "#ffe6a0", "#f4d27a"),
        blur: 8,
        borderRadius: 9999,
        opacity: 1,
        mixBlendMode: "screen",
        boxShadow: "0 0 36px rgba(244,210,122,0.85), 0 0 90px rgba(244,210,122,0.42)",
        animation: "pulse-glow",
        animationDuration: "3s",
        color: "#ffe6a0",
        accentColor: "#f4d27a",
      },
    };
  }

  if (preset === "flower-shape") {
    return {
      ...base,
      width: 150,
      height: 150,
      rotation: -12,
      zIndex: 4,
      style: {
        ...base.style,
        background: buildDecorationBackground("flower-shape", "#fff8dc", "#f4d27a"),
        border: "1px solid rgba(255,255,255,0.22)",
        blur: 3,
        borderRadius: 42,
        opacity: 1,
        mixBlendMode: "screen",
        color: "#fff8dc",
        accentColor: "#f4d27a",
      },
    };
  }

  if (preset === "gradient-overlay") {
    return {
      ...base,
      x: 50,
      y: getGlobalYPercent(sectionId, 50),
      width: REF_W,
      height: REF_H,
      zIndex: 2,
      style: {
        ...base.style,
        borderRadius: 0,
        opacity: 1,
        mixBlendMode: "normal",
        background: buildDecorationBackground("gradient-overlay", "#000000", "#000000"),
        color: "#000000",
        accentColor: "#000000",
      },
    };
  }

  // divider / separator
  return {
    ...base,
    x: 50,
    width: 240,
    height: 28,
    zIndex: 3,
    style: {
      ...base.style,
      borderRadius: 999,
      opacity: 1,
      mixBlendMode: "screen",
      background: buildDecorationBackground("divider", "#ffffff", "#f4d27a"),
      boxShadow: "0 0 14px rgba(244,210,122,0.5)",
      color: "#ffffff",
      accentColor: "#f4d27a",
    },
  };
}

function cloneDesign(design: CanvasDesign): CanvasDesign {
  return JSON.parse(JSON.stringify(design)) as CanvasDesign;
}

function createDuplicatedElement(element: CanvasElement): CanvasElement {
  return {
    ...cloneDesign({ ...createEmptyDesign(), elements: [element] }).elements[0],
    id: crypto.randomUUID().slice(0, 8),
    x: clamp(element.x + 4, 0, 100),
    y: clamp(element.y + 1.5, 0, 100),
    locked: false,
  } as CanvasElement;
}

function snapPercent(value: number, guides: number[]) {
  const threshold = 1.2;
  const guide = guides.find((item) => Math.abs(item - value) <= threshold);
  return guide ?? value;
}

function getElementCanvasRect(element: CanvasElement, canvasDesign: CanvasDesign) {
  const canvasWidth = canvasDesign.width ?? REF_W;
  const canvasHeight = canvasDesign.height ?? MOBILE_CANVAS_HEIGHT;
  return {
    x: (element.x / 100) * canvasWidth,
    y: (element.y / 100) * canvasHeight,
    width: element.width,
    height: element.height ?? estimateElementHeight(element),
  };
}

function estimateElementHeight(element: CanvasElement) {
  if (element.type === "image") return element.height ?? element.width;

  const explicitLines = element.content.split("\n").length;
  const charsPerLine = Math.max(1, Math.floor(element.width / Math.max(element.fontSize * 0.55, 1)));
  const wrappedLines = element.content
    .split("\n")
    .reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  const lineCount = Math.max(explicitLines, wrappedLines);

  return Math.max(24, lineCount * element.fontSize * element.lineHeight);
}

function canvasXToPercent(x: number, canvasDesign: CanvasDesign) {
  return (x / (canvasDesign.width ?? REF_W)) * 100;
}

function canvasYToPercent(y: number, canvasDesign: CanvasDesign) {
  return (y / (canvasDesign.height ?? MOBILE_CANVAS_HEIGHT)) * 100;
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "ADD_IMAGE": {
      const el = createImageElement(action.url, action.sectionId);
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      el.zIndex = maxZ + 1;
      return {
        ...state,
        design: { ...state.design, elements: [...state.design.elements, el] },
        selectedId: el.id,
        isDirty: true,
      };
    }
    case "ADD_IMAGE_URL": {
      const el = createImageElement(action.url, action.sectionId);
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      el.zIndex = maxZ + 1;
      return {
        ...state,
        design: { ...state.design, elements: [...state.design.elements, el] },
        selectedId: el.id,
        isDirty: true,
      };
    }
    case "ADD_TEXT": {
      const el = createTextElement(action.sectionId);
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      el.zIndex = maxZ + 1;
      return {
        ...state,
        design: { ...state.design, elements: [...state.design.elements, el] },
        selectedId: el.id,
        isDirty: true,
      };
    }
    case "ADD_EFFECT": {
      const created = createEffectElement(action.preset, action.sectionId);
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const el: CanvasTextElement = {
        ...created,
        zIndex: maxZ + 1,
        style: { ...(created.style ?? {}) },
      };
      return {
        ...state,
        design: {
          ...state.design,
          elements: [...state.design.elements, el],
          updatedAt: new Date().toISOString(),
        },
        selectedId: el.id,
        isDirty: true,
      };
    }
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "UPDATE_TEXT":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id && el.type === "text" ? { ...el, ...action.patch } : el
          ),
        },
        isDirty: true,
      };
    case "UPDATE_ELEMENT":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, ...action.patch } as CanvasElement : el
          ),
        },
        isDirty: true,
      };
    case "MOVE":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id
              ? { ...el, x: clamp(action.x, 0, 100), y: clamp(action.y, 0, 100) }
              : el
          ),
        },
        isDirty: true,
      };
    case "RESIZE":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id
              ? {
                  ...el,
                  ...(action.x !== undefined ? { x: clamp(action.x, 0, 100) } : {}),
                  ...(action.y !== undefined ? { y: clamp(action.y, 0, 100) } : {}),
                  width: clamp(action.width, 24, 600),
                  ...(action.height !== undefined
                    ? { height: clamp(action.height, 24, 600) }
                    : {}),
                }
              : el
          ),
        },
        isDirty: true,
      };
    case "DELETE": {
      const remaining = state.design.elements.filter((el) => el.id !== action.id);
      return {
        ...state,
        design: { ...state.design, elements: remaining },
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        isDirty: true,
      };
    }
    case "DUPLICATE": {
      const source = state.design.elements.find((el) => el.id === action.id);
      if (!source) return state;
      const duplicate = createDuplicatedElement(source);
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      duplicate.zIndex = maxZ + 1;
      return {
        ...state,
        design: { ...state.design, elements: [...state.design.elements, duplicate] },
        selectedId: duplicate.id,
        isDirty: true,
      };
    }
    case "BRING_FORWARD":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, zIndex: clamp(el.zIndex + 1, 1, 99) } : el
          ),
        },
        isDirty: true,
      };
    case "SEND_BACKWARD":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, zIndex: clamp(el.zIndex - 1, 1, 99) } : el
          ),
        },
        isDirty: true,
      };
    case "BRING_TO_FRONT": {
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, zIndex: maxZ + 1 } : el
          ),
        },
        isDirty: true,
      };
    }
    case "SEND_TO_BACK": {
      const minZ = state.design.elements.reduce((m, e) => Math.min(m, e.zIndex), 99);
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, zIndex: Math.max(1, minZ - 1) } : el
          ),
        },
        isDirty: true,
      };
    }
    case "SET_SECTION_ID":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, sectionId: action.sectionId, y: getGlobalYPercent(action.sectionId, 50) } : el
          ),
        },
        isDirty: true,
      };
    case "UPDATE_IMAGE":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id && el.type === "image" ? { ...el, ...action.patch } : el
          ),
        },
        isDirty: true,
      };
    case "MARK_SAVING":
      return { ...state, saveStatus: "saving" };
    case "MARK_SAVED":
      return { ...state, isDirty: false, saveStatus: "saved" };
    case "MARK_ERROR":
      return { ...state, saveStatus: "error" };
    case "CLEAR":
      return {
        ...state,
        design: createEmptyDesign(),
        selectedId: null,
        isDirty: false,
        saveStatus: "saved",
      };
    case "RESTORE":
      return {
        ...state,
        design: normalizeCanvasDesign(action.design),
        selectedId: null,
        isDirty: true,
        saveStatus: "saved",
      };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  event: Event;
  initialDesign: CanvasDesign | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// CanvasEditorClient
// ─────────────────────────────────────────────────────────────────────────────

export function CanvasEditorClient({
  eventId,
  eventSlug,
  eventTitle,
  event,
  initialDesign,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    design: initialDesign ? normalizeCanvasDesign(initialDesign) : createEmptyDesign(),
    selectedId: null,
    isDirty: false,
    saveStatus: "saved",
  });
  const [activeSectionId, setActiveSectionId] = useState<CanvasSectionId>("hero");

  // Scale: fit the simulated phone viewport inside the editor viewport.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<CanvasDesign[]>([]);
  const redoRef = useRef<CanvasDesign[]>([]);
  const historyLastRef = useRef<string>("");
  const restoringRef = useRef(false);
  const [scale, setScale] = useState(0.55);
  const documentHeight = state.design.height ?? REF_H;

  useEffect(() => {
    if (!document.getElementById("kais-canvas-fonts")) {
      const link = document.createElement("link");
      link.id = "kais-canvas-fonts";
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_URL;
      document.head.appendChild(link);
    }
    const update = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const availableW = Math.max(0, rect.width - 32);
      const availableH = Math.max(0, rect.height - 48);
      const nextScale = Math.min(availableW / REF_W, availableH / REF_H, 1);
      setScale(Math.max(0.28, nextScale));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const current = JSON.stringify(state.design);
    if (!historyLastRef.current) {
      historyLastRef.current = current;
      historyRef.current = [cloneDesign(state.design)];
      return;
    }
    if (restoringRef.current) {
      restoringRef.current = false;
      historyLastRef.current = current;
      return;
    }
    if (current !== historyLastRef.current) {
      historyRef.current = [...historyRef.current.slice(-39), cloneDesign(state.design)];
      redoRef.current = [];
      historyLastRef.current = current;
    }
  }, [state.design]);

  useEffect(() => {
    if (!state.isDirty || state.saveStatus === "saving") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      dispatch({ type: "MARK_SAVING" });
      const { error } = await saveCanvasDesign(eventId, {
        ...normalizeCanvasDesign(state.design),
        updatedAt: new Date().toISOString(),
      });
      dispatch(error ? { type: "MARK_ERROR" } : { type: "MARK_SAVED" });
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [eventId, state.design, state.isDirty, state.saveStatus]);

  const undo = useCallback(() => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current[historyRef.current.length - 1];
    const previous = historyRef.current[historyRef.current.length - 2];
    redoRef.current = [cloneDesign(current), ...redoRef.current.slice(0, 39)];
    historyRef.current = historyRef.current.slice(0, -1);
    restoringRef.current = true;
    dispatch({ type: "RESTORE", design: previous });
  }, []);

  const redo = useCallback(() => {
    const next = redoRef.current[0];
    if (!next) return;
    redoRef.current = redoRef.current.slice(1);
    historyRef.current = [...historyRef.current, cloneDesign(next)];
    restoringRef.current = true;
    dispatch({ type: "RESTORE", design: next });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  // ── Drag ref (move OR resize) ─────────────────────────────────────────────

  const dragRef = useRef<DragState | null>(null);

  // Start MOVE drag (called from element wrapper)
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      const el = state.design.elements.find((el) => el.id === elementId);
      if (!el) return;
      dispatch({ type: "SELECT", id: elementId });
      if (el.locked) return;
      dragRef.current = {
        kind: "move",
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: el.x,
        startElY: el.y,
      };
    },
    [state.design]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-canvas-control='true']")) return;

      const elementNode = target.closest("[data-element-id]") as HTMLElement | null;
      if (!elementNode) {
        dispatch({ type: "SELECT", id: null });
        return;
      }

      const elementId = elementNode.dataset.elementId;
      if (!elementId) return;

      handleElementMouseDown(e, elementId);
    },
    [handleElementMouseDown]
  );

  // Start RESIZE drag (called from a corner handle)
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, handle: CanvasResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      const el = state.design.elements.find((el) => el.id === elementId);
      if (!el) return;
      const rect = getElementCanvasRect(el, state.design);
      dragRef.current = {
        kind: "resize",
        elementId,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: rect.x,
        startY: rect.y,
        startWidth: rect.width,
        startHeight: rect.height,
        elementType: el.type,
      };
    },
    [state.design]
  );

  // Mouse move — handles both move and resize
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === "move") {
        const dxPct = ((e.clientX - drag.startMouseX) / scale / REF_W) * 100;
        const dyPct = ((e.clientY - drag.startMouseY) / scale / documentHeight) * 100;
        const nextX = snapPercent(drag.startElX + dxPct, [0, 5, 50, 95, 100]);
        const nextY = snapPercent(drag.startElY + dyPct, [0, 50, 100]);
        dispatch({
          type: "MOVE",
          id: drag.elementId,
          x: nextX,
          y: nextY,
        });
      } else if (drag.kind === "resize") {
        const dxCanvas = (e.clientX - drag.startMouseX) / scale;
        const dyCanvas = (e.clientY - drag.startMouseY) / scale;
        const affectsLeft = drag.handle.includes("l");
        const affectsRight = drag.handle.includes("r");
        const affectsTop = drag.handle.includes("t");
        const affectsBottom = drag.handle.includes("b");

        let nextX = drag.startX;
        let nextY = drag.startY;
        let nextWidth = drag.startWidth;
        let nextHeight = drag.startHeight;

        if (affectsLeft) {
          nextX = drag.startX + dxCanvas;
          nextWidth = drag.startWidth - dxCanvas;
        } else if (affectsRight) {
          nextWidth = drag.startWidth + dxCanvas;
        }

        if (affectsTop) {
          nextY = drag.startY + dyCanvas;
          nextHeight = drag.startHeight - dyCanvas;
        } else if (affectsBottom) {
          nextHeight = drag.startHeight + dyCanvas;
        }

        if (nextWidth < 24 && affectsLeft) {
          nextX -= 24 - nextWidth;
        }
        if (nextHeight < 24 && affectsTop) {
          nextY -= 24 - nextHeight;
        }

        const width = clamp(nextWidth, 24, 600);
        const height = clamp(nextHeight, 24, 600);

        dispatch({
          type: "RESIZE",
          id: drag.elementId,
          x: affectsLeft ? canvasXToPercent(nextX, state.design) : undefined,
          y: affectsTop ? canvasYToPercent(nextY, state.design) : undefined,
          width,
          height: affectsTop || affectsBottom ? height : undefined,
        });
      }
    },
    [documentHeight, scale, state.design]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Save / Clear ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    dispatch({ type: "MARK_SAVING" });
    const { error } = await saveCanvasDesign(eventId, {
      ...normalizeCanvasDesign(state.design),
      updatedAt: new Date().toISOString(),
    });
    if (error) {
      dispatch({ type: "MARK_ERROR" });
      alert(`Error al guardar: ${error}`);
    } else {
      dispatch({ type: "MARK_SAVED" });
    }
  };

  const handleClear = async () => {
    if (!confirm("Eliminar todo el diseno canvas? El evento volvera a usar la plantilla.")) return;
    const { error } = await clearCanvasDesign(eventId);
    if (error) {
      alert(`Error: ${error}`);
    } else {
      dispatch({ type: "CLEAR" });
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const selected = state.design.elements.find((el) => el.id === state.selectedId) ?? null;
  const sortedElements = [...state.design.elements]
    .filter((el) => (el.sectionId ?? "hero") === activeSectionId)
    .sort((a, b) => a.zIndex - b.zIndex);

  const saveLabel =
    state.saveStatus === "saving"
      ? "Guardando..."
      : state.saveStatus === "error"
      ? "Error"
      : state.isDirty
      ? "Guardar *"
      : "Guardado";

  const isDragging = dragRef.current !== null;
  const [showDecorPicker, setShowDecorPicker] = useState(false);

  function scrollToSection(sectionId: CanvasSectionId) {
    const section = state.design.sections?.find((item) => item.id === sectionId);
    if (!section || !stageScrollRef.current) return;
    stageScrollRef.current.scrollTo({ top: section.y, behavior: "smooth" });
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-2.5">
        <Link
          href={`/dashboard/eventos/${eventId}`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <span className="text-neutral-600">|</span>
        <p className="truncate text-sm font-medium text-neutral-300">{eventTitle}</p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/evento/${eventSlug}?preview=1`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Link>
          {/* Decoration picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDecorPicker((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Decoracion
            </button>
            {showDecorPicker && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  Elegir decoracion
                </p>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {EFFECT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        dispatch({ type: "ADD_EFFECT", preset: preset.value, sectionId: activeSectionId });
                        setShowDecorPicker(false);
                      }}
                      className="rounded-lg border border-neutral-700 px-2 py-1.5 text-left text-[11px] text-neutral-200 transition hover:border-indigo-500 hover:bg-neutral-800"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DECORATIONS.map((d: Decoration) => (
                    <button
                      key={d.id}
                      type="button"
                      title={d.name}
                      onClick={() => {
                        dispatch({ type: "ADD_IMAGE", url: d.url, sectionId: activeSectionId });
                        setShowDecorPicker(false);
                      }}
                      className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition hover:bg-neutral-800"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.url} alt={d.name} className="h-8 w-8 object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "ADD_TEXT", sectionId: activeSectionId })}
            className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Texto
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("URL de imagen");
              if (url?.trim()) dispatch({ type: "ADD_IMAGE_URL", url: url.trim(), sectionId: activeSectionId });
            }}
            className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Imagen
          </button>
          <button
            type="button"
            onClick={undo}
            className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={state.saveStatus === "saving"}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saveLabel}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-md border border-red-900 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-950"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
      </header>


      {/* ── Section tabs ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 bg-neutral-900 px-3 py-1.5">
        {CANVAS_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setActiveSectionId(s.id);
              dispatch({ type: "SELECT", id: null });
              scrollToSection(s.id);
            }}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition ${
              activeSectionId === s.id
                ? "bg-indigo-600 font-semibold text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas area ────────────────────────────────────────────── */}
        <div
          ref={wrapperRef}
          className="flex flex-1 items-start justify-center overflow-hidden bg-neutral-950 p-4 pt-6"
        >
          {/* Outer shell — real screen dimensions */}
          <div
            style={{
              width: REF_W * scale,
              height: REF_H * scale,
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Inner stage at reference 390×844, scaled with CSS transform */}
            <div
              style={{
                width: REF_W,
                height: REF_H,
                position: "absolute",
                top: 0,
                left: "50%",
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: "top center",
                borderRadius: 12,
                overflowX: "hidden",
                overflowY: "auto",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.7)",
                cursor: isDragging ? "grabbing" : "default",
              }}
              ref={stageScrollRef}
              onMouseDown={handleCanvasMouseDown}
            >
              <CanvasMobileRenderer
                mode="editor"
                event={event}
                canvasDesign={state.design}
                selectedElementId={state.selectedId}
                onElementMouseDown={handleElementMouseDown}
                onResizeMouseDown={handleResizeMouseDown}
                onDuplicateElement={(id) => dispatch({ type: "DUPLICATE", id })}
                onDeleteElement={(id) => dispatch({ type: "DELETE", id })}
                onBringForward={(id) => dispatch({ type: "BRING_FORWARD", id })}
                onSendBackward={(id) => dispatch({ type: "SEND_BACKWARD", id })}
                onToggleLock={(id) => {
                  const element = state.design.elements.find((item) => item.id === id);
                  if (element) dispatch({ type: "UPDATE_ELEMENT", id, patch: { locked: !element.locked } });
                }}
                onToggleVisible={(id) => {
                  const element = state.design.elements.find((item) => item.id === id);
                  if (element) dispatch({ type: "UPDATE_ELEMENT", id, patch: { visible: !element.visible } });
                }}
              />

              {/* Empty-canvas hint */}
              {sortedElements.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: state.design.sections?.find((section) => section.id === activeSectionId)?.y ?? 0,
                    height: state.design.sections?.find((section) => section.id === activeSectionId)?.height ?? REF_H,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    pointerEvents: "none",
                  }}
                >
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, letterSpacing: "0.12em" }}>
                    CANVAS VACIO
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 11 }}>
                    {CANVAS_SECTIONS.find((s) => s.id === activeSectionId)?.label ?? activeSectionId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Properties panel ───────────────────────────────────────── */}
        <aside className="flex w-72 shrink-0 flex-col gap-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900">
          {selected ? (
            <>
              {/* Section assignment — common to all element types */}
              <div className="flex shrink-0 flex-col gap-1.5 border-b border-neutral-800 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Sección</p>
                <select
                  value={selected.sectionId ?? "hero"}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_SECTION_ID",
                      id: selected.id,
                      sectionId: e.target.value as CanvasSectionId,
                    })
                  }
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-indigo-500"
                >
                  {CANVAS_SECTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              {selected.type === "text" ? (
                <TextPropertiesPanel
                  element={selected}
                  onChange={(patch) =>
                    dispatch({ type: "UPDATE_TEXT", id: selected.id, patch })
                  }
                  onDelete={() => dispatch({ type: "DELETE", id: selected.id })}
                />
              ) : (
                <ImagePropertiesPanel
                  element={selected as CanvasImageElement}
                  onChange={(patch) =>
                    dispatch({ type: "UPDATE_IMAGE", id: selected.id, patch })
                  }
                  onDelete={() => dispatch({ type: "DELETE", id: selected.id })}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-xs text-neutral-500">
                {state.design.elements.length === 0
                  ? 'Pulsa "+ Texto" para anadir un elemento al canvas.'
                  : "Selecciona un elemento para editar sus propiedades."}
              </p>
            </div>
          )}
          {/* ── Layers panel ─────────────────────────────────────────── */}
          <div className="border-t border-neutral-800">
            <LayersPanel
              elements={state.design.elements.filter(
                (el) => (el.sectionId ?? "hero") === activeSectionId
              )}
              selectedId={state.selectedId}
              onSelect={(id) => dispatch({ type: "SELECT", id })}
              onBringForward={(id) => dispatch({ type: "BRING_FORWARD", id })}
              onSendBackward={(id) => dispatch({ type: "SEND_BACKWARD", id })}
              onBringToFront={(id) => dispatch({ type: "BRING_TO_FRONT", id })}
              onSendToBack={(id) => dispatch({ type: "SEND_TO_BACK", id })}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StageElement — wrapper div with content + resize handles when selected
// ─────────────────────────────────────────────────────────────────────────────

type StageElementProps = {
  element: CanvasElement;
  rect: ReturnType<typeof getElementCanvasRect>;
  selected: boolean;
  onMoveStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: CanvasResizeHandle) => void;
  onClick: (e: React.MouseEvent) => void;
  ghost?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onForward: () => void;
  onBackward: () => void;
  onToggleLock: () => void;
  onToggleVisible: () => void;
};

function StageElement({
  element,
  rect,
  selected,
  onMoveStart,
  onResizeStart,
  onClick,
  ghost = false,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleVisible,
}: StageElementProps) {
  // Wrapper: positions the element on the canvas
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    cursor: element.locked ? "default" : selected ? "grab" : "pointer",
    pointerEvents: "auto",
    userSelect: "none",
    // Selection ring via box-shadow so it doesn't affect layout
    boxShadow: selected
      ? "0 0 0 2px #6366f1, 0 0 0 4px rgba(99,102,241,0.20)"
      : "none",
    borderRadius: 2,
  };

  return (
    <div
      data-element-id={element.id}
      data-section-id={element.sectionId ?? "hero"}
      style={wrapperStyle}
      onMouseDown={onMoveStart}
      onClick={onClick}
    >
      {/* ── Content ─────────────────────────────────────────────────── */}
      {element.type === "text" && (
        <p
          style={{
            margin: 0,
            fontFamily: element.fontFamily,
            fontSize: element.fontSize,
            fontWeight: element.fontWeight,
            fontStyle: element.fontStyle,
            textAlign: element.textAlign,
            color: element.color,
            lineHeight: element.lineHeight,
            letterSpacing: `${element.letterSpacing}em`,
            textShadow: element.textShadow ?? undefined,
            textDecoration: element.textDecoration,
            opacity: ghost ? 0 : element.opacity,
            whiteSpace: "pre-wrap",
            overflowWrap: "normal",
            wordBreak: "normal",
            width: "100%",
            height: "100%",
          }}
        >
          {element.content}
        </p>
      )}

      {element.type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={element.url}
          alt=""
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: element.height ? "100%" : "auto",
            objectFit: "contain",
            opacity: ghost ? 0 : element.opacity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* ── Resize handles (only when selected) ─────────────────────── */}
      {selected && (
        <>
          <div
            data-canvas-control="true"
            style={{
              position: "absolute",
              left: "50%",
              top: -48,
              transform: "translateX(-50%)",
              display: "flex",
              gap: 4,
              borderRadius: 999,
              background: "rgba(17,24,39,0.96)",
              border: "1px solid rgba(255,255,255,0.14)",
              padding: 4,
              zIndex: 10000,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ToolbarButton title="Duplicar" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton title="Traer adelante" onClick={onForward}><BringToFront className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton title="Enviar atras" onClick={onBackward}><SendToBack className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton title={element.locked ? "Desbloquear" : "Bloquear"} onClick={onToggleLock}>
              {element.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            </ToolbarButton>
            <ToolbarButton title="Ocultar" onClick={onToggleVisible}><EyeOff className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton title="Eliminar" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></ToolbarButton>
          </div>
          {(["tl", "t", "tr", "r", "br", "b", "bl", "l"] as CanvasResizeHandle[]).map((handle) => (
            <ResizeHandleNode
              key={handle}
              handle={handle}
              onMouseDown={(e) => onResizeStart(e, handle)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResizeHandleNode — single corner handle
// ─────────────────────────────────────────────────────────────────────────────

const HANDLE_STYLE: Record<CanvasResizeHandle, React.CSSProperties> = {
  tl: { top: -HANDLE_PX / 2, left: -HANDLE_PX / 2, cursor: "nwse-resize" },
  t: { top: -HANDLE_PX / 2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
  tr: { top: -HANDLE_PX / 2, right: -HANDLE_PX / 2, cursor: "nesw-resize" },
  r: { top: "50%", right: -HANDLE_PX / 2, transform: "translateY(-50%)", cursor: "ew-resize" },
  br: { bottom: -HANDLE_PX / 2, right: -HANDLE_PX / 2, cursor: "nwse-resize" },
  b: { bottom: -HANDLE_PX / 2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
  bl: { bottom: -HANDLE_PX / 2, left: -HANDLE_PX / 2, cursor: "nesw-resize" },
  l: { top: "50%", left: -HANDLE_PX / 2, transform: "translateY(-50%)", cursor: "ew-resize" },
};

function ResizeHandleNode({
  handle,
  onMouseDown,
}: {
  handle: CanvasResizeHandle;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      data-canvas-control="true"
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        width: HANDLE_PX,
        height: HANDLE_PX,
        background: "#6366f1",
        border: "1.5px solid #fff",
        borderRadius: 2,
        zIndex: 9999,
        ...HANDLE_STYLE[handle],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TextPropertiesPanel
// ─────────────────────────────────────────────────────────────────────────────

function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: "grid",
        placeItems: "center",
        borderRadius: 999,
        color: "#e5e7eb",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {children}
    </button>
  );
}

function CommonPropertiesPanel({
  element,
  onChange,
}: {
  element: CanvasElement;
  onChange: (patch: Partial<CanvasElement>) => void;
}) {
  const field = "grid grid-cols-2 gap-2 border-b border-neutral-800 px-4 py-3";
  const label = "text-[10px] font-semibold uppercase tracking-widest text-neutral-500";
  const input = "w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-indigo-500";

  return (
    <>
      <div className={field}>
        <NumberField label="X %" value={element.x} onChange={(x) => onChange({ x })} inputClass={input} labelClass={label} />
        <NumberField label="Y %" value={element.y} onChange={(y) => onChange({ y })} inputClass={input} labelClass={label} />
        <NumberField label="Ancho" value={element.width} onChange={(width) => onChange({ width })} inputClass={input} labelClass={label} />
        <NumberField label="Alto" value={element.height ?? 0} onChange={(height) => onChange({ height: height > 0 ? height : null })} inputClass={input} labelClass={label} />
        <NumberField label="Rotacion" value={element.rotation} onChange={(rotation) => onChange({ rotation })} inputClass={input} labelClass={label} />
        <NumberField label="Z" value={element.zIndex} onChange={(zIndex) => onChange({ zIndex })} inputClass={input} labelClass={label} />
      </div>
      <div className="flex gap-2 border-b border-neutral-800 px-4 py-3">
        <ToggleButton active={element.visible} label={element.visible ? "Visible" : "Oculto"} onClick={() => onChange({ visible: !element.visible })} />
        <ToggleButton active={element.locked} label={element.locked ? "Bloqueado" : "Libre"} onClick={() => onChange({ locked: !element.locked })} />
      </div>
    </>
  );
}

function BoxStylePanel({
  element,
  onChange,
}: {
  element: CanvasElement;
  onChange: (patch: Partial<CanvasElement>) => void;
}) {
  const style = element.style ?? {};
  const field = "grid grid-cols-2 gap-2 border-b border-neutral-800 px-4 py-3";
  const label = "text-[10px] font-semibold uppercase tracking-widest text-neutral-500";
  const input = "w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-indigo-500";
  const setStyle = (patch: NonNullable<CanvasElement["style"]>) => onChange({ style: { ...style, ...patch } });

  return (
    <div className={field}>
      {/* Opacidad — UI 0-100, internamente 0-1 */}
      <div className="col-span-2 flex flex-col gap-1">
        <label className={label}>
          Opacidad — {Math.round((style.opacity ?? element.opacity ?? 1) * 100)}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round((style.opacity ?? element.opacity ?? 1) * 100)}
            onChange={(e) => setStyle({ opacity: clamp(Number(e.target.value) / 100, 0, 1) })}
            className="flex-1 accent-indigo-500"
          />
          <input
            type="text"
            inputMode="decimal"
            value={Math.round((style.opacity ?? element.opacity ?? 1) * 100)}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (!raw) return;
              const parsed = Number(raw);
              if (!Number.isNaN(parsed)) setStyle({ opacity: clamp(parsed / 100, 0, 1) });
            }}
            className={input + " w-14 shrink-0 text-center"}
          />
        </div>
      </div>
      {/* Colores para decoraciones parametricas */}
      {style.decorationPreset && (
        <>
          <div className="col-span-2">
            <label className={label}>Color principal</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.color ?? "#ffffff"}
                onChange={(e) => {
                  const color = e.target.value;
                  const accentColor = style.accentColor ?? "#f4d27a";
                  setStyle({
                    color,
                    background: buildDecorationBackground(style.decorationPreset!, color, accentColor),
                  });
                }}
                className="h-8 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-800 p-0.5"
              />
              <span className="text-xs text-neutral-400 font-mono">{style.color ?? "#ffffff"}</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className={label}>Color acento</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.accentColor ?? "#f4d27a"}
                onChange={(e) => {
                  const accentColor = e.target.value;
                  const color = style.color ?? "#ffffff";
                  setStyle({
                    accentColor,
                    background: buildDecorationBackground(style.decorationPreset!, color, accentColor),
                  });
                }}
                className="h-8 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-800 p-0.5"
              />
              <span className="text-xs text-neutral-400 font-mono">{style.accentColor ?? "#f4d27a"}</span>
            </div>
          </div>
        </>
      )}
      <NumberField label="Radio" value={style.borderRadius ?? 0} onChange={(borderRadius) => setStyle({ borderRadius })} inputClass={input} labelClass={label} />
      <div className="col-span-2">
        <label className={label}>Fondo</label>
        <input value={style.background ?? ""} onChange={(e) => setStyle({ background: e.target.value })} className={input} placeholder="rgba(...) o linear-gradient(...)" />
      </div>
      <div className="col-span-2">
        <label className={label}>Imagen / gradient extra</label>
        <input value={style.backgroundImage ?? style.gradient ?? ""} onChange={(e) => setStyle({ backgroundImage: e.target.value })} className={input} placeholder="url(...) o radial-gradient(...)" />
      </div>
      <NumberField label="Blur fondo" value={style.backdropBlur ?? 0} onChange={(backdropBlur) => setStyle({ backdropBlur })} inputClass={input} labelClass={label} />
      <NumberField label="Blur elem." value={style.blur ?? 0} onChange={(blur) => setStyle({ blur })} inputClass={input} labelClass={label} />
      <div className="col-span-2">
        <label className={label}>Sombra texto/CSS</label>
        <input value={style.textShadow ?? ""} onChange={(e) => setStyle({ textShadow: e.target.value })} className={input} placeholder="0 4px 18px rgba(...)" />
      </div>
      <div className="col-span-2">
        <label className={label}>Sombra caja</label>
        <input value={style.boxShadow ?? ""} onChange={(e) => setStyle({ boxShadow: e.target.value })} className={input} placeholder="0 18px 50px rgba(...)" />
      </div>
      <div className="col-span-2">
        <label className={label}>Borde</label>
        <input value={style.border ?? ""} onChange={(e) => setStyle({ border: e.target.value })} className={input} placeholder="1px solid rgba(...)" />
      </div>
      <label className="flex flex-col gap-1">
        <span className={label}>Animacion</span>
        <select value={style.animation ?? "none"} onChange={(e) => setStyle({ animation: e.target.value })} className={input}>
          {ANIMATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Blend</span>
        <select value={style.mixBlendMode ?? "normal"} onChange={(e) => setStyle({ mixBlendMode: e.target.value })} className={input}>
          {["normal", "screen", "multiply", "overlay", "soft-light", "lighten"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div>
        <label className={label}>Duracion</label>
        <input value={style.animationDuration ?? ""} onChange={(e) => setStyle({ animationDuration: e.target.value })} className={input} placeholder="900ms / 3s" />
      </div>
      <div>
        <label className={label}>Delay</label>
        <input value={style.animationDelay ?? ""} onChange={(e) => setStyle({ animationDelay: e.target.value })} className={input} placeholder="120ms" />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  inputClass,
  labelClass,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  inputClass: string;
  labelClass: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        step="any"
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (!raw) return;
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        className={inputClass}
      />
    </label>
  );
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
        active ? "border-indigo-500 bg-indigo-600 text-white" : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

type TextPanelProps = {
  element: CanvasTextElement;
  onChange: (patch: Partial<CanvasTextElement>) => void;
  onDelete: () => void;
};

function TextPropertiesPanel({ element, onChange, onDelete }: TextPanelProps) {
  const field = "flex flex-col gap-1 px-4 py-2.5 border-b border-neutral-800";
  const label = "text-[10px] font-semibold uppercase tracking-widest text-neutral-500";
  const input =
    "w-full rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-indigo-500";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <p className="text-xs font-semibold text-neutral-300">Propiedades · Texto</p>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-950"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>

      <CommonPropertiesPanel element={element} onChange={onChange as (patch: Partial<CanvasElement>) => void} />
      <BoxStylePanel element={element} onChange={onChange as (patch: Partial<CanvasElement>) => void} />

      <div className={field}>
        <label className={label}>Texto</label>
        <textarea
          rows={3}
          value={element.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className={input + " resize-none"}
        />
      </div>

      <div className={field}>
        <label className={label}>Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={element.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-800 p-0.5"
          />
          <input
            type="text"
            value={element.color}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange({ color: v });
            }}
            className={input}
            maxLength={7}
          />
        </div>
      </div>

      <div className={field}>
        <label className={label}>Tamano ({element.fontSize}px)</label>
        <input
          type="range"
          min={10}
          max={140}
          step={1}
          value={element.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Interlineado ({element.lineHeight})</label>
        <input
          type="range"
          min={0.8}
          max={2.4}
          step={0.05}
          value={element.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Tracking ({element.letterSpacing}em)</label>
        <input
          type="range"
          min={-0.05}
          max={0.5}
          step={0.01}
          value={element.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Ancho ({element.width}px ref.)</label>
        <input
          type="range"
          min={60}
          max={390}
          step={5}
          value={element.width}
          onChange={(e) => onChange({ width: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Fuente</label>
        <select
          value={element.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className={input}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={label}>Peso</label>
        <select
          value={element.fontWeight}
          onChange={(e) =>
            onChange({ fontWeight: e.target.value as CanvasTextElement["fontWeight"] })
          }
          className={input}
        >
          <option value="300">Light (300)</option>
          <option value="400">Regular (400)</option>
          <option value="500">Medium (500)</option>
          <option value="600">Semibold (600)</option>
          <option value="700">Bold (700)</option>
        </select>
      </div>

      <div className={field}>
        <label className={label}>Estilo</label>
        <div className="flex gap-2">
          {(["normal", "italic"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ fontStyle: s })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                element.fontStyle === s
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {s === "normal" ? "Normal" : "Italica"}
            </button>
          ))}
        </div>
      </div>

      <div className={field}>
        <label className={label}>Alineacion</label>
        <div className="flex gap-2">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ textAlign: a })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                element.textAlign === a
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {a === "left" ? "Izq" : a === "center" ? "Centro" : "Der"}
            </button>
          ))}
        </div>
      </div>

      <div className={field}>
        <label className={label}>Rotacion ({element.rotation}deg)</label>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={element.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>
          Opacidad ({Math.round(((element.style?.opacity ?? element.opacity) ?? 1) * 100)}%)
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(((element.style?.opacity ?? element.opacity) ?? 1) * 100)}
          onChange={(e) => {
            const opacity = clamp(Number(e.target.value) / 100, 0, 1);
            // Sync both element.opacity and style.opacity so renderer always picks it up
            onChange(
              element.style !== undefined
                ? { opacity, style: { ...element.style, opacity } }
                : { opacity }
            );
          }}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Capa (z-index)</label>
        <input
          type="number"
          min={1}
          max={99}
          value={element.zIndex}
          onChange={(e) => onChange({ zIndex: Number(e.target.value) })}
          className={input}
        />
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ImagePropertiesPanel
// ─────────────────────────────────────────────────────────────────────────────

type ImagePanelProps = {
  element: CanvasImageElement;
  onChange: (patch: Partial<CanvasImageElement>) => void;
  onDelete: () => void;
};

function ImagePropertiesPanel({ element, onChange, onDelete }: ImagePanelProps) {
  const field = "flex flex-col gap-1 px-4 py-2.5 border-b border-neutral-800";
  const label = "text-[10px] font-semibold uppercase tracking-widest text-neutral-500";
  const input =
    "w-full rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-indigo-500";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <p className="text-xs font-semibold text-neutral-300">Propiedades · Imagen</p>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-950"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>

      <CommonPropertiesPanel element={element} onChange={onChange as (patch: Partial<CanvasElement>) => void} />
      <BoxStylePanel element={element} onChange={onChange as (patch: Partial<CanvasElement>) => void} />

      <div className={field}>
        <label className={label}>URL imagen</label>
        <input
          type="url"
          value={element.url}
          onChange={(e) => onChange({ url: e.target.value })}
          className={input}
        />
      </div>

      <div className={field}>
        <label className={label}>Ajuste</label>
        <select
          value={element.objectFit}
          onChange={(e) => onChange({ objectFit: e.target.value as CanvasImageElement["objectFit"] })}
          className={input}
        >
          <option value="contain">Contain</option>
          <option value="fill">Fill</option>
        </select>
      </div>

      <div className={field}>
        <label className={label}>
          Opacidad ({Math.round(((element.style?.opacity ?? element.opacity) ?? 1) * 100)}%)
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(((element.style?.opacity ?? element.opacity) ?? 1) * 100)}
          onChange={(e) => {
            const opacity = clamp(Number(e.target.value) / 100, 0, 1);
            // Sync both element.opacity and style.opacity so renderer always picks it up
            onChange(
              element.style !== undefined
                ? { opacity, style: { ...element.style, opacity } }
                : { opacity }
            );
          }}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Rotacion ({element.rotation}deg)</label>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={element.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className={field}>
        <label className={label}>Capa (z-index)</label>
        <input
          type="number"
          min={1}
          max={99}
          value={element.zIndex}
          onChange={(e) => onChange({ zIndex: Number(e.target.value) })}
          className={input}
        />
      </div>

      <div className={field}>
        <label className={label}>Voltear</label>
        <div className="flex gap-2">
          {([["Horizontal", "flipX"], ["Vertical", "flipY"]] as const).map(([lbl, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ [key]: !element[key] })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                element[key]
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LayersPanel
// ─────────────────────────────────────────────────────────────────────────────

function LayersPanel({
  elements,
  selectedId,
  onSelect,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
}: {
  elements: CanvasElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}) {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  function elementLabel(el: CanvasElement): string {
    if (el.type === "image") return `Imagen z${el.zIndex}`;
    const preset = el.style?.decorationPreset;
    if (preset) {
      const names: Record<string, string> = {
        "blur-circle": "Circulo blur",
        glow: "Brillo",
        "flower-shape": "Flor",
        "gradient-overlay": "Overlay",
        divider: "Separador",
      };
      return `${names[preset] ?? preset} z${el.zIndex}`;
    }
    const snippet = el.content?.slice(0, 18) || "(vacio)";
    return `Texto "${snippet}" z${el.zIndex}`;
  }

  if (elements.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-neutral-600">Sin elementos en esta sección</div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        Capas (z desc)
      </p>
      {sorted.map((el) => {
        const isSelected = el.id === selectedId;
        return (
          <div
            key={el.id}
            className={`flex items-center gap-1 border-b border-neutral-800 px-3 py-1.5 ${
              isSelected ? "bg-indigo-950" : "hover:bg-neutral-800"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(el.id)}
              className={`flex-1 truncate text-left text-[11px] ${
                isSelected ? "text-indigo-300 font-semibold" : "text-neutral-300"
              }`}
            >
              {elementLabel(el)}
            </button>
            <div className="flex shrink-0 gap-0.5">
              <LayerBtn title="Frente total" onClick={() => onBringToFront(el.id)}>↑↑</LayerBtn>
              <LayerBtn title="Subir" onClick={() => onBringForward(el.id)}>↑</LayerBtn>
              <LayerBtn title="Bajar" onClick={() => onSendBackward(el.id)}>↓</LayerBtn>
              <LayerBtn title="Fondo total" onClick={() => onSendToBack(el.id)}>↓↓</LayerBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LayerBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100 transition"
    >
      {children}
    </button>
  );
}
