import type { CSSProperties } from "react";

export type ElementMirrorState = {
  flipX?: boolean;
  flipY?: boolean;
};

export function getElementMirrorTransform(flipX?: boolean, flipY?: boolean): string | undefined {
  if (!flipX && !flipY) return undefined;
  const scaleX = flipX ? -1 : 1;
  const scaleY = flipY ? -1 : 1;
  return `scale(${scaleX}, ${scaleY})`;
}

export function withElementMirror(
  flipX: boolean | undefined,
  flipY: boolean | undefined,
  base: CSSProperties = {},
): CSSProperties {
  const mirror = getElementMirrorTransform(flipX, flipY);
  if (!mirror) return base;

  return {
    ...base,
    transform: base.transform ? `${base.transform} ${mirror}` : mirror,
    transformOrigin: base.transformOrigin ?? "center center",
  };
}
