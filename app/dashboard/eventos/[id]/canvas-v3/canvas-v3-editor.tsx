"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ElType = "text" | "shape" | "app" | "decoration";

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
  border?: string;
  opacity?: number;
  blur?: number;
  // app
  appKind?: "rsvp" | "countdown" | "whatsapp" | "album" | "live" | "maps" | "qr";
}

type ToolId =
  | "templates"
  | "elements"
  | "text"
  | "uploaded"
  | "apps"
  | "projects";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & initial design
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 390;
const CANVAS_H = 844;

const cx = (w: number) => Math.round((CANVAS_W - w) / 2);

const INITIAL_ELEMENTS: V3Element[] = [
  // Background gradient overlay
  {
    id: "bg",
    type: "shape",
    x: 0, y: 0, width: CANVAS_W, height: CANVAS_H,
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
    border: el.border,
    cursor: el.locked ? "default" : selected ? "grab" : "pointer",
    userSelect: "none",
    overflow: "hidden",
  };

  if (el.background && !el.content) {
    boxStyle.background = el.background;
    if (el.blur) boxStyle.backdropFilter = `blur(${el.blur}px)`;
  }

  const ringStyle: React.CSSProperties = selected
    ? { outline: "2px solid #7c3aed", outlineOffset: "1px" }
    : {};

  const handleSize = 8;
  const handles = ["tl", "tr", "bl", "br"];
  const handlePositions: Record<string, React.CSSProperties> = {
    tl: { top: -handleSize / 2, left: -handleSize / 2, cursor: "nwse-resize" },
    tr: { top: -handleSize / 2, right: -handleSize / 2, cursor: "nesw-resize" },
    bl: { bottom: -handleSize / 2, left: -handleSize / 2, cursor: "nesw-resize" },
    br: { bottom: -handleSize / 2, right: -handleSize / 2, cursor: "nwse-resize" },
  };

  return (
    <div
      style={{ ...boxStyle, ...ringStyle }}
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
      {el.content && (
        <p
          style={{
            position: "relative",
            margin: 0,
            padding: el.type === "decoration" || el.type === "app" ? "16px 20px" : 0,
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
      {el.type === "app" && el.appKind && (
        <div
          style={{
            position: "absolute", inset: 0,
            background: el.background,
            borderRadius: el.borderRadius,
            border: el.border,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>{APP_LABELS[el.appKind]?.icon}</span>
          <span style={{
            color: el.appKind === "rsvp" ? "#1a0a18" : "#e8e6ff",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: el.appKind === "rsvp" ? 15 : 13,
            fontWeight: el.appKind === "rsvp" ? "700" : "500",
            letterSpacing: el.appKind === "rsvp" ? "0.12em" : "0.06em",
          }}>
            {APP_LABELS[el.appKind]?.label}
          </span>
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
}: {
  tool: ToolId;
  onAddText: (kind: "title" | "subtitle" | "paragraph") => void;
  onAddElement: (kind: string) => void;
  onAddApp: (kind: string) => void;
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
        {apps.map((app) => (
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
    const templates = ["Quinceañera Rose", "Boda Luxury", "XV KPop", "Bautizo Clásico", "Cumpleaños Infantil"];
    return (
      <div style={{ padding: "12px 14px" }}>
        <p style={{ color: "#8884a8", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Plantillas
        </p>
        {templates.map((t) => (
          <button
            key={t}
            type="button"
            style={{
              display: "block", width: "100%", marginBottom: 8,
              padding: "10px 14px",
              background: "#1e1e2d", border: "1px solid #2a2a3d",
              borderRadius: 10, cursor: "pointer", textAlign: "left",
              color: "#c8c4f0", fontSize: 12,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {t}
          </button>
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
}: {
  element: V3Element | null;
  onChange: (id: string, patch: Partial<V3Element>) => void;
}) {
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

  if (!element) {
    return (
      <div style={s}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 28, opacity: 0.25 }}>◻</span>
          <p style={{ color: "#8884a8", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", textAlign: "center", margin: 0 }}>
            Selecciona un elemento para editar sus propiedades
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #2a2a3d" }}>
        <p style={{ color: "#e8e6ff", fontSize: 12, fontWeight: "600", fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
          {element.type === "text" ? "Texto" : element.type === "app" ? "Bloque App" : element.type === "decoration" ? "Decoración" : "Forma"}
          {element.locked && <span style={{ marginLeft: 8, color: "#c8a96a", fontSize: 10 }}>🔒</span>}
        </p>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Position & size */}
        <div>
          <span style={labelStyle}>Posición y tamaño</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(["x", "y", "width", "height"] as const).map((k) => (
              <div key={k}>
                <span style={{ ...labelStyle, fontSize: 9 }}>{k.toUpperCase()}</span>
                <input
                  type="number"
                  value={Math.round(element[k] as number) || 0}
                  disabled={element.locked}
                  onChange={(e) => onChange(element.id, { [k]: Number(e.target.value) })}
                  style={{ ...inputStyle, opacity: element.locked ? 0.5 : 1 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Opacity */}
        <div>
          <span style={labelStyle}>Opacidad</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={element.opacity ?? 1}
            onChange={(e) => onChange(element.id, { opacity: Number(e.target.value) })}
            style={{ width: "100%", accentColor: "#7c3aed" }}
          />
          <span style={{ color: "#8884a8", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif" }}>
            {Math.round((element.opacity ?? 1) * 100)}%
          </span>
        </div>

        {/* Text controls */}
        {element.type === "text" && (
          <>
            <div>
              <span style={labelStyle}>Contenido</span>
              <textarea
                value={element.content ?? ""}
                rows={3}
                onChange={(e) => onChange(element.id, { content: e.target.value })}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div>
              <span style={labelStyle}>Color</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={element.color ?? "#ffffff"}
                  onChange={(e) => onChange(element.id, { color: e.target.value })}
                  style={{ width: 36, height: 30, border: "none", borderRadius: 6, cursor: "pointer", background: "none" }}
                />
                <input
                  type="text"
                  value={element.color ?? "#ffffff"}
                  onChange={(e) => onChange(element.id, { color: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
            <div>
              <span style={labelStyle}>Tamaño de fuente</span>
              <input
                type="number" min={8} max={120}
                value={element.fontSize ?? 16}
                onChange={(e) => onChange(element.id, { fontSize: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>
            <div>
              <span style={labelStyle}>Fuente</span>
              <select
                value={element.fontFamily ?? "Inter, system-ui, sans-serif"}
                onChange={(e) => onChange(element.id, { fontFamily: e.target.value })}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="Inter, system-ui, sans-serif">Inter</option>
                <option value="'Playfair Display', Georgia, serif">Playfair Display</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Dancing Script', cursive">Dancing Script</option>
              </select>
            </div>
            <div>
              <span style={labelStyle}>Alineación</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onChange(element.id, { textAlign: a })}
                    style={{
                      flex: 1, padding: "6px 0",
                      background: element.textAlign === a ? "#7c3aed" : "#1e1e2d",
                      border: "1px solid #2a2a3d",
                      borderRadius: 6, cursor: "pointer",
                      color: element.textAlign === a ? "#fff" : "#9898b8",
                      fontSize: 12,
                    }}
                  >
                    {a === "left" ? "⬛" : a === "center" ? "▬" : "⬛"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Shape / decoration */}
        {(element.type === "shape" || element.type === "decoration") && (
          <>
            <div>
              <span style={labelStyle}>Borde redondeado</span>
              <input
                type="range" min={0} max={999} step={1}
                value={element.borderRadius ?? 0}
                onChange={(e) => onChange(element.id, { borderRadius: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "#7c3aed" }}
              />
              <span style={{ color: "#8884a8", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif" }}>
                {element.borderRadius ?? 0}px
              </span>
            </div>
            {element.blur !== undefined && (
              <div>
                <span style={labelStyle}>Blur (backdrop)</span>
                <input
                  type="range" min={0} max={40} step={1}
                  value={element.blur ?? 0}
                  onChange={(e) => onChange(element.id, { blur: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: "#7c3aed" }}
                />
                <span style={{ color: "#8884a8", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif" }}>
                  {element.blur ?? 0}px
                </span>
              </div>
            )}
          </>
        )}

        {/* App config */}
        {element.type === "app" && element.appKind && (
          <div>
            <span style={labelStyle}>Bloque</span>
            <div style={{
              padding: "10px 12px",
              background: "#1e1e2d", border: "1px solid #2a2a3d",
              borderRadius: 8,
            }}>
              <p style={{ color: "#c8c4f0", fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
                {APP_LABELS[element.appKind]?.icon} {APP_LABELS[element.appKind]?.label}
              </p>
              <p style={{ color: "#8884a8", fontSize: 10, fontFamily: "Inter, system-ui, sans-serif", margin: "4px 0 0" }}>
                Conectado al evento · Solo demo
              </p>
            </div>
          </div>
        )}

        {/* Visibility */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...labelStyle, margin: 0 }}>Visible</span>
          <button
            type="button"
            onClick={() => onChange(element.id, { visible: !element.visible })}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: element.visible ? "#7c3aed" : "#2a2a3d",
              border: "none", cursor: "pointer", position: "relative",
              transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute", top: 2,
              left: element.visible ? 18 : 2,
              width: 16, height: 16,
              background: "#fff", borderRadius: 8,
              transition: "left 0.2s",
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

export function CanvasEditorV3() {
  const [elements, setElements] = useState<V3Element[]>(INITIAL_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string; startX: number; startY: number; elX: number; elY: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: string; handle: string;
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
  } | null>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

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

  // ── Add elements ────────────────────────────────────────────────────────────
  const addText = (kind: "title" | "subtitle" | "paragraph") => {
    const id = `text-${Date.now()}`;
    const base: V3Element = {
      id, type: "text",
      x: cx(300), y: 400, width: 300, height: null,
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
    setElements((prev) => [...prev, {
      id, type: "decoration" as ElType,
      x: cx(200), y: 400, width: 200, height: isLine ? 2 : 80,
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
    const isRsvp = kind === "rsvp";
    setElements((prev) => [...prev, {
      id, type: "app" as ElType,
      x: cx(320), y: 400, width: 320, height: isRsvp ? 90 : 60,
      locked: false, visible: true, zIndex: prev.length,
      appKind: kind as V3Element["appKind"],
      background: isRsvp
        ? "linear-gradient(135deg,#c8a96a,#9b6f2a)"
        : "rgba(124,58,237,0.18)",
      border: isRsvp ? undefined : "1px solid rgba(124,58,237,0.35)",
      borderRadius: isRsvp ? 16 : 14, opacity: 1,
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

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

  const ICON_SIDEBAR_W = 72;
  const EXPANDED_PANEL_W = 260;
  // Inspector width: 320px on wide screens, 280px on laptop
  const INSPECTOR_W = vw >= 1600 ? 320 : 280;
  // On laptop and smaller screens inspector renders as overlay drawer
  const inspectorIsOverlay = vw < 1400;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
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
          Valentina Gómez · Editor V3
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

        {/* Actions */}
        <button type="button" onClick={() => setPreview(!preview)} style={{ ...topBtnStyle, flexShrink: 0 }}>
          {preview ? "✎ Editar" : "👁 Preview"}
        </button>
        <button type="button" onClick={handleSave}
          style={{ ...topBtnStyle, flexShrink: 0, background: saved ? "#1a3a1a" : "#1e1e2d", color: saved ? "#4ade80" : "#c8c4f0", borderColor: saved ? "#4ade80" : "#2a2a3d" }}>
          {saved ? "✓ Guardado" : "Guardar"}
        </button>
        <button
          type="button"
          style={{ ...topBtnStyle, flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff", borderColor: "transparent" }}
        >
          Publicar
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

        {/* ── ICON SIDEBAR ── */}
        <div style={{
          width: ICON_SIDEBAR_W, minWidth: ICON_SIDEBAR_W, flexShrink: 0,
          background: "#16161f",
          borderRight: "1px solid #2a2a3d",
          display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: 8, gap: 2, zIndex: 40,
        }}>
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(active ? null : tool.id)}
                title={tool.label}
                style={{
                  width: 52, height: 52, borderRadius: 10,
                  background: active ? "#2a1f4d" : "transparent",
                  border: active ? "1px solid #7c3aed" : "1px solid transparent",
                  cursor: "pointer", color: active ? "#a78bfa" : "#8884a8",
                  fontSize: 18, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 2,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#c8c4f0"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#8884a8"; }}
              >
                <span style={{ lineHeight: 1 }}>{tool.icon}</span>
                <span style={{ fontSize: 8, letterSpacing: "0.06em" }}>{tool.label}</span>
              </button>
            );
          })}

          {/* Delete selected */}
          {selectedId && (
            <button
              type="button"
              onClick={deleteSelected}
              title="Eliminar"
              style={{
                marginTop: "auto", marginBottom: 10,
                width: 36, height: 36, borderRadius: 8,
                background: "rgba(220,38,38,0.15)",
                border: "1px solid rgba(220,38,38,0.35)",
                cursor: "pointer", color: "#f87171",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ✕
            </button>
          )}
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
                width: CANVAS_W,
                height: CANVAS_H,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px #2a2a3d",
              }}
            >
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
              390 × 844 px · Mobile
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
            <RightPanel element={selected && !preview ? selected : null} onChange={patchElement} />
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared button style
// ─────────────────────────────────────────────────────────────────────────────

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
