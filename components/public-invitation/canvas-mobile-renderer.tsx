"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";
import { normalizeCanvasDesign } from "@/lib/canvas/normalize-canvas-design";
import type { CanvasDesign, CanvasElement, CanvasImageElement, CanvasSection, CanvasTextElement, Event } from "@/lib/types";

export type CanvasResizeHandle = "tl" | "t" | "tr" | "r" | "br" | "b" | "bl" | "l";

type CanvasMobileRendererProps = {
  event: Event;
  canvasDesign: CanvasDesign;
  mode: "public" | "editor";
  children?: ReactNode;
  selectedElementId?: string | null;
  onElementMouseDown?: (event: MouseEvent<HTMLElement>, elementId: string) => void;
  onResizeMouseDown?: (event: MouseEvent<HTMLElement>, elementId: string, handle: CanvasResizeHandle) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onBringForward?: (elementId: string) => void;
  onSendBackward?: (elementId: string) => void;
  onToggleLock?: (elementId: string) => void;
  onToggleVisible?: (elementId: string) => void;
};

export function CanvasMobileRenderer({
  event,
  canvasDesign,
  mode,
  children,
  selectedElementId,
  onElementMouseDown,
  onResizeMouseDown,
  onDuplicateElement,
  onDeleteElement,
  onBringForward,
  onSendBackward,
  onToggleLock,
  onToggleVisible,
}: CanvasMobileRendererProps) {
  const design = normalizeCanvasDesign(canvasDesign);
  const shellRef = useRef<HTMLDivElement>(null);
  const [publicScale, setPublicScale] = useState(1);
  const visible = design.elements
    .filter((element) => element.visible && element.device !== "desktop")
    .sort((a, b) => a.zIndex - b.zIndex);
  const backgroundStyle = buildBackgroundStyle(design);
  const scale = mode === "public" ? publicScale : 1;

  useEffect(() => {
    if (mode !== "public") return;

    const updateScale = () => {
      if (!shellRef.current) return;
      const width = shellRef.current.getBoundingClientRect().width;
      setPublicScale(Math.min(1, width / design.width));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [design.width, mode]);

  return (
    <main
      className={[
        "w-full overflow-x-hidden bg-neutral-950",
        mode === "public" ? "min-h-dvh" : "h-full"
      ].join(" ")}
      aria-label={event.title}
    >
      <div
        ref={shellRef}
        className={[
          "mx-auto overflow-hidden",
          mode === "public" ? "min-h-dvh w-full max-w-[390px]" : ""
        ].join(" ")}
        style={{
          width: mode === "editor" ? design.width : undefined,
          height: mode === "editor" ? design.height : design.height * scale,
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: design.width,
            height: design.height,
            transformOrigin: "top center",
            transform: mode === "public" ? `scale(${scale})` : undefined,
            ...backgroundStyle,
          }}
        >
          {design.sections.map((section) => (
            <CanvasSectionBackground key={section.id} section={section} />
          ))}
          {visible.map((element) => (
            <CanvasMobileElement
              key={element.id}
              element={element}
              mode={mode}
              selected={mode === "editor" && element.id === selectedElementId}
              onElementMouseDown={onElementMouseDown}
              onResizeMouseDown={onResizeMouseDown}
              onDuplicateElement={onDuplicateElement}
              onDeleteElement={onDeleteElement}
              onBringForward={onBringForward}
              onSendBackward={onSendBackward}
              onToggleLock={onToggleLock}
              onToggleVisible={onToggleVisible}
            />
          ))}
          {children}
        </div>
      </div>
    </main>
  );
}

function CanvasSectionBackground({ section }: { section: CanvasSection }) {
  return (
    <section
      data-section-id={section.id}
      aria-label={section.label}
      style={{
        position: "absolute",
        left: 0,
        top: section.y,
        width: "100%",
        height: section.height,
        zIndex: 0,
        borderTop: section.id === "hero" ? undefined : "1px solid rgba(255,255,255,0.08)",
        background: getSectionBackground(section.id),
      }}
    />
  );
}

function CanvasMobileElement({
  element,
  mode,
  selected,
  onElementMouseDown,
  onResizeMouseDown,
  onDuplicateElement,
  onDeleteElement,
  onBringForward,
  onSendBackward,
  onToggleLock,
  onToggleVisible,
}: {
  element: CanvasElement;
  mode: "public" | "editor";
  selected: boolean;
  onElementMouseDown?: (event: MouseEvent<HTMLElement>, elementId: string) => void;
  onResizeMouseDown?: (event: MouseEvent<HTMLElement>, elementId: string, handle: CanvasResizeHandle) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onBringForward?: (elementId: string) => void;
  onSendBackward?: (elementId: string) => void;
  onToggleLock?: (elementId: string) => void;
  onToggleVisible?: (elementId: string) => void;
}) {
  const visualStyle = element.style ?? {};
  const elementShadow = visualStyle.boxShadow ?? "";

  // Outer wrapper: handles positioning and the selection ring.
  // Opacity is NOT here — so the outline is always fully visible even on
  // transparent effects (blur-circle opacity 0.35, etc.).
  const wrapperStyle: CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: element.width,
    height: element.height ?? getFallbackElementHeight(element),
    transform: buildTransform(element.rotation),
    transformOrigin: "center center",
    zIndex: element.zIndex,
    pointerEvents: mode === "editor" ? "auto" : "none",
    cursor: mode === "editor" ? (element.locked ? "default" : "move") : "default",
    userSelect: "none",
    borderRadius: visualStyle.borderRadius,
    boxSizing: "border-box",
    overflow: "visible",
    // Selection ring lives here — never faded by inner opacity
    outline: selected ? "2px solid #8b7cff" : undefined,
    outlineOffset: selected ? "1px" : undefined,
    boxShadow: selected
      ? "0 0 0 4px rgba(139,124,255,0.40), 0 0 0 1px rgba(255,255,255,0.55)"
      : undefined,
  };

  // Inner container: all visual effects and opacity.
  // Keeping opacity here means the selection ring above is never affected.
  // willChange + translateZ(0) force GPU compositing so filter:blur() and
  // backgrounds render immediately even inside CSS transform parents.
  const innerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    opacity: typeof visualStyle.opacity === "number" ? visualStyle.opacity : element.opacity,
    borderRadius: visualStyle.borderRadius,
    border: visualStyle.border,
    background: buildElementBackground(element),
    backgroundImage: buildElementBackgroundImage(element),
    filter: buildElementFilter(element),
    backdropFilter: getBackdropFilter(element),
    WebkitBackdropFilter: getBackdropFilter(element),
    mixBlendMode: visualStyle.mixBlendMode as CSSProperties["mixBlendMode"],
    animation: buildAnimationValue(element),
    animationDelay: visualStyle.animationDelay,
    animationDuration: visualStyle.animationDuration,
    boxShadow: elementShadow || undefined,
    boxSizing: "border-box",
    // Force GPU layer so blur/gradient render on first paint (no reload needed)
    willChange: "filter, opacity, background",
    transform: "translateZ(0)",
  };

  const editorProps =
    mode === "editor"
      ? {
          onMouseDown: (event: MouseEvent<HTMLElement>) => onElementMouseDown?.(event, element.id),
        }
      : {};
  const controls =
    selected && mode === "editor" ? (
      <CanvasElementControls
        element={element}
        onResizeMouseDown={onResizeMouseDown}
        onDuplicateElement={onDuplicateElement}
        onDeleteElement={onDeleteElement}
        onBringForward={onBringForward}
        onSendBackward={onSendBackward}
        onToggleLock={onToggleLock}
        onToggleVisible={onToggleVisible}
      />
    ) : null;

  if (element.type === "text") {
    return <CanvasMobileText element={element} mode={mode} wrapperStyle={wrapperStyle} innerStyle={innerStyle} editorProps={editorProps} controls={controls} />;
  }

  if (element.type === "image") {
    return <CanvasMobileImage element={element} wrapperStyle={wrapperStyle} innerStyle={innerStyle} editorProps={editorProps} controls={controls} />;
  }

  return null;
}

