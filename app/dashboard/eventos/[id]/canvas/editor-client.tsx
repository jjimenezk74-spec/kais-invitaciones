"use client";

import { useReducer, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Save, X, Eye } from "lucide-react";
import { saveCanvasDesign, clearCanvasDesign } from "@/app/actions/canvas";
import { DECORATIONS } from "@/lib/decorations";
import type { Decoration } from "@/lib/decorations";
import type {
  CanvasDesign,
  CanvasElement,
  CanvasTextElement,
  CanvasImageElement,
  CanvasSectionId,
} from "@/lib/types";
import { CanvasEditorContext, type ResizeHandle } from "./canvas-context";
import { SectionCanvasLayer } from "./section-canvas-layer";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REF_W = 390; // reference canvas width in px

const FONT_OPTIONS = [
  { label: "Serif (defecto)", value: "Georgia, serif" },
  { label: "Playfair Display", value: "\'Playfair Display\', Georgia, serif" },
  { label: "Great Vibes", value: "\'Great Vibes\', cursive" },
  { label: "Dancing Script", value: "\'Dancing Script\', cursive" },
  { label: "Montserrat", value: "\'Montserrat\', sans-serif" },
  { label: "Sans-serif", value: "system-ui, sans-serif" },
];

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Great+Vibes&family=Dancing+Script:wght@400;700&family=Montserrat:wght@300;400;600&display=swap";

const CANVAS_SECTIONS: { id: CanvasSectionId; label: string; scrollTo: string }[] = [
  { id: "hero",          label: "Hero",             scrollTo: "hero" },
  { id: "countdown",    label: "Cuenta regresiva",  scrollTo: "countdown" },
  { id: "presentation", label: "Presentación",      scrollTo: "details" },
  { id: "messages",     label: "Mensajes",           scrollTo: "details" },
  { id: "details",      label: "Detalles",           scrollTo: "details" },
  { id: "church",       label: "Iglesia",            scrollTo: "details" },
  { id: "dresscode",    label: "Vestimenta",         scrollTo: "details" },
  { id: "rsvp",         label: "RSVP",              scrollTo: "rsvp" },
  { id: "footer",       label: "Footer",            scrollTo: "footer" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drag state — section-aware coordinates
// ─────────────────────────────────────────────────────────────────────────────

type DragMove = {
  kind: "move";
  elementId: string;
  startMouseX: number;
  startMouseY: number;
  startElX: number;
  startElY: number;
  /** Scaled section dimensions captured at drag start, for coordinate conversion */
  sectionW: number;
  sectionH: number;
};

type DragResize = {
  kind: "resize";
  elementId: string;
  handle: ResizeHandle;
  startMouseX: number;
  startMouseY: number;
  startWidth: number;
  startHeight: number;
  startFontSize: number;
  elementType: "text" | "image";
  /** Section screen width at drag start, used to convert px → canvas px */
  sectionW: number;
};

type DragState = DragMove | DragResize;

// ─────────────────────────────────────────────────────────────────────────────
// State & Reducer
// ─────────────────────────────────────────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "error";

type EditorState = {
  design: CanvasDesign;
  selectedId: string | null;
  isDirty: boolean;
  saveStatus: SaveStatus;
};

type EditorAction =
  | { type: "ADD_TEXT"; sectionId: CanvasSectionId }
  | { type: "SELECT"; id: string | null }
  | { type: "UPDATE_TEXT"; id: string; patch: Partial<CanvasTextElement> }
  | { type: "UPDATE_IMAGE"; id: string; patch: Partial<CanvasImageElement> }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "RESIZE"; id: string; width: number; fontSize?: number; height?: number }
  | { type: "SET_SECTION_ID"; id: string; sectionId: CanvasSectionId }
  | { type: "DELETE"; id: string }
  | { type: "MARK_SAVING" }
  | { type: "MARK_SAVED" }
  | { type: "MARK_ERROR" }
  | { type: "ADD_IMAGE"; url: string; sectionId: CanvasSectionId }
  | { type: "CLEAR" };

function createEmptyDesign(): CanvasDesign {
  return {
    version: 1,
    refWidth: REF_W,
    refHeight: 844,
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
    x: 50,
    y: 50,
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
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function createImageElement(url: string, sectionId: CanvasSectionId): CanvasImageElement {
  return {
    id: crypto.randomUUID().slice(0, 8),
    type: "image",
    sectionId,
    x: 50,
    y: 30,
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
                  width: clamp(action.width, 24, 600),
                  ...(action.fontSize !== undefined && el.type === "text"
                    ? { fontSize: clamp(action.fontSize, 10, 120) }
                    : {}),
                  ...(action.height !== undefined
                    ? { height: clamp(action.height, 24, 600) }
                    : {}),
                }
              : el
          ),
        },
        isDirty: true,
      };
    case "SET_SECTION_ID":
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id ? { ...el, sectionId: action.sectionId } : el
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
  initialDesign: CanvasDesign | null;
};

