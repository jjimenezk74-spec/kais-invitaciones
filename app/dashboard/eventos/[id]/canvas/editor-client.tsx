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

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "ADD_TEXT": {
      const el = createTextElement();
      // Stack new element above existing ones
      const maxZ = state.design.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      el.zIndex = maxZ + 1;
      return {
        ...state,
        design: {
          ...state.design,
          elements: [...state.design.elements, el],
        },
        selectedId: el.id,
        isDirty: true,
      };
    }
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "UPDATE_TEXT": {
      return {
        ...state,
        design: {
          ...state.design,
          elements: state.design.elements.map((el) =>
            el.id === action.id && el.type === "text"
              ? { ...el, ...action.patch }
              : el
          ),
        },
        isDirty: true,
      };
    }
    case "MOVE": {
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
    }
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

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
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

  // Scale: computed from the wrapper div width
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);

  useEffect(() => {
    // Load Google Fonts
    if (!document.getElementById("kais-canvas-fonts")) {
      const link = document.createElement("link");
      link.id = "kais-canvas-fonts";
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_URL;
      document.head.appendChild(link);
    }
    // Compute initial scale
    const update = () => {
      if (!wrapperRef.current) return;
      const w = wrapperRef.current.getBoundingClientRect().width - 32; // 16px padding each side
      setScale(Math.max(0.3, Math.min(1, w / REF_W)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Drag ────────────────────────────────────────────────────────────────

  const dragRef = useRef<{
    elementId: string;
    startMouseX: number;
    startMouseY: number;
    startElX: number;
    startElY: number;
  } | null>(null);

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      const el = state.design.elements.find((el) => el.id === elementId);
      if (!el || el.locked) return;
      dispatch({ type: "SELECT", id: elementId });
      dragRef.current = {
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: el.x,
        startElY: el.y,
      };
    },
    [state.design.elements]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      const { elementId, startMouseX, startMouseY, startElX, startElY } = dragRef.current;
      // Convert screen delta → canvas % delta
      const dxScreen = e.clientX - startMouseX;
      const dyScreen = e.clientY - startMouseY;
      const dxPct = (dxScreen / scale / REF_W) * 100;
      const dyPct = (dyScreen / scale / REF_H) * 100;
      dispatch({
        type: "MOVE",
        id: elementId,
        x: startElX + dxPct,
        y: startElY + dyPct,
      });
    },
    [scale]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────

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
    if (!confirm("¿Eliminar todo el diseño canvas? El evento volverá a usar la plantilla.")) return;
    const { error } = await clearCanvasDesign(eventId);
    if (error) {
      alert(`Error: ${error}`);
    } else {
      dispatch({ type: "CLEAR" });
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────

  const selected = state.design.elements.find((el) => el.id === state.selectedId) ?? null;
  const sortedElements = [...state.design.elements].sort((a, b) => a.zIndex - b.zIndex);

  const saveLabel =
    state.saveStatus === "saving"
      ? "Guardando…"
      : state.saveStatus === "error"
      ? "Error al guardar"
      : state.isDirty
      ? "Guardar *"
      : "Guardado";

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
          {/* Outer shell scaled to match refWidth × refHeight */}
          <div
            style={{
              width: REF_W * scale,
              height: REF_H * scale,
              flexShrink: 0,
              position: "relative",
            }}
          >
            {/* Inner stage at reference dimensions, scaled with transform */}
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
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.7)",
                cursor: dragRef.current ? "grabbing" : "default",
              }}
            >
              {/* Background */}
              {coverImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
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
                    background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                  }}
                />
              )}

              {/* Checkerboard hint (empty canvas) */}
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
                    CANVAS VACÍO
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
                  onMouseDown={(e) => handleElementMouseDown(e, el.id)}
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
                  ? 'Pulsa "+ Texto" para añadir un elemento al canvas.'
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
// StageElement — renders a single element inside the canvas
// ─────────────────────────────────────────────────────────────────────────────

type StageElementProps = {
  element: CanvasElement;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
};

function StageElement({ element, selected, onMouseDown, onClick }: StageElementProps) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: element.width,
    height: element.height ?? undefined,
    opacity: element.opacity,
    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    cursor: element.locked ? "default" : "grab",
    userSelect: "none",
    outline: selected ? "2px solid #6366f1" : "2px solid transparent",
    outlineOffset: 2,
    borderRadius: 2,
  };

  if (element.type === "text") {
    return (
      <p
        style={{
          ...style,
          fontFamily: element.fontFamily,
          fontSize: element.fontSize,
          fontWeight: element.fontWeight,
          fontStyle: element.fontStyle,
          textAlign: element.textAlign,
          color: element.color,
          lineHeight: element.lineHeight,
          letterSpacing: `${element.letterSpacing}em`,
          textShadow: element.textShadow ?? undefined,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        onMouseDown={onMouseDown}
        onClick={onClick}
      >
        {element.content}
      </p>
    );
  }

  return null;
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
      {/* Section header */}
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

      {/* Content */}
      <div className={field}>
        <label className={label}>Texto</label>
        <textarea
          rows={3}
          value={element.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className={input + " resize-none"}
        />
      </div>

      {/* Color */}
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

      {/* Font size */}
      <div className={field}>
        <label className={label}>Tamaño ({element.fontSize}px)</label>
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

      {/* Font family */}
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

      {/* Font weight + style */}
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

      {/* Italic */}
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
              {s === "normal" ? "Normal" : "Itálica"}
            </button>
          ))}
        </div>
      </div>

      {/* Text align */}
      <div className={field}>
        <label className={label}>Alineación</label>
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

      {/* Rotation */}
      <div className={field}>
        <label className={label}>Rotación ({element.rotation}°)</label>
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

      {/* Opacity */}
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

      {/* Z-index */}
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

      {/* Width */}
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
    </div>
  );
}
