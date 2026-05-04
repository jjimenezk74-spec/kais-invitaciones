"use client";

import { useReducer, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, Save, X, Eye } from "lucide-react";
import { saveCanvasDesign, clearCanvasDesign } from "@/app/actions/canvas";
import type { CanvasDesign, CanvasElement, CanvasTextElement } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REF_W = 390;
const REF_H = 844;
const HANDLE_PX = 9; // resize handle size in canvas px

const FONT_OPTIONS = [
  { label: "Serif (defecto)", value: "Georgia, serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Great Vibes", value: "'Great Vibes', cursive" },
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Sans-serif", value: "system-ui, sans-serif" },
];

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Great+Vibes&family=Dancing+Script:wght@400;700&family=Montserrat:wght@300;400;600&display=swap";

// ─────────────────────────────────────────────────────────────────────────────
// Drag state — union of move / resize modes
// ─────────────────────────────────────────────────────────────────────────────

type ResizeHandle = "tl" | "tr" | "bl" | "br";

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
  handle: ResizeHandle;
  startMouseX: number;
  startWidth: number;
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
  | { type: "ADD_TEXT" }
  | { type: "SELECT"; id: string | null }
  | { type: "UPDATE_TEXT"; id: string; patch: Partial<CanvasTextElement> }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "RESIZE"; id: string; width: number }
  | { type: "DELETE"; id: string }
  | { type: "MARK_SAVING" }
  | { type: "MARK_SAVED" }
  | { type: "MARK_ERROR" }
  | { type: "CLEAR" };

function createEmptyDesign(): CanvasDesign {
  return {
    version: 1,
    refWidth: REF_W,
    refHeight: REF_H,
    background: { type: "none" },
    elements: [],
    updatedAt: new Date().toISOString(),
  };
}