// Section info received via postMessage from the iframe
type SectionInfo = { top: number; height: number };
// The 5 top-level DOM sections in the public page
const OVERLAY_SECTION_IDS = ["hero", "countdown", "details", "rsvp", "footer"] as const;
type OverlaySectionId = (typeof OVERLAY_SECTION_IDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// CanvasEditorClient
// ─────────────────────────────────────────────────────────────────────────────

export function CanvasEditorClient({
  eventId,
  eventSlug,
  eventTitle,
  initialDesign,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    design: initialDesign ?? createEmptyDesign(),
    selectedId: null,
    isDirty: false,
    saveStatus: "saved",
  });

  const [activeSectionId, setActiveSectionId] = useState<CanvasSectionId>("hero");

  // ── Scale / zoom ──────────────────────────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null);
  // User-chosen zoom level (0.5 | 0.75 | 1.0).  Default: 75 %.
  const [activeZoom, setActiveZoom] = useState(0.75);
  // Actual render scale = min(activeZoom, pane-fit).  Prevents horizontal overflow
  // when the pane is narrower than REF_W * activeZoom.
  const [scale, setScale] = useState(0.75);

  // ── Iframe-based WYSIWYG ──────────────────────────────────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Natural (unscaled) height of the full invitation page
  const [iframeHeight, setIframeHeight] = useState(3200);
  // Top/height of each data-canvas-section in natural page coordinates
  const [sectionInfos, setSectionInfos] = useState<Record<string, SectionInfo>>({});
  const sectionsLoaded = Object.keys(sectionInfos).length > 0;

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
      const available = wrapperRef.current.getBoundingClientRect().width - 32;
      // Never scale UP beyond the user's chosen zoom; clamp down if pane is narrow
      const fit = Math.max(0.25, available / REF_W);
      setScale(Math.min(activeZoom, fit));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeZoom]); // re-run whenever user changes zoom

  // Listen for section positions from iframe
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (!ev.data || ev.data.type !== "kais-editor-sections") return;
      const raw: Array<{ id: string; top: number; height: number }> = ev.data.sections ?? [];
      const map: Record<string, SectionInfo> = {};
      raw.forEach((s) => { map[s.id] = { top: s.top, height: s.height }; });
      setSectionInfos(map);
      if (typeof ev.data.totalHeight === "number" && ev.data.totalHeight > 100) {
        setIframeHeight(ev.data.totalHeight);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Ask the iframe to report section positions after it loads
  const handleIframeLoad = useCallback(() => {
    const send = () =>
      iframeRef.current?.contentWindow?.postMessage(
        { type: "kais-editor-request-sections" },
        window.location.origin
      );
    send();
    // Second pass after fonts/images settle
    setTimeout(send, 700);
  }, []);

  // ── Drag ref ──────────────────────────────────────────────────────────────

  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  /**
   * Get the scaled bounding rect of a section placeholder in the canvas overlay.
   * The placeholder divs are absolutely positioned and transformed — getBoundingClientRect
   * returns their visual (scaled) position in screen space, which is what we need for drag math.
   */
  const getSectionRect = useCallback(
    (sectionId: CanvasSectionId): { width: number; height: number } => {
      // Sub-sections (presentation, messages, church, dresscode) share the "details" container
      const scrollTarget = CANVAS_SECTIONS.find((s) => s.id === sectionId)?.scrollTo ?? sectionId;
      const el = previewRef.current?.querySelector<HTMLElement>(
        `[data-canvas-section="${scrollTarget}"]`
      );
      const rect = el?.getBoundingClientRect();
      return {
        width: rect?.width  ?? REF_W * scale,
        height: rect?.height ?? 500 * scale,
      };
    },
    [scale]
  );

  // Start MOVE drag
  const onMoveStart = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      const el = state.design.elements.find((x) => x.id === elementId);
      if (!el || el.locked) return;
      dispatch({ type: "SELECT", id: elementId });
      const { width: sW, height: sH } = getSectionRect(activeSectionId);
      dragRef.current = {
        kind: "move",
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: el.x,
        startElY: el.y,
        sectionW: sW,
        sectionH: sH,
      };
    },
    [state.design.elements, activeSectionId, getSectionRect]
  );

  // Start RESIZE drag
  const onResizeStart = useCallback(
    (e: React.MouseEvent, elementId: string, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      const el = state.design.elements.find((x) => x.id === elementId);
      if (!el) return;
      const safeW = el.width > 0 ? el.width : 240;
      const startH = el.height != null && el.height > 0 ? el.height : safeW;
      const startFontSize = el.type === "text" && el.fontSize > 0 ? el.fontSize : 28;
      const { width: sW } = getSectionRect(activeSectionId);
      dragRef.current = {
        kind: "resize",
        elementId,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: safeW,
        startHeight: startH,
        startFontSize,
        elementType: el.type,
        sectionW: sW,
      };
    },
    [state.design.elements, activeSectionId, getSectionRect]
  );

  const onSelect = useCallback((id: string | null) => {
    dispatch({ type: "SELECT", id });
  }, []);

  // Mouse move — handles move and resize
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "move") {
      // Convert screen delta → % of section dimensions
      const dxPct = ((e.clientX - drag.startMouseX) / drag.sectionW) * 100;
      const dyPct = ((e.clientY - drag.startMouseY) / drag.sectionH) * 100;
      dispatch({
        type: "MOVE",
        id: drag.elementId,
        x: drag.startElX + dxPct,
        y: drag.startElY + dyPct,
      });
    } else {
      // Convert screen delta → natural canvas px (before scale/zoom)
      const canvasScale = drag.sectionW / REF_W; // = zoom factor
      const dxCanvas = (e.clientX - drag.startMouseX) / canvasScale;
      const dyCanvas = (e.clientY - drag.startMouseY) / canvasScale;

      if (drag.elementType === "image") {
        // Proportional resize: pick the dominant drag axis per handle
        let delta: number;
        if (drag.handle === "br")      delta = Math.max(dxCanvas, dyCanvas);
        else if (drag.handle === "bl") delta = Math.max(-dxCanvas, dyCanvas);
        else if (drag.handle === "tr") delta = Math.max(dxCanvas, -dyCanvas);
        else                           delta = Math.max(-dxCanvas, -dyCanvas);
        const sf = drag.startWidth > 0 ? (drag.startWidth + delta) / drag.startWidth : 1;
        dispatch({
          type: "RESIZE",
          id: drag.elementId,
          width:  clamp(drag.startWidth  * sf, 24, 600),
          height: clamp(drag.startHeight * sf, 24, 600),
        });
      } else {
        // Text: horizontal width + proportional fontSize
        const isLeft = drag.handle === "tl" || drag.handle === "bl";
        const newWidth = drag.startWidth + (isLeft ? -dxCanvas : dxCanvas);
        const sf = drag.startWidth > 0 ? newWidth / drag.startWidth : 1;
        dispatch({
          type: "RESIZE",
          id: drag.elementId,
          width: newWidth,
          fontSize: drag.startFontSize * sf,
        });
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Save / Clear ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    dispatch({ type: "MARK_SAVING" });
    const { error } = await saveCanvasDesign(eventId, {
      ...state.design,
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
    if (!confirm("Eliminar todo el diseño canvas? El evento volverá a usar la plantilla.")) return;
    const { error } = await clearCanvasDesign(eventId);
    if (error) {
      alert(`Error: ${error}`);
    } else {
      dispatch({ type: "CLEAR" });
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const selected = state.design.elements.find((el) => el.id === state.selectedId) ?? null;

  const saveLabel =
    state.saveStatus === "saving"
      ? "Guardando..."
      : state.saveStatus === "error"
      ? "Error"
      : state.isDirty
      ? "Guardar *"
      : "Guardado";

  const [showDecorPicker, setShowDecorPicker] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <CanvasEditorContext.Provider
      value={{
        elements: state.design.elements,
        selectedId: state.selectedId,
        activeSectionId,
        onSelect,
        onMoveStart,
        onResizeStart,
      }}
    >
      <div
        className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
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
              href={`/evento/${eventSlug}?preview=admin`}
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

        {/* ── Section tabs + zoom controls ──────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 bg-neutral-900 px-3 py-1.5">
          {CANVAS_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveSectionId(s.id);
                dispatch({ type: "SELECT", id: null });
                // Scroll preview to the correct section
                const target = previewRef.current?.querySelector(
                  `[data-canvas-section="${s.scrollTo}"]`
                );
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
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

          {/* Zoom presets — pinned to the right */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 border-l border-neutral-700 pl-2">
            {([0.5, 0.75, 1] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setActiveZoom(z)}
                className={`rounded px-2 py-1 text-[11px] tabular-nums transition ${
                  activeZoom === z
                    ? "bg-neutral-700 text-neutral-100"
                    : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                }`}
              >
                {z === 1 ? "100%" : z === 0.75 ? "75%" : "50%"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Invitation preview — true 390px mobile viewport via iframe ── */}
          <div
            ref={wrapperRef}
            className="flex flex-1 items-start justify-center overflow-auto bg-neutral-800 p-4"
          >
            {/*
              Outer shell: takes up the SCALED dimensions in the layout.
              Everything inside is transform:scale(scale) at natural 390px width.
              This means all viewport-relative CSS (vw, svh, min-h-screen, lg:*)
              inside the iframe evaluates against the real 390px viewport — not the
              desktop window — giving a pixel-perfect mobile WYSIWYG preview.
            */}
            <div
              style={{
                position: "relative",
                width: REF_W * scale,
                height: iframeHeight * scale,
                flexShrink: 0,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.7)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Real invitation at genuine 390px mobile viewport */}
              <iframe
                ref={iframeRef}
                src={`/evento/${eventSlug}?preview=admin&editor=1`}
                onLoad={handleIframeLoad}
                title="Vista previa de invitación"
                scrolling="no"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: REF_W,
                  height: iframeHeight,
                  border: "none",
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "none", // read-only — overlay handles events
                  background: "#0a0405",
                }}
              />

              {/*
                Canvas editing overlay — same coordinate space as the iframe.
                Section placeholder divs are absolutely positioned to match
                the iframe's actual section tops/heights (reported via postMessage).
                SectionCanvasLayer elements anchor correctly within each placeholder.
              */}
              <div
                ref={previewRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: REF_W,
                  height: iframeHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "none",
                }}
              >
                {OVERLAY_SECTION_IDS.map((sid: OverlaySectionId) => {
                  const info = sectionInfos[sid];
                  return (
                    <div
                      key={sid}
                      data-canvas-section={sid}
                      style={{
                        position: "absolute",
                        top: info?.top ?? 0,
                        left: 0,
                        width: "100%",
                        height: info?.height ?? 0,
                      }}
                    >
                      {/* Sub-sections that share the details coordinate space */}
                      {sid === "details" ? (
                        <>
                          <SectionCanvasLayer sectionId="presentation" />
                          <SectionCanvasLayer sectionId="messages" />
                          <SectionCanvasLayer sectionId="details" />
                          <SectionCanvasLayer sectionId="church" />
                          <SectionCanvasLayer sectionId="dresscode" />
                        </>
                      ) : (
                        <SectionCanvasLayer sectionId={sid} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Loading veil — shown until iframe reports section positions */}
              {!sectionsLoaded && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(10,4,5,0.65)",
                    color: "#d4af37",
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    pointerEvents: "none",
                  }}
                >
                  Cargando preview…
                </div>
              )}
            </div>
          </div>

          {/* ── Properties panel ────────────────────────────────────── */}
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
                    ? 'Pulsa "+ Texto" o "+ Decoracion" para anadir elementos.'
                    : "Selecciona un elemento en la preview para editar."}
                </p>
                <p className="text-[10px] text-neutral-600">
                  Sección activa:{" "}
                  <span className="text-indigo-400">
                    {CANVAS_SECTIONS.find((s) => s.id === activeSectionId)?.label}
                  </span>
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </CanvasEditorContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TextPropertiesPanel
// ─────────────────────────────────────────────────────────────────────────────

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
        <p className="text-xs font-semibold text-neutral-300">Texto</p>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-950"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>

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
        <label className={label}>Opacidad ({Math.round(element.opacity * 100)}%)</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={element.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
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
        <p className="text-xs font-semibold text-neutral-300">Imagen / Decoracion</p>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-950"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>

      <div className={field}>
        <label className={label}>Opacidad ({Math.round(element.opacity * 100)}%)</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={element.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
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
