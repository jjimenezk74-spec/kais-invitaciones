"use client";

import React from "react";
import { useCanvasEditor, type ResizeHandle } from "./canvas-context";
import type { CanvasElement, CanvasSectionId } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// ResizeHandleNode
// ─────────────────────────────────────────────────────────────────────────────

const HANDLE_PX = 9;

const HANDLE_POSITIONS: Record<ResizeHandle, React.CSSProperties> = {
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
        ...HANDLE_POSITIONS[handle],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StageEl — single element in the editor canvas
// ─────────────────────────────────────────────────────────────────────────────

function StageEl({ element, selected }: { element: CanvasElement; selected: boolean }) {
  const { onSelect, onMoveStart, onResizeStart } = useCanvasEditor();

  const wrapStyle: React.CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: element.width,
    height: element.height ?? undefined,
    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    cursor: element.locked ? "default" : selected ? "grab" : "pointer",
    userSelect: "none",
    boxShadow: selected
      ? "0 0 0 2px #6366f1, 0 0 0 4px rgba(99,102,241,0.20)"
      : "none",
    borderRadius: 2,
  };

  return (
    <div
      style={wrapStyle}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMoveStart(e, element.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(element.id);
      }}
    >
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
      {element.type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={element.url}
          alt=""
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: element.height ? "100%" : "auto",
            objectFit: "contain",
            opacity: element.opacity,
            pointerEvents: "none",
          }}
        />
      )}
      {selected &&
        (["tl", "tr", "bl", "br"] as ResizeHandle[]).map((h) => (
          <ResizeHandleNode
            key={h}
            handle={h}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart(e, element.id, h);
            }}
          />
        ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionCanvasLayer — absolute overlay for one logical sectionId
// Rendered inside each section wrapper in InvitationEditorBase.
// pointer-events: none on the layer itself → only elements are interactive.
// ─────────────────────────────────────────────────────────────────────────────

export function SectionCanvasLayer({ sectionId }: { sectionId: CanvasSectionId }) {
  const { elements, selectedId, activeSectionId, onSelect } = useCanvasEditor();

  const visible = elements
    .filter((el) => el.visible && (el.sectionId ?? "hero") === sectionId)
    .sort((a, b) => a.zIndex - b.zIndex);

  // Skip rendering if no elements and not the active section
  if (visible.length === 0 && activeSectionId !== sectionId) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {/* Transparent click-catcher for deselect — only when this is active section */}
      {activeSectionId === sectionId && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "all",
            cursor: "default",
          }}
          onClick={() => onSelect(null)}
        />
      )}

      {/* Canvas elements — pointer-events auto (CSS default, not blocked by parent none) */}
      {visible.map((el) => (
        <StageEl key={el.id} element={el} selected={el.id === selectedId} />
      ))}
    </div>
  );
}
