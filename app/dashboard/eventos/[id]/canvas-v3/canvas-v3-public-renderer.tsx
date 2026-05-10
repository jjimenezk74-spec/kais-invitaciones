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
  verticalAlign?: "top" | "center" | "bottom";
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
  config?: {
    url?: string;
    primaryColor?: string;
    color?: string;
    accentColor?: string;
    effect?: "soft-card" | "glow-circle" | "rose-soft" | "spark" | "soft-glow" | "editorial-line" | "dots" | "ambient-glow" | "cinematic-haze" | "gold-contamination" | "blue-ambient-light" | "editorial-fog";
    textColor?: string;
    countdownTarget?: string;
    countdownMode?: "event" | "custom";
  };
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

function buildDecorationBackground(el: Pick<V3Element, "background" | "config">): string | undefined {
  const effect = el.config?.effect;
  if (!effect) return el.background;
  const color = el.config?.color ?? el.config?.primaryColor ?? "#b8925a";
  const accent = el.config?.accentColor ?? "#fffaf2";
  const c90 = colorWithAlpha(color, 0.90, "rgba(184,146,90,0.90)");
  const c66 = colorWithAlpha(color, 0.66, "rgba(184,146,90,0.66)");
  const c50 = colorWithAlpha(color, 0.50, "rgba(184,146,90,0.50)");
  const c44 = colorWithAlpha(color, 0.44, "rgba(184,146,90,0.44)");
  const c32 = colorWithAlpha(color, 0.32, "rgba(184,146,90,0.32)");
  const c22 = colorWithAlpha(color, 0.22, "rgba(184,146,90,0.22)");
  const c18 = colorWithAlpha(color, 0.18, "rgba(184,146,90,0.18)");
  const c14 = colorWithAlpha(color, 0.14, "rgba(184,146,90,0.14)");
  const c10 = colorWithAlpha(color, 0.10, "rgba(184,146,90,0.10)");
  const c06 = colorWithAlpha(color, 0.06, "rgba(184,146,90,0.06)");
  const c04 = colorWithAlpha(color, 0.04, "rgba(184,146,90,0.04)");
  const a72 = colorWithAlpha(accent, 0.72, "rgba(255,252,247,0.72)");
  const a34 = colorWithAlpha(accent, 0.34, "rgba(37,99,235,0.34)");
  const a22 = colorWithAlpha(accent, 0.22, "rgba(37,99,235,0.22)");
  const a16 = colorWithAlpha(accent, 0.16, "rgba(37,99,235,0.16)");
  const a10 = colorWithAlpha(accent, 0.10, "rgba(37,99,235,0.10)");
  const a06 = colorWithAlpha(accent, 0.06, "rgba(37,99,235,0.06)");

  if (effect === "soft-card") return `radial-gradient(120% 90% at 18% 0%,${a72},transparent 58%),radial-gradient(120% 80% at 92% 100%,${c14},transparent 68%),linear-gradient(145deg,rgba(255,252,247,0.42),${c06})`;
  if (effect === "glow-circle") return `radial-gradient(circle at 34% 28%,${a72} 0%,${c32} 28%,transparent 58%),radial-gradient(circle at 58% 62%,${c18} 0%,transparent 72%),radial-gradient(circle at 50% 50%,${c10} 0%,transparent 100%)`;
  if (effect === "rose-soft") return `radial-gradient(circle at 50% 48%,${a72} 0 7%,transparent 9%),conic-gradient(from 18deg,${c06},${c44},${c10},${c32},${c06}),radial-gradient(circle at 44% 38%,${c22},transparent 58%),radial-gradient(circle at 58% 64%,${c18},transparent 70%)`;
  if (effect === "spark") return `linear-gradient(90deg,transparent 45%,${a72} 49%,${a72} 51%,transparent 55%),linear-gradient(0deg,transparent 45%,${c66} 49%,${c66} 51%,transparent 55%),radial-gradient(circle,${c50} 0%,${c18} 26%,transparent 72%)`;
  if (effect === "soft-glow") return `radial-gradient(ellipse at 48% 48%,${c22} 0%,${c14} 34%,transparent 72%),radial-gradient(ellipse at 28% 30%,${a72} 0%,transparent 42%),radial-gradient(ellipse at 72% 70%,${c10} 0%,transparent 62%)`;
  if (effect === "editorial-line") return `linear-gradient(90deg,transparent 0%,${c18} 18%,${c66} 50%,${c18} 82%,transparent 100%),linear-gradient(180deg,transparent 0 36%,${a72} 44%,${c90} 50%,${a72} 56%,transparent 64% 100%)`;
  if (effect === "dots") return `radial-gradient(circle at 14% 50%,${c44} 0 4px,transparent 6px),radial-gradient(circle at 38% 50%,${c66} 0 5px,transparent 7px),radial-gradient(circle at 62% 50%,${c66} 0 5px,transparent 7px),radial-gradient(circle at 86% 50%,${c44} 0 4px,transparent 6px),radial-gradient(ellipse at 50% 50%,${c10},transparent 72%)`;
  if (effect === "ambient-glow") return `radial-gradient(ellipse at 34% 30%,${c22} 0%,${c10} 34%,transparent 70%),radial-gradient(ellipse at 70% 66%,${a22} 0%,${a10} 38%,transparent 76%),radial-gradient(ellipse at 50% 50%,${c06} 0%,transparent 86%)`;
  if (effect === "cinematic-haze") return `radial-gradient(120% 64% at 50% 0%,${c14} 0%,transparent 64%),radial-gradient(110% 58% at 50% 100%,${a10} 0%,transparent 68%),linear-gradient(180deg,${c04},transparent 42%,${a06})`;
  if (effect === "gold-contamination") return `radial-gradient(ellipse at 28% 22%,${c32} 0%,${c14} 32%,transparent 68%),radial-gradient(ellipse at 76% 76%,${c18} 0%,transparent 72%),radial-gradient(ellipse at 52% 52%,${a06} 0%,transparent 86%)`;
  if (effect === "blue-ambient-light") return `radial-gradient(ellipse at 42% 38%,${a34} 0%,${a16} 34%,transparent 72%),radial-gradient(ellipse at 68% 70%,${c10} 0%,transparent 78%),radial-gradient(ellipse at 18% 84%,${a06} 0%,transparent 72%)`;
  if (effect === "editorial-fog") return `radial-gradient(140% 76% at 18% 24%,${a10} 0%,transparent 60%),radial-gradient(120% 66% at 88% 72%,${c10} 0%,transparent 68%),linear-gradient(115deg,transparent 0%,${c06} 42%,${a06} 58%,transparent 100%)`;
  return el.background;
}