function getFallbackElementHeight(element: CanvasElement) {
  if (element.type === "image") return element.height ?? element.width;

  const charsPerLine = Math.max(1, Math.floor(element.width / Math.max(element.fontSize * 0.55, 1)));
  const wrappedLines = element.content
    .split("\n")
    .reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);

  return Math.max(24, wrappedLines * element.fontSize * element.lineHeight);
}

function CanvasMobileText({
  element,
  mode,
  wrapperStyle,
  innerStyle,
  editorProps,
  controls,
}: {
  element: CanvasTextElement;
  mode: "public" | "editor";
  wrapperStyle: CSSProperties;
  innerStyle: CSSProperties;
  editorProps: HTMLAttributes<HTMLDivElement>;
  controls: ReactNode;
}) {
  return (
    <div
      data-element-id={element.id}
      data-section-id={element.sectionId ?? "hero"}
      style={wrapperStyle}
      {...editorProps}
    >
      <div style={innerStyle}>
        <p
        style={{
          width: "100%",
          minHeight: "100%",
          height: "auto",
          display: "block",
          margin: 0,
          padding: 0,
          boxSizing: "border-box",
          fontFamily: element.fontFamily,
          fontSize: element.fontSize,
          fontWeight: element.fontWeight,
          fontStyle: element.fontStyle,
          textAlign: element.textAlign,
          color: element.color,
          lineHeight: element.lineHeight,
          letterSpacing: `${element.letterSpacing}em`,
          textDecoration: element.textDecoration === "underline" ? "underline" : "none",
          textShadow: getStringElementStyleValue(element, "textShadow") ?? element.textShadow ?? undefined,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          wordBreak: "normal",
          lineBreak: "auto",
          overflow: mode === "editor" ? "visible" : "hidden",
        }}
        >
          {element.content}
        </p>
      </div>
      {controls}
    </div>
  );
}

