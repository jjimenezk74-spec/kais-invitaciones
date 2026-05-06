"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  V2CanvasDesign,
  V2DecorationElement,
  V2Element,
  V2ImageElement,
  V2TextElement,
} from "./types-v2";
import { INITIAL_DESIGN } from "./initial-design";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 390;
const MIN_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Element renderers
// ─────────────────────────────────────────────────────────────────────────────

function RenderText({ el }: { el: V2TextElement }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent:
          el.textAlign === "left"
            ? "flex-start"
            : el.textAlign === "right"
            ? "flex-end"
            : "center",
        fontFamily: el.fontFamily,
        fontSize: el.fontSize,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
        textAlign: el.textAlign,
        color: el.color,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflow: "hidden",
        padding: "4px 8px",
        boxSizing: "border-box",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {el.content}
    </div>
  );
}

function RenderImage({ el }: { el: V2ImageElement }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={el.url}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: el.objectFit,
        borderRadius: el.borderRadius,
        display: "block",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function RenderDecoration({ el }: { el: V2DecorationElement }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        color: el.color,
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: "center center",
        pointerEvents: "none",
        userSelect: "none",
      }}
      dangerouslySetInnerHTML={{ __html: el.svgContent }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resize handle
// ─────────────────────────────────────────────────────────────────────────────

type ResizeCorner = "se" | "sw" | "ne" | "nw";

interface ResizeHandleProps {
  corner: ResizeCorner;
  onPointerDown: (corner: ResizeCorner, e: React.PointerEvent) => void;
}

function ResizeHandle({ corner, onPointerDown }: ResizeHandleProps) {
  const pos: Record<ResizeCorner, React.CSSProperties> = {
    nw: { top: -4, left: -4, cursor: "nw-resize" },
    ne: { top: -4, right: -4, cursor: "ne-resize" },
    sw: { bottom: -4, left: -4, cursor: "sw-resize" },
    se: { bottom: -4, right: -4, cursor: "se-resize" },
  };
  return (
    <div
      style={{
        position: "absolute",
        width: 10,
        height: 10,
        background: "#fff",
        border: "2px solid #2563eb",
        borderRadius: 2,
        ...pos[corner],
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(corner, e);
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Text edit overlay
// ─────────────────────────────────────────────────────────────────────────────

interface TextEditOverlayProps {
  el: V2TextElement;
  scale: number;
  onCommit: (newContent: string) => void;
  onClose: () => void;
}

function TextEditOverlay({ el, scale, onCommit, onClose }: TextEditOverlayProps) {
  const [value, setValue] = useState(el.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: el.y * scale,
        left: el.x * scale,
        width: el.width * scale,
        height: el.height * scale,
        zIndex: 9999,
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          onCommit(value);
          onClose();
        }}
        style={{
          width: "100%",
          height: "100%",
          background: "rgba(255,255,255,0.95)",
          border: "2px solid #2563eb",
          borderRadius: 4,
          padding: "4px 8px",
          boxSizing: "border-box",
          resize: "none",
          fontFamily: el.fontFamily,
          fontSize: el.fontSize * scale,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle,
          textAlign: el.textAlign,
          color: "#000",
          lineHeight: el.lineHeight,
          letterSpacing: el.letterSpacing,
          outline: "none",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Properties panel
// ─────────────────────────────────────────────────────────────────────────────

interface PropsPanelProps {
  el: V2Element;
  onChange: (updated: Partial<V2Element>) => void;
}

function PropertiesPanel({ el, onChange }: PropsPanelProps) {
  return (
    <div
      style={{
        width: 220,
        background: "#1e1e2e",
        color: "#e2e8f0",
        padding: "12px",
        overflowY: "auto",
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
        Propiedades
      </div>

      {/* Position & Size */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Posición & Tamaño</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(["x", "y", "width", "height"] as const).map((prop) => (
            <label key={prop} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: 10 }}>{prop}</span>
              <input
                type="number"
                value={Math.round(el[prop])}
                onChange={(e) => onChange({ [prop]: Number(e.target.value) } as Partial<V2Element>)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "#64748b", fontWeight: 600 }}>Opacidad</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={el.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) } as Partial<V2Element>)}
            style={{ width: "100%" }}
          />
          <span style={{ color: "#94a3b8", textAlign: "right" }}>{Math.round(el.opacity * 100)}%</span>
        </label>
      </div>

      {/* Text-specific */}
      {el.type === "text" && (
        <>
          <div style={{ color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Texto</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Contenido</span>
              <textarea
                value={el.content}
                onChange={(e) => onChange({ content: e.target.value } as Partial<V2Element>)}
                rows={3}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "4px 6px",
                  fontSize: 12,
                  resize: "vertical",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Tamaño fuente</span>
              <input
                type="number"
                value={el.fontSize}
                min={8}
                max={120}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) } as Partial<V2Element>)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Color</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="color"
                  value={el.color}
                  onChange={(e) => onChange({ color: e.target.value } as Partial<V2Element>)}
                  style={{ width: 32, height: 28, border: "none", padding: 0, cursor: "pointer", background: "none" }}
                />
                <input
                  type="text"
                  value={el.color}
                  onChange={(e) => onChange({ color: e.target.value } as Partial<V2Element>)}
                  style={{
                    flex: 1,
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 4,
                    color: "#e2e8f0",
                    padding: "3px 6px",
                    fontSize: 12,
                  }}
                />
              </div>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Alineación</span>
              <select
                value={el.textAlign}
                onChange={(e) =>
                  onChange({ textAlign: e.target.value as V2TextElement["textAlign"] } as Partial<V2Element>)
                }
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Estilo</span>
              <select
                value={el.fontStyle}
                onChange={(e) =>
                  onChange({ fontStyle: e.target.value as V2TextElement["fontStyle"] } as Partial<V2Element>)
                }
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              >
                <option value="normal">Normal</option>
                <option value="italic">Itálica</option>
              </select>
            </label>
          </div>
        </>
      )}

      {/* Image-specific */}
      {el.type === "image" && (
        <>
          <div style={{ color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Imagen</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>URL</span>
              <input
                type="text"
                value={el.url}
                onChange={(e) => onChange({ url: e.target.value } as Partial<V2Element>)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 11,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Ajuste</span>
              <select
                value={el.objectFit}
                onChange={(e) =>
                  onChange({ objectFit: e.target.value as V2ImageElement["objectFit"] } as Partial<V2Element>)
                }
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Radio borde</span>
              <input
                type="number"
                value={el.borderRadius}
                min={0}
                max={999}
                onChange={(e) => onChange({ borderRadius: Number(e.target.value) } as Partial<V2Element>)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              />
            </label>
          </div>
        </>
      )}

      {/* Decoration-specific */}
      {el.type === "decoration" && (
        <>
          <div style={{ color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Decoración</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Color</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="color"
                  value={el.color}
                  onChange={(e) => onChange({ color: e.target.value } as Partial<V2Element>)}
                  style={{ width: 32, height: 28, border: "none", padding: 0, cursor: "pointer", background: "none" }}
                />
                <input
                  type="text"
                  value={el.color}
                  onChange={(e) => onChange({ color: e.target.value } as Partial<V2Element>)}
                  style={{
                    flex: 1,
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 4,
                    color: "#e2e8f0",
                    padding: "3px 6px",
                    fontSize: 12,
                  }}
                />
              </div>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8", fontSize: 10, textTransform: "uppercase" }}>Rotación (°)</span>
              <input
                type="number"
                value={el.rotation}
                min={-180}
                max={180}
                onChange={(e) => onChange({ rotation: Number(e.target.value) } as Partial<V2Element>)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  color: "#e2e8f0",
                  padding: "3px 6px",
                  fontSize: 12,
                }}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layers panel
// ─────────────────────────────────────────────────────────────────────────────

interface LayersPanelProps {
  elements: V2Element[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function LayersPanel({ elements, selectedId, onSelect }: LayersPanelProps) {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
  return (
    <div
      style={{
        width: 180,
        background: "#1e1e2e",
        color: "#e2e8f0",
        padding: "12px 8px",
        overflowY: "auto",
        fontSize: 12,
        flexShrink: 0,
        borderRight: "1px solid #334155",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
        Capas
      </div>
      {sorted.map((el) => {
        const isSelected = el.id === selectedId;
        const icon = el.type === "text" ? "T" : el.type === "image" ? "🖼" : "✦";
        const label =
          el.type === "text"
            ? el.content.substring(0, 20) || "(vacío)"
            : el.type === "image"
            ? "Imagen"
            : "Decoración";
        return (
          <div
            key={el.id}
            onClick={() => onSelect(el.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 6px",
              borderRadius: 4,
              cursor: "pointer",
              background: isSelected ? "#1d4ed8" : "transparent",
              color: isSelected ? "#fff" : "#cbd5e1",
              marginBottom: 2,
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.7, width: 16 }}>{icon}</span>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 11,
              }}
            >
              {label}
            </span>
            {el.locked && <span style={{ fontSize: 9, opacity: 0.5 }}>🔒</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main canvas stage
// ─────────────────────────────────────────────────────────────────────────────

interface DragState {
  elementId: string;
  startMouseX: number;
  startMouseY: number;
  startElX: number;
  startElY: number;
}

interface ResizeState {
  elementId: string;
  corner: ResizeCorner;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

interface CanvasStageProps {
  design: V2CanvasDesign;
  selectedId: string | null;
  editingId: string | null;
  scale: number;
  onSelect: (id: string | null) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onResizeEnd: (id: string, x: number, y: number, w: number, h: number) => void;
  onEditCommit: (id: string, content: string) => void;
  onEditClose: () => void;
  onDoubleClick: (id: string) => void;
}

function CanvasStage({
  design,
  selectedId,
  editingId,
  scale,
  onSelect,
  onMoveEnd,
  onResizeEnd,
  onEditCommit,
  onEditClose,
  onDoubleClick,
}: CanvasStageProps) {
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  // live position during drag (avoids re-rendering all elements)
  const [livePos, setLivePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [liveSize, setLiveSize] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  const canvasHeight = design.height * scale;
  const canvasWidth = CANVAS_W * scale;

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startMouseX) / scale;
        const dy = (e.clientY - dragRef.current.startMouseY) / scale;
        const el = design.elements.find((el) => el.id === dragRef.current!.elementId);
        if (!el) return;
        const newX = clamp(dragRef.current.startElX + dx, 0, CANVAS_W - el.width);
        const newY = clamp(dragRef.current.startElY + dy, 0, design.height - el.height);
        setLivePos({ id: dragRef.current.elementId, x: newX, y: newY });
      }

      if (resizeRef.current) {
        const dx = (e.clientX - resizeRef.current.startMouseX) / scale;
        const dy = (e.clientY - resizeRef.current.startMouseY) / scale;
        const { corner, startX, startY, startW, startH } = resizeRef.current;
        let x = startX,
          y = startY,
          w = startW,
          h = startH;

        if (corner === "se") {
          w = Math.max(MIN_SIZE, startW + dx);
          h = Math.max(MIN_SIZE, startH + dy);
        } else if (corner === "sw") {
          const newW = Math.max(MIN_SIZE, startW - dx);
          x = startX + startW - newW;
          w = newW;
          h = Math.max(MIN_SIZE, startH + dy);
        } else if (corner === "ne") {
          w = Math.max(MIN_SIZE, startW + dx);
          const newH = Math.max(MIN_SIZE, startH - dy);
          y = startY + startH - newH;
          h = newH;
        } else if (corner === "nw") {
          const newW = Math.max(MIN_SIZE, startW - dx);
          x = startX + startW - newW;
          w = newW;
          const newH = Math.max(MIN_SIZE, startH - dy);
          y = startY + startH - newH;
          h = newH;
        }
        setLiveSize({ id: resizeRef.current.elementId, x, y, w, h });
      }
    },
    [design.elements, design.height, scale]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startMouseX) / scale;
        const dy = (e.clientY - dragRef.current.startMouseY) / scale;
        const el = design.elements.find((el) => el.id === dragRef.current!.elementId);
        if (el) {
          const newX = clamp(dragRef.current.startElX + dx, 0, CANVAS_W - el.width);
          const newY = clamp(dragRef.current.startElY + dy, 0, design.height - el.height);
          onMoveEnd(dragRef.current.elementId, newX, newY);
        }
        dragRef.current = null;
        setLivePos(null);
      }

      if (resizeRef.current) {
        if (liveSize) {
          onResizeEnd(liveSize.id, liveSize.x, liveSize.y, liveSize.w, liveSize.h);
        }
        resizeRef.current = null;
        setLiveSize(null);
      }
    },
    [design.elements, design.height, liveSize, onMoveEnd, onResizeEnd, scale]
  );

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  function handleElementPointerDown(el: V2Element, e: React.PointerEvent) {
    if (el.locked) return;
    e.stopPropagation();
    onSelect(el.id);
    dragRef.current = {
      elementId: el.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startElX: el.x,
      startElY: el.y,
    };
  }

  function handleResizePointerDown(el: V2Element, corner: ResizeCorner, e: React.PointerEvent) {
    if (el.locked) return;
    e.stopPropagation();
    resizeRef.current = {
      elementId: el.id,
      corner,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: el.x,
      startY: el.y,
      startW: el.width,
      startH: el.height,
    };
  }

  const sortedElements = [...design.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        width: canvasWidth,
        height: canvasHeight,
        position: "relative",
        background: design.background,
        overflow: "hidden",
        cursor: "default",
        flexShrink: 0,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }}
      onClick={() => onSelect(null)}
    >
      {sortedElements.map((el) => {
        const isSelected = el.id === selectedId;
        const isEditing = el.id === editingId;

        const lx = livePos?.id === el.id ? livePos.x : el.x;
        const ly = livePos?.id === el.id ? livePos.y : el.y;
        const lw = liveSize?.id === el.id ? liveSize.w : el.width;
        const lh = liveSize?.id === el.id ? liveSize.h : el.height;
        const lx2 = liveSize?.id === el.id ? liveSize.x : lx;
        const ly2 = liveSize?.id === el.id ? liveSize.y : ly;

        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: lx2 * scale,
              top: ly2 * scale,
              width: lw * scale,
              height: lh * scale,
              zIndex: el.zIndex,
              opacity: el.opacity,
              cursor: el.locked ? "default" : "move",
              boxSizing: "border-box",
              outline: isSelected && !isEditing ? "2px solid #2563eb" : "none",
              outlineOffset: 1,
            }}
            onPointerDown={(e) => handleElementPointerDown(el, e)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!el.locked && el.type === "text") {
                onDoubleClick(el.id);
              }
            }}
          >
            {el.type === "text" && !isEditing && <RenderText el={{ ...el, x: lx2, y: ly2, width: lw, height: lh }} />}
            {el.type === "image" && <RenderImage el={{ ...el, x: lx2, y: ly2, width: lw, height: lh }} />}
            {el.type === "decoration" && (
              <RenderDecoration el={{ ...el, x: lx2, y: ly2, width: lw, height: lh }} />
            )}

            {isSelected && !isEditing && !el.locked && (
              <>
                <ResizeHandle
                  corner="nw"
                  onPointerDown={(corner, e) => handleResizePointerDown(el, corner, e)}
                />
                <ResizeHandle
                  corner="ne"
                  onPointerDown={(corner, e) => handleResizePointerDown(el, corner, e)}
                />
                <ResizeHandle
                  corner="sw"
                  onPointerDown={(corner, e) => handleResizePointerDown(el, corner, e)}
                />
                <ResizeHandle
                  corner="se"
                  onPointerDown={(corner, e) => handleResizePointerDown(el, corner, e)}
                />
              </>
            )}
          </div>
        );
      })}

      {/* Text editing overlay */}
      {editingId &&
        (() => {
          const el = design.elements.find((e) => e.id === editingId);
          if (!el || el.type !== "text") return null;
          return (
            <TextEditOverlay
              el={{ ...el, x: livePos?.id === el.id ? livePos.x : el.x, y: livePos?.id === el.id ? livePos.y : el.y }}
              scale={scale}
              onCommit={(content) => onEditCommit(editingId, content)}
              onClose={onEditClose}
            />
          );
        })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top toolbar
// ─────────────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  selectedEl: V2Element | null;
  onDeselect: () => void;
  onDelete: () => void;
  onEditText: () => void;
  onExport: () => void;
  onReset: () => void;
  saved: boolean;
}

function Toolbar({ selectedEl, onDeselect, onDelete, onEditText, onExport, onReset, saved }: ToolbarProps) {
  return (
    <div
      style={{
        height: 48,
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
        flexShrink: 0,
        color: "#e2e8f0",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 700, color: "#60a5fa", marginRight: 8 }}>Canvas V2</span>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#64748b",
          fontSize: 12,
        }}
      >
        {selectedEl ? (
          <>
            <span style={{ color: "#94a3b8" }}>
              {selectedEl.type === "text" ? "T" : selectedEl.type === "image" ? "🖼" : "✦"}{" "}
              {selectedEl.type === "text"
                ? (selectedEl as V2TextElement).content.substring(0, 24) || "(texto vacío)"
                : selectedEl.type === "image"
                ? "Imagen"
                : "Decoración"}
            </span>
            {selectedEl.type === "text" && (
              <button
                onClick={onEditText}
                style={{
                  background: "#1d4ed8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "3px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Editar texto
              </button>
            )}
            {!selectedEl.locked && (
              <button
                onClick={onDelete}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "3px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Eliminar
              </button>
            )}
            <button
              onClick={onDeselect}
              style={{
                background: "transparent",
                color: "#64748b",
                border: "1px solid #334155",
                borderRadius: 4,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <span>Haz clic en un elemento para seleccionarlo · Doble clic para editar texto</span>
        )}
      </div>

      {saved && (
        <span style={{ color: "#22c55e", fontSize: 12 }}>✓ Guardado</span>
      )}

      <button
        onClick={onExport}
        style={{
          background: "#0f172a",
          color: "#94a3b8",
          border: "1px solid #334155",
          borderRadius: 4,
          padding: "4px 12px",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Exportar JSON
      </button>

      <button
        onClick={onReset}
        style={{
          background: "transparent",
          color: "#64748b",
          border: "1px solid #1e293b",
          borderRadius: 4,
          padding: "4px 12px",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Resetear
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root editor
// ─────────────────────────────────────────────────────────────────────────────

export function CanvasEditorV2() {
  const [design, setDesign] = useState<V2CanvasDesign>(INITIAL_DESIGN);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Scale canvas to fit the available height (~80% of viewport)
  const [scale, setScale] = useState(0.75);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function recalcScale() {
      const viewH = window.innerHeight - 48; // minus toolbar
      const idealScale = (viewH - 40) / design.height;
      setScale(Math.min(1, Math.max(0.3, idealScale)));
    }
    recalcScale();
    window.addEventListener("resize", recalcScale);
    return () => window.removeEventListener("resize", recalcScale);
  }, [design.height]);

  const selectedEl = design.elements.find((e) => e.id === selectedId) ?? null;

  function updateElement(id: string, patch: Partial<V2Element>) {
    setDesign((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? ({ ...el, ...patch } as V2Element) : el
      ),
    }));
    setSaved(false);
  }

  function handleMoveEnd(id: string, x: number, y: number) {
    updateElement(id, { x, y });
    setSaved(true);
    // brief "Saved" indicator
    setTimeout(() => setSaved(false), 1500);
  }

  function handleResizeEnd(id: string, x: number, y: number, w: number, h: number) {
    updateElement(id, { x, y, width: w, height: h });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleEditCommit(id: string, content: string) {
    updateElement(id, { content } as Partial<V2Element>);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleDelete() {
    if (!selectedId) return;
    setDesign((prev) => ({
      ...prev,
      elements: prev.elements.filter((e) => e.id !== selectedId),
    }));
    setSelectedId(null);
  }

  function handleExport() {
    const json = JSON.stringify(design, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "canvas-v2-design.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setDesign(INITIAL_DESIGN);
    setSelectedId(null);
    setEditingId(null);
  }

  function handlePropsChange(patch: Partial<V2Element>) {
    if (!selectedId) return;
    updateElement(selectedId, patch);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0a14",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Top bar */}
      <Toolbar
        selectedEl={selectedEl}
        onDeselect={() => setSelectedId(null)}
        onDelete={handleDelete}
        onEditText={() => setEditingId(selectedId)}
        onExport={handleExport}
        onReset={handleReset}
        saved={saved}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Layers panel */}
        <LayersPanel
          elements={design.elements}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setEditingId(null);
          }}
        />

        {/* Canvas scroll area */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <CanvasStage
            design={design}
            selectedId={selectedId}
            editingId={editingId}
            scale={scale}
            onSelect={(id) => {
              setSelectedId(id);
              if (editingId && id !== editingId) setEditingId(null);
            }}
            onMoveEnd={handleMoveEnd}
            onResizeEnd={handleResizeEnd}
            onEditCommit={handleEditCommit}
            onEditClose={() => setEditingId(null)}
            onDoubleClick={(id) => setEditingId(id)}
          />
        </div>

        {/* Properties panel */}
        {selectedEl && (
          <PropertiesPanel el={selectedEl} onChange={handlePropsChange} />
        )}
      </div>
    </div>
  );
}