function getDecorationBlendMode(effect?: NonNullable<V3Element["config"]>["effect"]): React.CSSProperties["mixBlendMode"] | undefined {
  if (!effect) return undefined;
  if (effect === "soft-card" || effect === "cinematic-haze" || effect === "editorial-fog") return "soft-light";
  return "screen";
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
  whatsapp: { label: "Enviar WhatsApp", icon: "💬" },
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

function PublicElement({
  el,
  eventSlug,
  eventDate,
  clipTop = 0,
  clipBottom = 0,
}: {
  el: V3Element;
  eventSlug?: string;
  eventDate?: string;
  /** px the element overflows above its section top — clip that much from the top */
  clipTop?: number;
  /** px the element overflows below its section bottom — clip that much from the bottom */
  clipBottom?: number;
}) {
  // Hover state for interactive app blocks (WhatsApp lift effect)
  const [hovered, setHovered] = useState(false);

  if (!el.visible) return null;

  const appType = el.type === "app" ? resolveAppType(el) : null;
  const isWhatsapp = appType === "whatsapp";

  // Sanitise numeric values so bad data can't produce invalid CSS
  const safeNum = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;

  const hasClip = clipTop > 0 || clipBottom > 0;
  const textVerticalPadding = getTextVerticalPadding(el);
  const effectiveLineHeight = Math.max(el.lineHeight ?? 1.4, isScriptFont(el.fontFamily) ? 1.24 : 1.1);
  const visualBackground = buildDecorationBackground(el);

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
    // Section clip — same logic as the editor's inner content wrapper
    clipPath: hasClip ? `inset(${clipTop}px 0px ${clipBottom}px 0px)` : undefined,
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
        <CountdownBlock el={el} eventDate={eventDate} />
      ) : appType === "qr" ? (
        <QrBlock el={el} />
      ) : isWhatsapp ? (
        /* ── WhatsApp premium render ──────────────────────────────────────────── */
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "0 24px", width: "100%", justifyContent: "center", boxSizing: "border-box" }}>
          <span style={{
            fontSize: 24,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 5px rgba(0,0,0,0.28))",
            flexShrink: 0,
          }}>💬</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              color: el.color ?? "#e8f5ee",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 15,
              fontWeight: "600",
              letterSpacing: "0.03em",
              lineHeight: 1.2,
            }}>{el.content || "Enviar WhatsApp"}</span>
            <span style={{
              color: el.color ?? "#e8f5ee",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: "400",
              opacity: 0.55,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>Abrir en WhatsApp →</span>
          </div>
        </div>
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

    // Premium shadow — subtle lift for linked app blocks; WhatsApp gets hover-lift
    const wrapBoxShadow = isWhatsapp && hovered
      ? "0 8px 28px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)"
      : href
      ? "0 4px 18px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)"
      : undefined;

    const wrapStyle: React.CSSProperties = {
      ...boxStyle,
      background: el.background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: href ? "pointer" : "default",
      textDecoration: "none",
      boxShadow: wrapBoxShadow,
      transition: isWhatsapp ? "transform 0.18s ease, box-shadow 0.18s ease" : undefined,
      transform: (isWhatsapp && hovered) ? "translateY(-1.5px)" : undefined,
    };

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={wrapStyle}
          onMouseEnter={isWhatsapp ? () => setHovered(true) : undefined}
          onMouseLeave={isWhatsapp ? () => setHovered(false) : undefined}
        >
          {inner}
        </a>
      );
    }
    return <div style={wrapStyle}>{inner}</div>;
  }

  // Shape / decoration with background but no text content
  if (!el.content && visualBackground) {
    return (
      <div
        style={{
          ...boxStyle,
          background: visualBackground,
          mixBlendMode: getDecorationBlendMode(el.config?.effect),
          backdropFilter: el.blur ? `blur(${el.blur}px)` : undefined,
        }}
      />
    );
  }

  // Text or decoration with content
  if (el.content) {
    return (
      <div style={boxStyle}>
        {visualBackground && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: visualBackground,
              borderRadius: el.borderRadius,
              mixBlendMode: getDecorationBlendMode(el.config?.effect),
              backdropFilter: el.blur ? `blur(${el.blur}px)` : undefined,
            }}
          />
        )}
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
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown app block (live counter)
// ─────────────────────────────────────────────────────────────────────────────

