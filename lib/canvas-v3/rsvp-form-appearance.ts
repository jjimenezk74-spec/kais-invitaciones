import type { CSSProperties } from "react";
import {
  getCanvasV3Theme,
  type CanvasV3Theme,
} from "@/app/dashboard/eventos/[id]/canvas-v3/themes-v3";

export type RsvpFormElementOverrides = {
  content?: string;
  background?: string;
  color?: string;
  border?: string;
  borderRadius?: number | null;
  config?: {
    primaryColor?: string;
    textColor?: string;
  };
};

export type RsvpFormAppearance = {
  card: CSSProperties;
  label: CSSProperties;
  field: CSSProperties;
  button: CSSProperties;
  note: CSSProperties;
  accent: string;
  text: string;
  muted: string;
  submitLabel: string;
  fontBody: string;
};

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace("#", "");
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

function relativeLuminance(value: string): number | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function isLightTheme(theme: CanvasV3Theme): boolean {
  const textLuminance = relativeLuminance(theme.colors.text);
  if (textLuminance != null) return textLuminance < 0.45;
  const backgroundLuminance = relativeLuminance(theme.colors.background);
  return backgroundLuminance != null ? backgroundLuminance > 0.55 : false;
}

function clampRadius(value: number | null | undefined, fallback: number, max = 28) {
  const next = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return Math.min(Math.max(next, 8), max);
}

export function buildRsvpFormAppearance(
  themeId: string | null | undefined,
  element: RsvpFormElementOverrides = {},
): RsvpFormAppearance {
  const theme = getCanvasV3Theme(themeId);
  const light = isLightTheme(theme);
  const accent = element.config?.primaryColor ?? theme.colors.accent;
  const text = element.config?.textColor ?? element.color ?? theme.colors.text;
  const cardRadius = clampRadius(element.borderRadius, theme.decorationStyle.borderRadius ?? 22);
  const fieldRadius = clampRadius(element.borderRadius, theme.buttonStyle.borderRadius ?? 14, 22);
  const buttonRadius = clampRadius(element.borderRadius, theme.buttonStyle.borderRadius ?? 16, 24);

  const cardBackground = light
    ? `linear-gradient(145deg, rgba(255,255,255,0.94) 0%, ${theme.colors.surface} 100%)`
    : `linear-gradient(145deg, ${theme.colors.surface}f2 0%, ${theme.colors.background}f0 100%)`;

  const cardBorder = element.border
    ?? theme.decorationStyle.border
    ?? `1px solid ${accent}33`;

  const fieldBackground = light
    ? "rgba(255,255,255,0.88)"
    : "rgba(255,255,255,0.05)";

  const fieldBorder = light
    ? `1px solid ${accent}2b`
    : `1px solid ${accent}40`;

  const buttonBackground = element.background ?? theme.buttonStyle.background;
  const buttonColor = element.color ?? theme.buttonStyle.color;

  return {
    accent,
    text,
    muted: theme.colors.muted,
    submitLabel: element.content?.trim() || "Enviar confirmacion",
    fontBody: theme.fonts.body,
    card: {
      background: cardBackground,
      border: cardBorder,
      borderRadius: cardRadius,
      boxShadow: light
        ? "0 18px 48px rgba(20,18,16,0.08), inset 0 1px 0 rgba(255,255,255,0.72)"
        : "0 24px 64px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
      color: text,
    },
    label: {
      display: "block",
      marginBottom: 6,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      color: `${accent}d9`,
      fontFamily: theme.fonts.body,
    },
    field: {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: fieldRadius,
      border: fieldBorder,
      background: fieldBackground,
      color: text,
      padding: "14px 16px",
      minHeight: 48,
      fontSize: 14,
      lineHeight: 1.45,
      fontFamily: theme.fonts.body,
      outline: "none",
      transition: "border-color 160ms ease, box-shadow 160ms ease",
      boxShadow: light ? "0 4px 18px rgba(15,23,42,0.08)" : "0 4px 18px rgba(255,255,255,0.06)",
    },
    button: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      width: "100%",
      border: theme.buttonStyle.border ?? "none",
      borderRadius: buttonRadius,
      padding: "14px 18px",
      background: buttonBackground,
      color: buttonColor,
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      fontFamily: theme.fonts.body,
      boxShadow: light
        ? "0 12px 28px rgba(20,18,16,0.10)"
        : "0 12px 28px rgba(0,0,0,0.22)",
    },
    note: {
      borderRadius: Math.max(12, fieldRadius - 2),
      border: `1px solid ${accent}33`,
      background: light ? `${accent}10` : `${accent}16`,
      padding: "10px 12px",
      fontSize: 12,
      lineHeight: 1.5,
      color: text,
      fontFamily: theme.fonts.body,
    },
  };
}
