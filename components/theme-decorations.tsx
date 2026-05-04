import type { CSSProperties } from "react";
import type { DecorationSlot, EventDecorations, VisualDecoration } from "@/lib/types";

type ThemeDecorationsProps = {
  themeSlug?: string | null;
  decorations: EventDecorations;
  freeDecorations?: VisualDecoration[] | null;
  section: "hero" | "info" | "rsvp" | "gallery" | "footer";
};

type SlotRule = {
  slot: DecorationSlot;
  className: string;
  style?: CSSProperties;
};

const THEME_SECTION_SLOTS: Record<string, Partial<Record<ThemeDecorationsProps["section"], SlotRule[]>>> = {
  "luxury-night": {
    info: [
      {
        slot: "top_left",
        className: "theme-decoration-img theme-decoration-corner top-[clamp(12px,2vw,32px)] left-[clamp(12px,2vw,32px)]"
      },
      {
        slot: "top_right",
        className: "theme-decoration-img theme-decoration-corner top-[clamp(12px,2vw,32px)] right-[clamp(12px,2vw,32px)]"
      },
      {
        slot: "bottom_left",
        className: "theme-decoration-img theme-decoration-corner bottom-[clamp(12px,2vw,32px)] left-[clamp(12px,2vw,32px)]"
      },
      {
        slot: "bottom_right",
        className: "theme-decoration-img theme-decoration-corner bottom-[clamp(12px,2vw,32px)] right-[clamp(12px,2vw,32px)]"
      },
      {
        slot: "side_left",
        className: "theme-decoration-img theme-decoration-side hidden top-1/2 left-[clamp(8px,1.5vw,24px)] -translate-y-1/2 md:block"
      },
      {
        slot: "side_right",
        className: "theme-decoration-img theme-decoration-side hidden top-1/2 right-[clamp(8px,1.5vw,24px)] -translate-y-1/2 md:block"
      }
    ]
  }
};

export function ThemeDecorations({ themeSlug, decorations, freeDecorations, section }: ThemeDecorationsProps) {
  const normalizedTheme = normalizeThemeSlug(themeSlug);
  const rules = normalizedTheme ? THEME_SECTION_SLOTS[normalizedTheme]?.[section] ?? [] : [];
  const activeRules = rules.filter(({ slot }) => Boolean(decorations[slot]));
  const activeFreeDecorations = normalizeFreeDecorations(freeDecorations, section);

  if (process.env.NODE_ENV !== "production") {
    console.info("[KAIS DECORATIONS]", {
      themeSlug,
      normalizedTheme,
      section,
      activeSlots: activeRules.map((rule) => rule.slot),
      freeDecorations: activeFreeDecorations.length,
      hasDecorations: Object.fromEntries(Object.entries(decorations).map(([slot, url]) => [slot, Boolean(url)]))
    });
  }

  if (activeRules.length === 0 && activeFreeDecorations.length === 0) return null;

  return (
    <div aria-hidden className="theme-decoration-layer">
      {activeRules.map(({ slot, className, style }) => (
        <div key={slot} className={className} style={style}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={decorations[slot] ?? undefined}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
      ))}
      {activeFreeDecorations.map((decoration) => {
        const isSectionFit = decoration.fitMode === "section";
        return (
          <div
            key={decoration.id}
            data-fit={isSectionFit ? "section" : "manual"}
            className={`theme-decoration-free ${getEffectClassName(decoration)} ${getVisibilityClass(decoration)}`}
            style={isSectionFit ? {
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              opacity: decoration.opacity,
              transform: `rotate(${decoration.rotate}deg)`,
              transformOrigin: "center center",
              filter: getEffectFilter(decoration)
            } : {
              left: `${decoration.x}%`,
              top: `${decoration.y}%`,
              width: `${decoration.width}px`,
              opacity: decoration.opacity,
              transform: `translate(-50%, -50%) rotate(${decoration.rotate}deg)`,
              filter: getEffectFilter(decoration)
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={decoration.url}
              alt=""
              loading="lazy"
              className={isSectionFit ? "h-full w-full object-cover" : "h-auto w-full object-contain"}
            />
          </div>
        );
      })}
    </div>
  );
}

function normalizeThemeSlug(themeSlug?: string | null) {
  return themeSlug?.toLowerCase().trim().replaceAll("_", "-").replaceAll(" ", "-") ?? "";
}

function normalizeFreeDecorations(
  freeDecorations: VisualDecoration[] | null | undefined,
  section: ThemeDecorationsProps["section"]
) {
  if (!Array.isArray(freeDecorations)) return [];

  return freeDecorations
    .filter((decoration) => decoration.url && decoration.section === section && isDecorationVisibleSomewhere(decoration))
    .map((decoration) => ({
      ...decoration,
      x: clamp(decoration.x, 0, 100),
      y: clamp(decoration.y, 0, 100),
      width: clamp(decoration.width, 40, 2000),
      opacity: clamp(decoration.opacity, 0, 1),
      rotate: clamp(decoration.rotate, -180, 180),
      effect: normalizeEffect(decoration.effect),
      glowColor: normalizeGlowColor(decoration.glowColor),
      glowStrength: normalizeGlowStrength(decoration.glowStrength),
      fitMode: decoration.fitMode === "section" ? "section" : "manual"
    } as VisualDecoration));
}

function getVisibilityClass(decoration: VisualDecoration) {
  if (decoration.device === "desktop") return "hidden md:block";
  if (decoration.device === "mobile") return "md:hidden";
  if (decoration.desktop && decoration.mobile) return "";
  if (decoration.desktop) return "hidden md:block";
  if (decoration.mobile) return "md:hidden";
  return "hidden";
}

function isDecorationVisibleSomewhere(decoration: VisualDecoration) {
  return decoration.device === "desktop" || decoration.device === "mobile" || Boolean(decoration.desktop || decoration.mobile);
}

function getEffectFilter(decoration: VisualDecoration) {
  if (decoration.effect === "glow") {
    const blur = decoration.glowStrength === "high" ? 26 : decoration.glowStrength === "low" ? 8 : 16;
    return `drop-shadow(0 0 ${blur}px ${decoration.glowColor})`;
  }

  if (decoration.effect === "soft_shadow") {
    return "drop-shadow(0 14px 22px rgba(0, 0, 0, 0.28))";
  }

  return "none";
}

function getEffectClassName(decoration: VisualDecoration) {
  if (decoration.effect === "float") return "theme-decoration-float";
  if (decoration.effect === "pulse") return "theme-decoration-pulse";
  return "";
}

function normalizeEffect(value: unknown): VisualDecoration["effect"] {
  if (value === "golden_glow") return "glow";
  return value === "glow" || value === "soft_shadow" || value === "float" || value === "pulse" ? value : "none";
}

function normalizeGlowStrength(value: unknown): VisualDecoration["glowStrength"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeGlowColor(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#f4d27a";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
