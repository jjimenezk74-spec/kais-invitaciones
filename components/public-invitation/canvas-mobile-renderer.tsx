"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { normalizeCanvasDesign } from "@/lib/canvas/normalize-canvas-design";
import type { CanvasDesign, CanvasElement, CanvasImageElement, CanvasSection, CanvasTextElement, Event } from "@/lib/types";

type CanvasMobileRendererProps = {
  event: Event;
  canvasDesign: CanvasDesign;
  mode: "public" | "editor";
  children?: ReactNode;
};

export function CanvasMobileRenderer({
  event,
  canvasDesign,
  mode,
  children,
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
            <CanvasMobileElement key={element.id} element={element} />
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

function CanvasMobileElement({ element }: { element: CanvasElement }) {
  const baseStyle: CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: element.width,
    height: element.height ?? undefined,
    opacity: getElementStyleValue(element, "opacity") ?? element.opacity,
    transform: buildTransform(element.rotation),
    zIndex: element.zIndex,
    pointerEvents: "none",
    userSelect: "none",
    borderRadius: getElementStyleValue(element, "borderRadius"),
    background: getElementStyleValue(element, "background"),
    backdropFilter: getBackdropFilter(element),
    animation: getElementStyleValue(element, "animation"),
  };

  if (element.type === "text") {
    return <CanvasMobileText element={element} style={baseStyle} />;
  }

  if (element.type === "image") {
    return <CanvasMobileImage element={element} style={baseStyle} />;
  }

  return null;
}

function CanvasMobileText({
  element,
  style,
}: {
  element: CanvasTextElement;
  style: CSSProperties;
}) {
  return (
    <p
      data-element-id={element.id}
      data-section-id={element.sectionId ?? "hero"}
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
        textDecoration: element.textDecoration === "underline" ? "underline" : "none",
        textShadow: getStringElementStyleValue(element, "textShadow") ?? element.textShadow ?? undefined,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {element.content}
    </p>
  );
}

function CanvasMobileImage({
  element,
  style,
}: {
  element: CanvasImageElement;
  style: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-element-id={element.id}
      data-section-id={element.sectionId ?? "hero"}
      src={element.url}
      alt=""
      draggable={false}
      loading="lazy"
      style={{
        ...style,
        display: "block",
        objectFit: element.objectFit === "fill" ? "fill" : "contain",
        filter: buildImageFilter(element),
        transform: `${buildTransform(element.rotation)}${element.flipX || element.flipY ? ` scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})` : ""}`,
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
  const style = (element as unknown as { style?: { backdropBlur?: unknown } }).style;
  return typeof style?.backdropBlur === "number" ? `blur(${style.backdropBlur}px)` : undefined;
}

function buildTransform(rotation: number): string {
  const rotate = rotation !== 0 ? ` rotate(${rotation}deg)` : "";
  return `translate(-50%, -50%)${rotate}`;
}

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