function createTextElement(): CanvasTextElement {
  return {
    id: crypto.randomUUID().slice(0, 8),
    type: "text",
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

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "ADD_TEXT": {
      const el = createTextElement();
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
              ? { ...el, width: clamp(action.width, 60, REF_W) }
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
  coverImageUrl: string | null;
  initialDesign: CanvasDesign | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// CanvasEditorClient
// ─────────────────────────────────────────────────────────────────────────────

export function CanvasEditorClient({
  eventId,
  eventSlug,
  eventTitle,
  coverImageUrl,
  initialDesign,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    design: initialDesign ?? createEmptyDesign(),
    selectedId: null,
    isDirty: false,
    saveStatus: "saved",
  });

  // Scale: wrapper width / REF_W
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);

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
      const w = wrapperRef.current.getBoundingClientRect().width - 32;
      setScale(Math.max(0.3, Math.min(1, w / REF_W)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Drag ref (move OR resize) ─────────────────────────────────────────────

  const dragRef = useRef<DragState | null>(null);

  // Start MOVE drag (called from element wrapper)
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      const el = state.design.elements.find((el) => el.id === elementId);
      if (!el || el.locked) return;
      dispatch({ type: "SELECT", id: elementId });
      dragRef.current = {
        kind: "move",
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: el.x,
        startElY: el.y,
      };
    },
    [state.design.elements]
  );

  // Start RESIZE drag (called from a corner handle)
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, handle: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault();
      const el = state.design.elements.find((el) => el.id === elementId);
      if (!el) return;
      dragRef.current = {
        kind: "resize",
        elementId,
        handle,
        startMouseX: e.clientX,
        startWidth: el.width,
      };
    },
    [state.design.elements]
  );

  // Mouse move — handles both move and resize
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === "move") {
        const dxPct = ((e.clientX - drag.startMouseX) / scale / REF_W) * 100;
        const dyPct = ((e.clientY - drag.startMouseY) / scale / REF_H) * 100;
        dispatch({
          type: "MOVE",
          id: drag.elementId,
          x: drag.startElX + dxPct,
          y: drag.startElY + dyPct,
        });
      } else if (drag.kind === "resize") {
        // dx in canvas pixels (unscaled)
        const dxCanvas = (e.clientX - drag.startMouseX) / scale;
        // Right handles → drag right = wider
        // Left handles → drag left = wider (negate dx)
        const isLeft = drag.handle === "tl" || drag.handle === "bl";
        const newWidth = drag.startWidth + (isLeft ? -dxCanvas : dxCanvas);
        dispatch({ type: "RESIZE", id: drag.elementId, width: newWidth });
      }
    },
    [scale]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

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
  const sortedElements = [...state.design.elements].sort((a, b) => a.zIndex - b.zIndex);

  const saveLabel =
    state.saveStatus === "saving"
      ? "Guardando..."
      : state.saveStatus === "error"
      ? "Error"
      : state.isDirty
      ? "Guardar *"
      : "Guardado";

  const isDragging = dragRef.current !== null;

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
          <button
            type="button"
            onClick={() => dispatch({ type: "ADD_TEXT" })}
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

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas area ────────────────────────────────────────────── */}
        <div
          ref={wrapperRef}
          className="flex flex-1 items-start justify-center overflow-auto bg-neutral-950 p-4 pt-6"
          onClick={() => dispatch({ type: "SELECT", id: null })}
        >
          {/* Outer shell — real screen dimensions */}
          <div
            style={{
              width: REF_W * scale,
              height: REF_H * scale,
              flexShrink: 0,
              position: "relative",
            }}
          >
            {/* Inner stage at reference 390×844, scaled with CSS transform */}
            <div
              style={{
                width: REF_W,
                height: REF_H,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.7)",
                cursor: isDragging ? "grabbing" : "default",
              }}
            >
              {/* Background image / gradient */}
              {coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.55,
                    pointerEvents: "none",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                  }}
                />
              )}

              {/* Empty-canvas hint */}
              {state.design.elements.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
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
                    Pulsa "+ Texto" para comenzar
                  </p>
                </div>
              )}

              {/* Elements */}
              {sortedElements.map((el) => (
                <StageElement
                  key={el.id}
                  element={el}
                  selected={el.id === state.selectedId}
                  onMoveStart={(e) => handleElementMouseDown(e, el.id)}
                  onResizeStart={(e, handle) => handleResizeMouseDown(e, el.id, handle)}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "SELECT", id: el.id });
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Properties panel ───────────────────────────────────────── */}
        <aside className="flex w-72 shrink-0 flex-col gap-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900">
          {selected && selected.type === "text" ? (
            <TextPropertiesPanel
              element={selected}
              onChange={(patch) =>
                dispatch({ type: "UPDATE_TEXT", id: selected.id, patch })
              }
              onDelete={() => dispatch({ type: "DELETE", id: selected.id })}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-xs text-neutral-500">
                {state.design.elements.length === 0
                  ? 'Pulsa "+ Texto" para anadir un elemento al canvas.'
                  : "Selecciona un elemento para editar sus propiedades."}
              </p>
            </div>
          )}
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
  selected: boolean;
  onMoveStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
  onClick: (e: React.MouseEvent) => void;
};

function StageElement({
  element,
  selected,
  onMoveStart,
  onResizeStart,
  onClick,
}: StageElementProps) {
  // Wrapper: positions the element on the canvas
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: element.width,
    height: element.height ?? undefined,
    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    cursor: element.locked ? "default" : selected ? "grab" : "pointer",
    userSelect: "none",
    // Selection ring via box-shadow so it doesn't affect layout
    boxShadow: selected
      ? "0 0 0 2px #6366f1, 0 0 0 4px rgba(99,102,241,0.20)"
      : "none",
    borderRadius: 2,
  };

  return (
    <div
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
            opacity: element.opacity,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            width: "100%",
          }}
        >
          {element.content}
        </p>
      )}

      {/* ── Resize handles (only when selected) ─────────────────────── */}
      {selected && (
        <>
          {(["tl", "tr", "bl", "br"] as ResizeHandle[]).map((handle) => (
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

const HANDLE_STYLE: Record<ResizeHandle, React.CSSProperties> = {
  tl: { top: -HANDLE_PX / 2, left: -HANDLE_PX / 2, cursor: "nwse-resize" },
  tr: { top: -HANDLE_PX / 2, right: -HANDLE_PX / 2, cursor: "nesw-resize" },
  bl: { bottom: -HANDLE_PX / 2, left: -HANDLE_PX / 2, cursor: "nesw-resize" },
  br: { bottom: -HANDLE_PX / 2, right: -HANDLE_PX / 2, cursor: "nwse-resize" },
};

function ResizeHandleNode({
  handle,
  onMouseDown,
}: {
  handle: ResizeHandle;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
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
