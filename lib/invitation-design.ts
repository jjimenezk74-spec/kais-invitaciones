import type {
  InvitationAnimationPreset,
  InvitationBackgroundVariant,
  InvitationDecorationLevel,
  InvitationDesignConfig,
  InvitationFontPreset,
  InvitationTemplateConfig
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

export function resolveInvitationDesign(
  config: InvitationTemplateConfig | null | undefined,
  fallbackPrimary: string,
  eventDesignConfig?: Partial<InvitationDesignConfig> | null,
  templateSlug?: string | null
) {
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

export function normalizeInvitationDesignConfig(config: InvitationTemplateConfig | null | undefined): InvitationDesignConfig {
  const raw = config?.designConfig;
  const designConfig: Partial<InvitationDesignConfig> = typeof raw === "object" && raw !== null ? raw : {};

  return {
    fontPreset: isOneOf(designConfig.fontPreset, fontPresets) ? designConfig.fontPreset : DEFAULT_INVITATION_DESIGN_CONFIG.fontPreset,
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

function getDesignClassName(config: InvitationDesignConfig, templateSlug?: string | null) {
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

  if (templateSlug === "rosas-rojas-15" && config.decorationLevel !== "minimal") {
    classes.push("kais-template-rosas-rojas-15", `kais-roses-decor-${config.decorationLevel}`);
  }

  return classes.join(" ");
}

function isOneOf<T extends string>(value: string | undefined, options: readonly T[]): value is T {
  return Boolean(value && options.includes(value as T));
}
