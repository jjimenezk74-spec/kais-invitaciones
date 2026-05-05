"use client";

import { createContext, useContext } from "react";
import type { CanvasElement, CanvasSectionId } from "@/lib/types";

// Re-exported so section-canvas-layer and editor-client share the same type
export type ResizeHandle = "tl" | "tr" | "bl" | "br";

export type CanvasEditorCtx = {
  elements: CanvasElement[];
  selectedId: string | null;
  activeSectionId: CanvasSectionId;
  onSelect: (id: string | null) => void;
  onMoveStart: (e: React.MouseEvent, elementId: string) => void;
  onResizeStart: (e: React.MouseEvent, elementId: string, handle: ResizeHandle) => void;
};

export const CanvasEditorContext = createContext<CanvasEditorCtx | null>(null);

export function useCanvasEditor(): CanvasEditorCtx {
  const ctx = useContext(CanvasEditorContext);
  if (!ctx) throw new Error("useCanvasEditor: must be inside CanvasEditorContext.Provider");
  return ctx;
}
