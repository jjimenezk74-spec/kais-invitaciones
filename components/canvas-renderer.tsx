import type { CSSProperties } from "react";
import type {
  CanvasDesign,
  CanvasElement,
  CanvasTextElement,
  CanvasImageElement,
  CanvasSectionId,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// CanvasRenderer
//
// Renderiza un CanvasDesign sobre la invitación pública.
// - pointer-events: none → nunca bloquea botones ni inputs del usuario.
// - position: fixed; inset: 0 → cubre el viewport; los % se calculan
//   sobre el viewport, que coincide con refWidth/refHeight en móvil.
// - Solo renderiza si canvas_design !== null.
// - No requiere dependencias extra.
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  design: CanvasDesign;
  /** Filtro de sección. Default "hero" para compatibilidad con diseños anteriores. */
  sectionId?: CanvasSectionId;
};

export function CanvasRenderer({ design, sectionId = "hero" }: Props) {
  const visible = design.elements
    .filter((el) => el.visible && (el.sectionId ?? "hero") === sectionId)
    .sort((a, b) => a.zIndex - b.zIndex);

  if (visible.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 40,
        overflow: "hidden",
      }}
    >
      {visible.map((el) => (
        <CanvasElementNode key={el.id} element={el} design={design} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CanvasElementNode — despacha al renderer correcto según type
// ─────────────────────────────────────────────────────────────────────────────

function CanvasElementNode({
  element,
  design,
}: {
  element: CanvasElement;
  design: CanvasDesign;
}) {
  const deviceClass = getDeviceClass(element.device);

  const baseStyle: CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: scaleWidth(element.width, design.refWidth),
    height: element.height ? scaleWidth(element.height, design.refWidth) : undefined,
    opacity: element.opacity,
    transform: buildTransform(element.rotation),
    zIndex: element.zIndex,
  };

  if (element.type === "text") {
    return (
      <TextNode
        element={element}
        baseStyle={baseStyle}
        deviceClass={deviceClass}
        design={design}
      />
    );
  }

  if (element.type === "image") {
    return (
      <ImageNode
        element={element}
        baseStyle={baseStyle}
        deviceClass={deviceClass}
      />
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TextNode
// ─────────────────────────────────────────────────────────────────────────────

function TextNode({
  element,
  baseStyle,
  deviceClass,
  design,
}: {
  element: CanvasTextElement;
  baseStyle: CSSProperties;
  deviceClass: string;
  design: CanvasDesign;
}) {
  const textStyle: CSSProperties = {
    ...baseStyle,
    fontFamily: element.fontFamily,
    fontSize: scaleFontSize(element.fontSize, design.refWidth),
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    textAlign: element.textAlign,
    color: element.color,
    lineHeight: element.lineHeight,
    letterSpacing: `${element.letterSpacing}em`,
    textDecoration: element.textDecoration === "underline" ? "underline" : "none",
    textShadow: element.textShadow ?? undefined,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    userSelect: "none",
  };

  return (
    <p className={deviceClass} style={textStyle}>
      {element.content}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageNode
// ─────────────────────────────────────────────────────────────────────────────

function ImageNode({
  element,
  baseStyle,
  deviceClass,
}: {
  element: CanvasImageElement;
  baseStyle: CSSProperties;
  deviceClass: string;
}) {
  const wrapStyle: CSSProperties = {
    ...baseStyle,
    filter: buildImageFilter(element),
    transform: `${buildTransform(element.rotation)}${element.flipX || element.flipY ? ` scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})` : ""}`,
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={element.url}
      alt=""
      draggable={false}
      loading="lazy"
      className={deviceClass}
      style={{
        ...wrapStyle,
        objectFit: element.objectFit === "fill" ? "fill" : "contain",
        display: "block",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escala un ancho en px (referenciado al canvas de refWidth) a vw,
 * de modo que sea responsive en cualquier pantalla.
 * Ej: width=320 en refWidth=390 → "82.05vw" (pero capped con clamp).
 */
function scaleWidth(px: number, refWidth: number): string {
  const vw = (px / refWidth) * 100;
  return `${vw.toFixed(2)}vw`;
}

/**
 * Escala el fontSize de px (en canvas de referencia) a vw con clamp
 * para que se vea bien tanto en móvil como en desktop.
 */
function scaleFontSize(px: number, refWidth: number): string {
  const vw = (px / refWidth) * 100;
  // Mín: 60% del tamaño original, Máx: 2.5x para pantallas grandes
  const min = Math.round(px * 0.55);
  const max = Math.round(px * 2.2);
  return `clamp(${min}px, ${vw.toFixed(2)}vw, ${max}px)`;
}

/** transform CSS para centrar el elemento (anclado al centro) y rotar. */
function buildTransform(rotation: number): string {
  const rotate = rotation !== 0 ? ` rotate(${rotation}deg)` : "";
  return `translate(-50%, -50%)${rotate}`;
}

/** Devuelve clases de visibilidad por dispositivo (Tailwind). */
function getDeviceClass(device: CanvasElement["device"]): string {
  if (device === "mobile") return "md:hidden";
  if (device === "desktop") return "hidden md:block";
  return ""; // "all"
}

/** Construye el CSS filter para efectos de imagen. */
function buildImageFilter(el: CanvasImageElement): string {
  if (el.effect === "glow") {
    const blur = el.glowStrength === "high" ? 26 : el.glowStrength === "low" ? 8 : 16;
    return `drop-shadow(0 0 ${blur}px ${el.glowColor})`;
  }
  if (el.effect === "soft_shadow") {
    return "drop-shadow(0 14px 22px rgba(0, 0, 0, 0.28))";
  }
  return "none";
}
