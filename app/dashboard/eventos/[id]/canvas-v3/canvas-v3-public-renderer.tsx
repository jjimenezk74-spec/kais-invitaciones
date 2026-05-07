"use client";

import React, { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrored from canvas-v3-editor.tsx — keep in sync)
// ─────────────────────────────────────────────────────────────────────────────

type V3AppType = "rsvp" | "whatsapp" | "countdown" | "maps" | "live-album" | "live-screen" | "qr";

export interface V3Element {
  id: string;
  type: "text" | "shape" | "app" | "decoration";
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
  border?: string;       // legacy shorthand
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "none";
  opacity?: number;
  blur?: number;
  // app
  appKind?: V3AppType | "album" | "live";
  appType?: V3AppType;
  config?: { url?: string; primaryColor?: string; textColor?: string };
}

export interface V3Section {
  id: string;
  label: string;
  y: number;
  height: number;
  background: string;
}

export interface CanvasV3Design {
  version: 3;
  viewport: "mobile";
  width: number;
  height: number;
  themeId: string;
  sections: V3Section[];
  elements: V3Element[];
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizePublicV3Design — tolerant normalizer
// Only returns null if value is not an object at all.
// Every field has a fallback; no element can cause the whole design to fail.
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function safeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function safeBackground(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0") return fallback;
  return trimmed;
}

function computeBorder(el: { border?: string; borderColor?: string; borderWidth?: number; borderStyle?: "solid" | "dashed" | "none" }): string | undefined {
  if (el.borderWidth !== undefined || el.borderStyle !== undefined || el.borderColor !== undefined) {
    const w = el.borderWidth ?? 1;
    if (w === 0 || el.borderStyle === "none") return "none";
    const s = el.borderStyle ?? "solid";
    const c = el.borderColor ?? "rgba(200,169,106,0.35)";
    return `${w}px ${s} ${c}`;
  }
  return el.border;
}

const DEFAULT_SECTION: V3Section = {
  id: "hero",
  label: "Hero",
  y: 0,
  height: 844,
  background: "#050506",
};

export function normalizePublicV3Design(value: unknown): CanvasV3Design | null {
  try {
    // Only hard-reject if not an object at all
    if (!isRecord(value)) return null;

    // ── Sections ──────────────────────────────────────────────────────────────
    let sections: V3Section[];
    if (!Array.isArray(value.sections) || value.sections.length === 0) {
      sections = [DEFAULT_SECTION];
    } else {
      sections = (value.sections as unknown[]).reduce<V3Section[]>((acc, s, i) => {
        try {
          if (!isRecord(s)) return acc;
          acc.push({
            id: safeString(s.id, `section-${i}`),
            label: safeString(s.label, `Sección ${i + 1}`),
            y: safeNum(s.y, 0),
            height: Math.max(1, safeNum(s.height, 844)),
            background: safeBackground(s.background, "#050506"),
          });
        } catch { /* skip malformed section */ }
        return acc;
      }, []);
      if (sections.length === 0) sections = [DEFAULT_SECTION];
    }

    // ── Elements ──────────────────────────────────────────────────────────────
    const elements: V3Element[] = !Array.isArray(value.elements)
      ? []
      : (value.elements as unknown[]).reduce<V3Element[]>((acc, e, i) => {
          try {
            if (!isRecord(e)) return acc;

            const type = (["text", "shape", "app", "decoration"].includes(e.type as string)
              ? e.type
              : "text") as V3Element["type"];

            // height: null/undefined → sensible fallback per type; otherwise coerce
            let height: number | null;
            if (e.height == null) {
              height = type === "text" || type === "decoration" ? 80 : 40;
            } else if (Number.isFinite(Number(e.height))) {
              height = Number(e.height);
            } else {
              height = 40;
            }

            // appKind / appType — normalize both aliases
            const appKind = (e.appKind || e.appType || undefined) as V3Element["appKind"] | undefined;
            const appType = (e.appType || e.appKind || undefined) as V3Element["appType"] | undefined;

            acc.push({
              ...(e as unknown as V3Element),
              id: safeString(e.id, `element-${i}`),
              type,
              x: safeNum(e.x, 0),
              y: safeNum(e.y, 0),
              width: Math.max(1, safeNum(e.width, 100)),
              height,
              locked: safeBool(e.locked, false),
              visible: safeBool(e.visible, true),
              zIndex: safeNum(e.zIndex, i + 1),
              opacity: Math.min(1, Math.max(0, safeNum(e.opacity, 1))),
              background: safeBackground(e.background, "transparent"),
              color: safeString(e.color, "#ffffff"),
              content: typeof e.content === "string" ? e.content : "",
              appKind,
              appType,
            });
          } catch { /* skip malformed element */ }
          return acc;
        }, []);

    // ── Document height ───────────────────────────────────────────────────────
    // Use the stored height if valid; otherwise derive from content bounds; floor at 844.
    const designH = safeNum(value.height, 0);
    const sectionMaxH = sections.reduce((max, s) => Math.max(max, s.y + s.height), 0);
    const elementMaxH = elements.reduce((max, el) => {
      const elH = el.height != null ? el.height : 40;
      return Math.max(max, el.y + elH);
    }, 0);
    const documentHeight = Math.max(designH, sectionMaxH, elementMaxH, 844);

    return {
      version: 3,
      viewport: "mobile",
      width: 390,
      height: documentHeight,
      themeId: safeString(value.themeId as unknown, "kais-luxury"),
      sections,
      elements,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App block helpers
// ─────────────────────────────────────────────────────────────────────────────

const APP_DEMO: Record<string, { label: string; icon: string }> = {
  rsvp: { label: "Confirmar asistencia", icon: "✓" },
  countdown: { label: "Cuenta regresiva", icon: "⏱" },
  whatsapp: { label: "Enviar WhatsApp", icon: "✉" },
  maps: { label: "Ver ubicación", icon: "⌖" },
  "live-album": { label: "Álbum en vivo", icon: "▧" },
  "live-screen": { label: "Pantalla en vivo", icon: "▣" },
  qr: { label: "QR del evento", icon: "▦" },
  album: { label: "Álbum en vivo", icon: "▧" },
  live: { label: "Pantalla en vivo", icon: "▣" },
};

function resolveAppType(el: V3Element): V3AppType | null {
  const raw = el.appType ?? el.appKind;
  if (!raw) return null;
  if (raw === "album") return "live-album";
  if (raw === "live") return "live-screen";
  const VALID: V3AppType[] = ["rsvp", "whatsapp", "countdown", "maps", "live-album", "live-screen", "qr"];
  return VALID.includes(raw as V3AppType) ? (raw as V3AppType) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single element renderer (no editing chrome)
// ─────────────────────────────────────────────────────────────────────────────

function PublicElement({ el, eventSlug }: { el: V3Element; eventSlug?: string }) {
  if (!el.visible) return null;

  const appType = el.type === "app" ? resolveAppType(el) : null;

  // Sanitise numeric values so bad data can't produce invalid CSS
  const safeNum = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;

  const boxStyle: React.CSSProperties = {
    position: "absolute",
    left: safeNum(el.x, 0),
    top: safeNum(el.y, 0),
    width: Math.max(1, safeNum(el.width, 100)),
    height: el.height != null && Number.isFinite(Number(el.height))
      ? Math.max(1, Number(el.height))
      : "auto",
    zIndex: safeNum(el.zIndex, 0),
    opacity: Math.min(1, Math.max(0, safeNum(el.opacity, 1))),
    borderRadius: el.borderRadius != null ? safeNum(el.borderRadius, 0) : undefined,
    border: computeBorder(el),
    overflow: "hidden",
  };

  // App blocks —— rendered as interactive visual elements
  if (el.type === "app" && appType) {
    const demo = APP_DEMO[appType];

    // WhatsApp → real link
    const href =
      appType === "whatsapp"
        ? el.config?.url || "https://wa.me/"
        : appType === "maps"
        ? el.config?.url || "https://maps.google.com"
        : appType === "live-album" && eventSlug
        ? `/evento/${eventSlug}/fotos`
        : appType === "live-screen" && eventSlug
        ? `/live/${eventSlug}`
        : undefined;

    const inner =
      appType === "countdown" ? (
        <CountdownBlock el={el} />
      ) : appType === "qr" ? (
        <QrBlock el={el} />
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{demo.icon}</span>
          <span
            style={{
              color: el.color ?? "#ffffff",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: appType === "rsvp" ? 15 : 13,
              fontWeight: appType === "rsvp" ? "700" : "600",
              letterSpacing: appType === "rsvp" ? "0.12em" : "0.04em",
            }}
          >
            {el.content || demo.label}
          </span>
        </span>
      );

    const wrapStyle: React.CSSProperties = {
      ...boxStyle,
      background: el.background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: href ? "pointer" : "default",
      textDecoration: "none",
    };

    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" style={wrapStyle}>
          {inner}
        </a>
      );
    }
    return <div style={wrapStyle}>{inner}</div>;
  }

  // Shape / decoration with background but no text content
  if (!el.content && el.background) {
    return (
      <div
        style={{
          ...boxStyle,
          background: el.background,
          backdropFilter: el.blur ? `blur(${el.blur}px)` : undefined,
        }}
      />
    );
  }

  // Text or decoration with content
  if (el.content) {
    return (
      <div style={boxStyle}>
        {el.background && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: el.background,
              borderRadius: el.borderRadius,
              backdropFilter: el.blur ? `blur(${el.blur}px)` : undefined,
            }}
          />
        )}
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
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown app block (live counter)
// ─────────────────────────────────────────────────────────────────────────────

function CountdownBlock({ el }: { el: V3Element }) {
  const [units] = useState({ days: "45", hrs: "12", min: "08", seg: "30" });
  const textColor = el.color ?? "#e8e6ff";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 8,
        width: "88%",
      }}
    >
      {(["days", "hrs", "min", "seg"] as const).map((key, i) => (
        <div key={key} style={{ textAlign: "center" }}>
          <strong style={{ display: "block", color: textColor, fontSize: 18 }}>
            {units[key]}
          </strong>
          <span
            style={{
              color: textColor,
              opacity: 0.72,
              fontSize: 8,
              letterSpacing: "0.08em",
            }}
          >
            {["DÍAS", "HRS", "MIN", "SEG"][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR placeholder
// ─────────────────────────────────────────────────────────────────────────────

function QrBlock({ el }: { el: V3Element }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        height: "100%",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 4,
        }}
      >
        {Array.from({ length: 25 }).map((_, i) => (
          <span
            key={i}
            style={{
              background:
                i % 3 === 0 || i % 7 === 0 ? "#1a0a18" : "transparent",
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <span
        style={{
          color: el.color ?? "#1a0a18",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {el.content ?? "QR del evento"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main public renderer
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SafeElement — silently swallows render errors for a single element
// ─────────────────────────────────────────────────────────────────────────────

class SafeElement extends React.Component<
  { el: V3Element; eventSlug?: string },
  { crashed: boolean }
> {
  constructor(props: { el: V3Element; eventSlug?: string }) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[preview-v3] element render error", err);
  }
  render() {
    if (this.state.crashed) return null;
    return <PublicElement el={this.props.el} eventSlug={this.props.eventSlug} />;
  }
}

export interface CanvasV3PublicRendererProps {
  design: unknown; // acepta raw desde DB; normaliza internamente
  eventTitle?: string;
  eventSlug?: string;
  mode?: "preview" | "public";
}

export function CanvasV3PublicRenderer({
  design: rawProp,
  eventTitle,
  eventSlug,
  mode = "public",
}: CanvasV3PublicRendererProps) {
  // Normalizar siempre internamente — nunca bloqueado desde afuera
  const design: CanvasV3Design = normalizePublicV3Design(rawProp) ?? {
    version: 3,
    viewport: "mobile",
    width: 390,
    height: 844,
    themeId: "kais-luxury",
    sections: [DEFAULT_SECTION],
    elements: [],
  };
  const CANVAS_W = 390;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Scale canvas to fit container width
  useEffect(() => {
    const update = () => {
      try {
        if (!wrapperRef.current) return;
        const containerW = wrapperRef.current.clientWidth;
        if (containerW > 0) setScale(Math.min(1, containerW / CANVAS_W));
      } catch { /* ignore */ }
    };
    update();
    try {
      const ro = new ResizeObserver(update);
      if (wrapperRef.current) ro.observe(wrapperRef.current);
      return () => ro.disconnect();
    } catch {
      return undefined;
    }
  }, []);

  const sortedElements = [...design.elements].sort((a, b) => a.zIndex - b.zIndex);
  const sectionMaxH = design.sections.reduce((max, s) => Math.max(max, s.y + s.height), 0);
  const elementMaxH = design.elements.reduce((max, el) => {
    const elH = el.height != null ? el.height : 40;
    return Math.max(max, el.y + elH);
  }, 0);
  const documentHeight = Math.max(design.height, sectionMaxH, elementMaxH, 844);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Preview badge */}
      {mode === "preview" && (
        <div
          style={{
            width: "100%",
            maxWidth: CANVAS_W * scale,
            marginBottom: 8,
            padding: "6px 12px",
            background: "rgba(124,58,237,0.18)",
            border: "1px solid rgba(124,58,237,0.4)",
            borderRadius: 8,
            color: "#c4b5fd",
            fontSize: 11,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: "600",
            letterSpacing: "0.06em",
            textAlign: "center",
          }}
        >
          VISTA PREVIA · {eventTitle ?? "Canvas V3"}
        </div>
      )}

      {/* Scaled canvas */}
      <div
        style={{
          width: CANVAS_W * scale,
          height: documentHeight * scale,
          position: "relative",
          overflow: "hidden",
          borderRadius: scale < 1 ? 16 : 0,
          boxShadow: scale < 1 ? "0 8px 48px rgba(0,0,0,0.6)" : "none",
        }}
      >
        {/* Section backgrounds */}
        {design.sections.map((section) => (
          <div
            key={section.id}
            style={{
              position: "absolute",
              left: 0,
              top: section.y * scale,
              width: CANVAS_W * scale,
              height: section.height * scale,
              background: section.background,
            }}
          />
        ))}

        {/* Elements (scaled via transform-origin top-left) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: documentHeight,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          {sortedElements.map((el) => (
            <SafeElement key={el.id} el={el} eventSlug={eventSlug} />
          ))}
        </div>
      </div>
    </div>
  );
}
