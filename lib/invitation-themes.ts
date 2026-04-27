/**
 * invitation-themes.ts
 * Pure, client-safe helpers for the category + theme system.
 * No I/O — safe to import in both server and client components.
 *
 * For server-side DB fetches see: lib/invitation-themes.server.ts
 */

import type { InvitationDesignConfig, InvitationTheme } from "@/lib/types";
import { mergeDesignConfigs } from "@/lib/invitation-design";

// ─── Array lookups ────────────────────────────────────────────────────────────

/** Returns the first active theme matching `slug`, or null. */
export function getThemeBySlug(
  themes: InvitationTheme[],
  slug: string
): InvitationTheme | null {
  return themes.find((t) => t.slug === slug && t.is_active) ?? null;
}

/** Returns the first active theme matching `id`, or null. */
export function getThemeById(
  themes: InvitationTheme[],
  id: string
): InvitationTheme | null {
  return themes.find((t) => t.id === id && t.is_active) ?? null;
}

/** Filters active themes that belong to the given category UUID. */
export function getThemesByCategory(
  themes: InvitationTheme[],
  categoryId: string
): InvitationTheme[] {
  return themes
    .filter((t) => t.category_id === categoryId && t.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Filters premium themes only. */
export function getPremiumThemes(themes: InvitationTheme[]): InvitationTheme[] {
  return themes.filter((t) => t.is_premium && t.is_active);
}

// ─── Design config helpers ────────────────────────────────────────────────────

/**
 * Returns the design config to pre-populate a form when a theme is first applied.
 *
 * Merge order (lowest → highest priority):
 *   theme.default_design_config → existingEventConfig
 *
 * If the user already has custom overrides on the event, those are preserved
 * on top of the theme defaults. Pass null / undefined to get the theme defaults.
 */
export function applyThemeToDesignConfig(
  theme: InvitationTheme,
  existingEventConfig?: Partial<InvitationDesignConfig> | null
): Partial<InvitationDesignConfig> {
  return mergeDesignConfigs(theme.default_design_config, existingEventConfig);
}

/**
 * Returns only the design options that the theme explicitly declares
 * as available. Falls back to the full option lists when the theme
 * does not restrict a dimension.
 */
export function getAvailableOptions(theme: InvitationTheme) {
  const ALL_FONT_PRESETS     = ["default", "romantic-script", "luxury-serif", "royal-classic", "modern-chic"] as const;
  const ALL_BG_VARIANTS      = ["default", "dark-roses", "satin-red", "gold-glow", "romantic-floral"] as const;
  const ALL_ANIMATION_PRESETS = ["none", "soft-petals", "gold-sparkles", "elegant-glow"] as const;
  const ALL_DECORATION_LEVELS = ["minimal", "medium", "premium"] as const;

  return {
    fontPresets:      theme.available_options.fontPresets      ?? [...ALL_FONT_PRESETS],
    backgroundVariants: theme.available_options.backgroundVariants ?? [...ALL_BG_VARIANTS],
    animationPresets: theme.available_options.animationPresets ?? [...ALL_ANIMATION_PRESETS],
    decorationLevels: theme.available_options.decorationLevels ?? [...ALL_DECORATION_LEVELS]
  };
}