function CanvasMobileImage({
  element,
  wrapperStyle,
  innerStyle,
  editorProps,
  controls,
}: {
  element: CanvasImageElement;
  wrapperStyle: CSSProperties;
  innerStyle: CSSProperties;
  editorProps: HTMLAttributes<HTMLDivElement>;
  controls: ReactNode;
}) {
  return (
    <div
      data-element-id={element.id}
      data-section-id={element.sectionId ?? "hero"}
      style={wrapperStyle}
      {...editorProps}
    >
      <div style={innerStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
        src={element.url}
        alt=""
        draggable={false}
        loading="lazy"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: element.objectFit === "fill" ? "fill" : "contain",
          filter: buildImageFilter(element),
          borderRadius: element.style?.borderRadius,
          transform: element.flipX || element.flipY ? `scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})` : undefined,
          pointerEvents: "none",
        }}
        />
      </div>
      {controls}
    </div>
  );
}

function CanvasElementControls({
  element,
  onResizeMouseDown,
  onDuplicateElement,
  onDeleteElement,
  onBringForward,
  onSendBackward,
  onToggleLock,
  onToggleVisible,
}: {
  element: CanvasElement;
  onResizeMouseDown?: (event: MouseEvent<HTMLElement>, elementId: string, handle: CanvasResizeHandle) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onBringForward?: (elementId: string) => void;
  onSendBackward?: (elementId: string) => void;
  onToggleLock?: (elementId: string) => void;
  onToggleVisible?: (elementId: string) => void;
}) {
  return (
    <>
      <div
        data-canvas-control="true"
        style={{
          position: "absolute",
          left: "50%",
          top: -48,
          transform: "translateX(-50%)",
          zIndex: 10000,
          display: "flex",
          gap: 4,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(17,24,39,0.96)",
          padding: 4,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          pointerEvents: "auto",
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <CanvasToolbarButton label="Duplicar" onClick={() => onDuplicateElement?.(element.id)}>D</CanvasToolbarButton>
        <CanvasToolbarButton label="Traer adelante" onClick={() => onBringForward?.(element.id)}>+</CanvasToolbarButton>
        <CanvasToolbarButton label="Enviar atras" onClick={() => onSendBackward?.(element.id)}>-</CanvasToolbarButton>
        <CanvasToolbarButton label={element.locked ? "Desbloquear" : "Bloquear"} onClick={() => onToggleLock?.(element.id)}>
          {element.locked ? "U" : "L"}
        </CanvasToolbarButton>
        <CanvasToolbarButton label="Ocultar" onClick={() => onToggleVisible?.(element.id)}>O</CanvasToolbarButton>
        <CanvasToolbarButton label="Eliminar" onClick={() => onDeleteElement?.(element.id)}>X</CanvasToolbarButton>
      </div>
      {(["tl", "t", "tr", "r", "br", "b", "bl", "l"] as CanvasResizeHandle[]).map((handle) => (
        <CanvasResizeHandleNode
          key={handle}
          handle={handle}
          onMouseDown={(event) => onResizeMouseDown?.(event, element.id, handle)}
        />
      ))}
    </>
  );
}

function CanvasToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: "grid",
        placeItems: "center",
        border: 0,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        color: "#f8fafc",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const HANDLE_PX = 9;
const HANDLE_STYLE: Record<CanvasResizeHandle, CSSProperties> = {
  tl: { top: -HANDLE_PX / 2, left: -HANDLE_PX / 2, cursor: "nwse-resize" },
  t: { top: -HANDLE_PX / 2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
  tr: { top: -HANDLE_PX / 2, right: -HANDLE_PX / 2, cursor: "nesw-resize" },
  r: { top: "50%", right: -HANDLE_PX / 2, transform: "translateY(-50%)", cursor: "ew-resize" },
  br: { bottom: -HANDLE_PX / 2, right: -HANDLE_PX / 2, cursor: "nwse-resize" },
  b: { bottom: -HANDLE_PX / 2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
  bl: { bottom: -HANDLE_PX / 2, left: -HANDLE_PX / 2, cursor: "nesw-resize" },
  l: { top: "50%", left: -HANDLE_PX / 2, transform: "translateY(-50%)", cursor: "ew-resize" },
};

function CanvasResizeHandleNode({
  handle,
  onMouseDown,
}: {
  handle: CanvasResizeHandle;
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      data-canvas-control="true"
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        width: HANDLE_PX,
        height: HANDLE_PX,
        zIndex: 9999,
        border: "1.5px solid #fff",
        borderRadius: 2,
        background: "#7c6cff",
        pointerEvents: "auto",
        ...HANDLE_STYLE[handle],
      }}
    />
  );
}

function buildBackgroundStyle(design: CanvasDesign): CSSProperties {
  const background = design.background;

  if (background.type === "color") {
    return { backgroundColor: background.color ?? "#0a0a0a" };
  }

  if (background.type === "gradient") {
    return { backgroundImage: background.gradient ?? "linear-gradient(180deg, #111, #050505)" };
  }

  if (background.type === "image" && background.imageUrl) {
    return {
      backgroundImage: `url(${background.imageUrl})`,
      backgroundSize: background.imageObjectFit === "contain" ? "contain" : "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#0a0a0a",
    };
  }

  return { backgroundColor: "#0a0a0a" };
}

function getSectionBackground(sectionId: string) {
  if (sectionId === "hero") return "transparent";
  if (sectionId === "rsvp") return "linear-gradient(180deg, rgba(8,4,6,0.96), rgba(24,8,12,0.98))";
  if (sectionId === "footer") return "linear-gradient(180deg, rgba(12,6,8,0.98), rgba(4,3,4,1))";
  return "linear-gradient(180deg, rgba(14,8,10,0.96), rgba(22,10,14,0.96))";
}

function getElementStyleValue(element: CanvasElement, key: string) {
  const style = (element as unknown as { style?: Record<string, unknown> }).style;
  const value = style?.[key];
  if (key === "borderRadius" && typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" && key !== "borderRadius") return value;
  return undefined;
}

function getStringElementStyleValue(element: CanvasElement, key: string) {
  const value = getElementStyleValue(element, key);
  return typeof value === "string" ? value : undefined;
}

function getBackdropFilter(element: CanvasElement) {
  const style = element.style;
  const filters = [
    style?.backdropFilter,
    typeof style?.backdropBlur === "number" ? `blur(${style.backdropBlur}px)` : undefined,
  ].filter(Boolean);

  return filters.length > 0 ? filters.join(" ") : undefined;
}

function buildTransform(rotation: number): string {
  const rotate = rotation !== 0 ? ` rotate(${rotation}deg)` : "";
  return `translate(-50%, -50%)${rotate}`;
}

function buildElementBackground(element: CanvasElement) {
  const style = element.style;
  return style?.gradient ?? style?.background;
}

function buildElementBackgroundImage(element: CanvasElement) {
  const style = element.style;
  return style?.backgroundImage;
}

function buildElementFilter(element: CanvasElement) {
  const style = element.style;
  const filters = [
    style?.filter,
    typeof style?.blur === "number" ? `blur(${style.blur}px)` : undefined,
  ].filter(Boolean);

  return filters.length > 0 ? filters.join(" ") : undefined;
}

function buildAnimationValue(element: CanvasElement) {
  const style = element.style;
  if (!style?.animation || style.animation === "none") return undefined;

  const duration = style.animationDuration ?? "900ms";
  const preset = CANVAS_ANIMATION_PRESETS[style.animation];
  if (!preset) return style.animation;

  const loop = ["float-soft", "pulse-glow", "shimmer", "parallax-soft"].includes(style.animation) ? " infinite" : "";
  return `${preset} ${duration} ease${loop} both`;
}

const CANVAS_ANIMATION_PRESETS: Record<string, string> = {
  "fade-up": "kais-canvas-fade-up",
  "fade-in": "kais-canvas-fade-in",
  "zoom-in": "kais-canvas-zoom-in",
  "float-soft": "kais-canvas-float-soft",
  "pulse-glow": "kais-canvas-pulse-glow",
  shimmer: "kais-canvas-shimmer",
  "parallax-soft": "kais-canvas-parallax-soft",
};

function buildImageFilter(element: CanvasImageElement): string {
  if (element.effect === "glow") {
    const blur = element.glowStrength === "high" ? 26 : element.glowStrength === "low" ? 8 : 16;
    return `drop-shadow(0 0 ${blur}px ${element.glowColor})`;
  }

  if (element.effect === "soft_shadow") {
    return "drop-shadow(0 14px 22px rgba(0, 0, 0, 0.28))";
  }

  return "none";
}
