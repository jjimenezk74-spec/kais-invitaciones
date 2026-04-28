import type {
  InvitationAnimationPreset,
  InvitationBackgroundVariant,
  InvitationDecorationLevel,
  InvitationDesignConfig,
  InvitationFontPreset,
  InvitationTemplateConfig,
  InvitationTheme
} from "@/lib/types";

export const DEFAULT_INVITATION_DESIGN_CONFIG: InvitationDesignConfig = {
  fontPreset: "default",
  backgroundVariant: "default",
  animationPreset: "none",
  decorationLevel: "minimal"
};

const fontPresets: InvitationFontPreset[] = ["default", "romantic-script", "luxury-serif", "royal-classic", "modern-chic"];
const backgroundVariants: InvitationBackgroundVariant[] = ["default", "dark-roses", "satin-red", "gold-glow", "romantic-floral"];
const animationPresets: InvitationAnimationPreset[] = ["none", "soft-petals", "gold-sparkles", "elegant-glow"];
const decorationLevels: InvitationDecorationLevel[] = ["minimal", "medium", "premium"];

/** Shape returned by all design resolvers. */
export type ResolvedDesign = {
  designConfig: InvitationDesignConfig;
  primary: string;
  secondary: string;
  stageClassName: string;
  designClassName: string;
};

// ─── Premium Theme resolver ─────────────────────────────────────────────────

/**
 * Resolves the final display config for a premium theme event.
 * ONLY emits: kais-stage, kais-theme-active, kais-theme-{slug},
 * font/decoration classes. Never emits kais-bg-*, kais-motion-*,
 * kais-template-*, or legacy color styles.
 *
 * Merge priority (lowest → highest):
 *   DEFAULT_INVITATION_DESIGN_CONFIG
 *   → theme.default_design_config
 *   → event.design_config
 */
export function resolvePremiumThemeDesign(
  theme: InvitationTheme | null | undefined,
  fallbackPrimary: string | null,
  eventDesignConfig?: Partial<InvitationDesignConfig> | null
): ResolvedDesign {
  const merged = mergeDesignConfigs(
    theme?.default_design_config,
    eventDesignConfig
  );
  const designConfig = normalizeInvitationDesignConfig({ designConfig: merged });

  return {
    designConfig,
    primary: fallbackPrimary ?? "#d4af37",
    secondary: "#f8fafc",
    stageClassName: "kais-stage relative font-sans",
    // Theme system owns background + motion — never emit kais-bg-* or kais-motion-*
    // so they cannot override the theme's --kt-stage-bg token.
    designClassName: getThemeOnlyDesignClassName(designConfig)
  };
}

/** @deprecated Use resolvePremiumThemeDesign instead */
export const resolveThemeDesign = resolvePremiumThemeDesign;

/**
 * For theme-based events: only font + decoration classes.
 * kais-bg-* and kais-motion-* are intentionally excluded —
 * they hard-code red/crimson backgrounds that would override the theme CSS.
 */
function getThemeOnlyDesignClassName(config: InvitationDesignConfig): string {
  const classes: string[] = [];
  if (config.fontPreset !== "default") classes.push(`kais-font-${config.fontPreset}`);
  if (config.decorationLevel !== "minimal") classes.push(`kais-decor-${config.decorationLevel}`);
  return classes.join(" ");
}

/**
 * Merges partial design configs.
 * Arguments are listed in ASCENDING priority order — later entries win.
 * Undefined / null values in a source are skipped so the next-lower
 * priority value remains in effect.
 *
 * @example
 *   mergeDesignConfigs(theme.default_design_config, event.design_config)
 *   // event.design_config wins wherever both define the same key
 */
export function mergeDesignConfigs(
  ...configs: Array<Partial<InvitationDesignConfig> | null | undefined>
): Partial<InvitationDesignConfig> {
  const result: Partial<InvitationDesignConfig> = {};
  for (const cfg of configs) {
    if (!cfg) continue;
    if (cfg.fontPreset !== undefined)       result.fontPreset       = cfg.fontPreset;
    if (cfg.backgroundVariant !== undefined) result.backgroundVariant = cfg.backgroundVariant;
    if (cfg.animationPreset !== undefined)   result.animationPreset   = cfg.animationPreset;
    if (cfg.decorationLevel !== undefined)   result.decorationLevel   = cfg.decorationLevel;
  }
  return result;
}

// ─── Legacy template resolver ───────────────────────────────────────────────

/**
 * Resolves design for the legacy InvitationTemplateConfig system.
 * Used ONLY for events without a theme_id.
 * Kept as-is so existing invitation_templates continue to work.
 */
export function resolveLegacyDesign(
  config: InvitationTemplateConfig | null | undefined,
  fallbackPrimary: string,
  eventDesignConfig?: Partial<InvitationDesignConfig> | null,
  templateSlug?: string | null
): ResolvedDesign {
  const designConfig = normalizeInvitationDesignConfig({
    ...config,
    designConfig: {
      ...(config?.designConfig ?? {}),
      ...(eventDesignConfig ?? {})
    }
  });

  return {
    designConfig,
    primary: config?.primary ?? fallbackPrimary,
    secondary: config?.secondary ?? "#f8fafc",
    stageClassName: "kais-stage relative font-sans",
    designClassName: getDesignClassName(designConfig, templateSlug)
  };
}

/** @deprecated Use resolveLegacyDesign instead */
export const resolveInvitationDesign = resolveLegacyDesign;

// ─── Shared utilities ─────────────────────────────────────────────────────────

export function normalizeInvitationDesignConfig(
  config: InvitationTemplateConfig | null | undefined
): InvitationDesignConfig {
  const raw = config?.designConfig;
  const designConfig: Partial<InvitationDesignConfig> =
    typeof raw === "object" && raw !== null ? raw : {};

  return {
    fontPreset: isOneOf(designConfig.fontPreset, fontPresets)
      ? designConfig.fontPreset
      : DEFAULT_INVITATION_DESIGN_CONFIG.fontPreset,
    backgroundVariant: isOneOf(designConfig.backgroundVariant, backgroundVariants)
      ? designConfig.backgroundVariant
      : DEFAULT_INVITATION_DESIGN_CONFIG.backgroundVariant,
    animationPreset: isOneOf(designConfig.animationPreset, animationPresets)
      ? designConfig.animationPreset
      : DEFAULT_INVITATION_DESIGN_CONFIG.animationPreset,
    decorationLevel: isOneOf(designConfig.decorationLevel, decorationLevels)
      ? designConfig.decorationLevel
      : DEFAULT_INVITATION_DESIGN_CONFIG.decorationLevel
  };
}

function getDesignClassName(
  config: InvitationDesignConfig,
  themeOrTemplateSlug?: string | null
): string {
  if (
    config.fontPreset === "default" &&
    config.backgroundVariant === "default" &&
    config.animationPreset === "none" &&
    config.decorationLevel === "minimal"
  ) {
    return "";
  }

  const classes = [
    `kais-font-${config.fontPreset}`,
    `kais-bg-${config.backgroundVariant}`,
    `kais-motion-${config.animationPreset}`,
    `kais-decor-${config.decorationLevel}`
  ];

  // Legacy template-specific decoration classes (rosas-rojas-15).
  if (themeOrTemplateSlug === "rosas-rojas-15" && config.decorationLevel !== "minimal") {
    classes.push("kais-template-rosas-rojas-15", `kais-roses-decor-${config.decorationLevel}`);
  }

  return classes.join(" ");
}

function isOneOf<T extends string>(value: string | undefined, options: readonly T[]): value is T {
  return Boolean(value && options.includes(value as T));
}