const CD_PLACEHOLDER = { days: "45", hrs: "12", min: "08", seg: "30" };

function resolveCountdownTarget(el: V3Element, eventDate?: string): Date | null {
  const mode = el.config?.countdownMode ?? "event";
  if (mode === "custom") {
    const raw = el.config?.countdownTarget ?? "";
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (eventDate) {
    const d = new Date(eventDate);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function calcCountdownUnits(target: Date): typeof CD_PLACEHOLDER {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: "00", hrs: "00", min: "00", seg: "00" };
  const s = Math.floor(diff / 1000);
  return {
    days: String(Math.floor(s / 86400)).padStart(2, "0"),
    hrs: String(Math.floor((s % 86400) / 3600)).padStart(2, "0"),
    min: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    seg: String(s % 60).padStart(2, "0"),
  };
}

function CountdownBlock({ el, eventDate }: { el: V3Element; eventDate?: string }) {
  const [units, setUnits] = useState<typeof CD_PLACEHOLDER>(CD_PLACEHOLDER);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const target = resolveCountdownTarget(el, eventDate);
    if (!target) return;
    setUnits(calcCountdownUnits(target));
    const id = setInterval(() => setUnits(calcCountdownUnits(target)), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.config?.countdownMode, el.config?.countdownTarget, eventDate]);
  const display = mounted ? units : CD_PLACEHOLDER;
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
            {display[key]}
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

type SafeElementProps = {
  el: V3Element;
  eventSlug?: string;
  eventDate?: string;
  clipTop?: number;
  clipBottom?: number;
};

class SafeElement extends React.Component<SafeElementProps, { crashed: boolean }> {
  constructor(props: SafeElementProps) {
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
    return (
      <PublicElement
        el={this.props.el}
        eventSlug={this.props.eventSlug}
        eventDate={this.props.eventDate}
        clipTop={this.props.clipTop}
        clipBottom={this.props.clipBottom}
      />
    );
  }
}

export interface CanvasV3PublicRendererProps {
  design: unknown; // acepta raw desde DB; normaliza internamente
  eventTitle?: string;
  eventSlug?: string;
  eventDate?: string; // "YYYY-MM-DDTHH:mm:ss"
  mode?: "preview" | "public";
}

export function CanvasV3PublicRenderer({
  design: rawProp,
  eventTitle,
  eventSlug,
  eventDate,
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
        if (containerW > 0) {
          const fitScale = containerW / CANVAS_W;
          const isMobileWidth = window.innerWidth <= 640;
          setScale(isMobileWidth ? fitScale : Math.min(1, fitScale));
        }
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
  const pageBackground = design.sections[0]?.background || "#fff8f0";

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        minHeight: documentHeight * scale,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: pageBackground,
        overflowX: "hidden",
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
            background: "rgba(255,252,247,0.72)",
            border: "1px solid rgba(184,146,90,0.26)",
            borderRadius: 8,
            color: "#8a4f63",
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
          borderRadius: 0,
          boxShadow: "none",
          background: pageBackground,
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
          {sortedElements.map((el) => {
            const elH = el.height ?? 60;
            const sec =
              design.sections.find((s) => el.y >= s.y && el.y < s.y + s.height) ??
              (el.y < (design.sections[0]?.y ?? 0)
                ? design.sections[0]
                : design.sections[design.sections.length - 1]);
            const clipTop = sec ? Math.max(0, sec.y - el.y) : 0;
            const clipBottom = sec ? Math.max(0, el.y + elH - (sec.y + sec.height)) : 0;
            return (
              <SafeElement
                key={el.id}
                el={el}
                eventSlug={eventSlug}
                eventDate={eventDate}
                clipTop={clipTop}
                clipBottom={clipBottom}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
