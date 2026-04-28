/**
 * theme-preview.ts
 * Pure frontend helper — defines gradient, icon and accent colour
 * for every invitation theme slug. No DB or server imports.
 */

export type ThemePreview = {
  /** CSS background value (multi-stop gradient). */
  gradient: string;
  /** Optional secondary overlay (shimmer, glow, neon blobs). */
  shimmer?: string;
  /** Unicode symbol / emoji shown as the large focal icon. */
  icon: string;
  /** Hex colour for accent lines, badges and borders. */
  accentColor: string;
  /** Whether foreground text / icon should be white (true) or dark (false). */
  textLight: boolean;
};

// ─── Per-slug previews ────────────────────────────────────────────────────────

const PREVIEWS: Record<string, ThemePreview> = {

  // ── Quinceañera ────────────────────────────────────────────────────────────

  "red-roses-glam": {
    gradient:
      "radial-gradient(circle at 30% 20%, #7f1d1d 0%, transparent 55%)," +
      "radial-gradient(circle at 72% 78%, #b91c1c 0%, transparent 40%)," +
      "linear-gradient(140deg, #1a0005 0%, #3d0010 55%, #1a0005 100%)",
    shimmer:
      "linear-gradient(135deg, transparent 38%, rgba(212,175,55,.10) 58%, transparent 72%)",
    icon: "🌹",
    accentColor: "#d4af37",
    textLight: true,
  },

  "princess-pink": {
    gradient:
      "radial-gradient(ellipse at top, #fce4ec 0%, #f8bbd0 45%, #e8a0b4 100%)",
    shimmer:
      "radial-gradient(circle at 60% 30%, rgba(255,255,255,.35), transparent 55%)",
    icon: "♛",
    accentColor: "#c2185b",
    textLight: false,
  },

  "midnight-queen": {
    gradient:
      "radial-gradient(circle at 50% 28%, #5b0098 0%, #20004a 42%, #0d0018 100%)",
    shimmer:
      "linear-gradient(135deg, transparent 28%, rgba(212,175,55,.13) 52%, transparent 68%)," +
      "radial-gradient(circle at 80% 20%, rgba(180,100,255,.18), transparent 45%)",
    icon: "♛",
    accentColor: "#d4af37",
    textLight: true,
  },

  // ── Boda ───────────────────────────────────────────────────────────────────

  "garden-romance": {
    gradient:
      "radial-gradient(ellipse at top, #f1f8e9 0%, #c8e6c9 48%, #81c784 100%)",
    shimmer:
      "radial-gradient(circle at 65% 20%, rgba(255,255,255,.40), transparent 50%)",
    icon: "🌸",
    accentColor: "#2e7d32",
    textLight: false,
  },

  "royal-wedding": {
    gradient:
      "radial-gradient(circle at 38% 15%, #fffde7 0%, #ffe082 32%, #d4af37 68%, #8b7536 100%)",
    shimmer:
      "linear-gradient(135deg, transparent 28%, rgba(255,255,255,.22) 52%, transparent 68%)",
    icon: "✦",
    accentColor: "#5d4037",
    textLight: false,
  },

  "ivory-minimal": {
    gradient:
      "linear-gradient(160deg, #faf8f5 0%, #f0ede8 52%, #e8e4dd 100%)",
    shimmer:
      "radial-gradient(circle at 70% 20%, rgba(255,255,255,.60), transparent 55%)",
    icon: "◇",
    accentColor: "#8d6e63",
    textLight: false,
  },

  "kpop-warriors": {
    gradient:
      "radial-gradient(ellipse at 50% -10%, #4a005e 0%, #1e0030 40%, #050008 100%)",
    shimmer:
      "radial-gradient(circle at 25% 52%, rgba(255,47,214,.30), transparent 46%)," +
      "radial-gradient(circle at 75% 46%, rgba(0,212,255,.25), transparent 46%)," +
      "linear-gradient(135deg, transparent 35%, rgba(191,0,255,.12) 55%, transparent 72%)",
    icon: "♛",
    accentColor: "#ff2fd6",
    textLight: true,
  },

  // ── Cumpleaños ─────────────────────────────────────────────────────────────

  "luxury-night": {
    gradient:
      "radial-gradient(circle at 30% 28%, #2a1f00 0%, #0d0d00 52%)," +
      "linear-gradient(140deg, #0a0a0a, #1a1500, #0a0a0a)",
    shimmer:
      "linear-gradient(135deg, transparent 38%, rgba(212,175,55,.16) 58%, transparent 74%)",
    icon: "✦",
    accentColor: "#d4af37",
    textLight: true,
  },

  "neon-party": {
    gradient:
      "linear-gradient(135deg, #0d001a 0%, #1a0033 52%, #001a2e 100%)",
    shimmer:
      "radial-gradient(circle at 28% 52%, rgba(255,0,255,.18), transparent 48%)," +
      "radial-gradient(circle at 72% 48%, rgba(0,255,255,.18), transparent 48%)",
    icon: "⚡",
    accentColor: "#ff00ff",
    textLight: true,
  },

  // ── Niños ──────────────────────────────────────────────────────────────────

  "safari-kids": {
    gradient:
      "radial-gradient(ellipse at bottom, #4e342e 0%, #6d4c41 42%, #a1887f 100%)",
    shimmer:
      "radial-gradient(circle at 65% 25%, rgba(255,200,80,.18), transparent 48%)",
    icon: "🦁",
    accentColor: "#f9a825",
    textLight: true,
  },

  "candy-land": {
    gradient:
      "linear-gradient(135deg, #fce4ec 0%, #e1f5fe 50%, #f3e5f5 100%)",
    shimmer:
      "radial-gradient(circle at 60% 20%, rgba(255,255,255,.50), transparent 52%)",
    icon: "🍭",
    accentColor: "#e91e63",
    textLight: false,
  },

  // ── Corporativo ────────────────────────────────────────────────────────────

  "executive-black": {
    gradient:
      "linear-gradient(140deg, #0a0a0a 0%, #1a1a1a 52%, #212121 100%)",
    shimmer:
      "linear-gradient(135deg, transparent 38%, rgba(144,164,174,.12) 58%, transparent 75%)",
    icon: "◆",
    accentColor: "#90a4ae",
    textLight: true,
  },

  // ── Graduación ─────────────────────────────────────────────────────────────

  "legacy-night": {
    gradient:
      "radial-gradient(circle at 50% 18%, #1e3a5f 0%, #0a1628 58%, #050d1a 100%)",
    shimmer:
      "linear-gradient(135deg, transparent 32%, rgba(212,175,55,.14) 54%, transparent 70%)",
    icon: "✦",
    accentColor: "#d4af37",
    textLight: true,
  },
};

// ─── Fallbacks for future slugs ───────────────────────────────────────────────

const FALLBACKS: ThemePreview[] = [
  {
    gradient: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
    icon: "✦", accentColor: "#e94560", textLight: true,
  },
  {
    gradient: "linear-gradient(135deg, #2d1b69, #11998e, #38ef7d)",
    icon: "◆", accentColor: "#38ef7d", textLight: true,
  },
  {
    gradient: "linear-gradient(135deg, #6a3093, #a044ff)",
    icon: "♛", accentColor: "#ffe082", textLight: true,
  },
  {
    gradient: "linear-gradient(135deg, #f7971e, #ffd200)",
    icon: "★", accentColor: "#5d4037", textLight: false,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function getThemePreview(slug: string): ThemePreview {
  if (slug in PREVIEWS) return PREVIEWS[slug];

  // Deterministic fallback so every unknown slug still looks unique.
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = Math.imul(31, hash) + slug.charCodeAt(i);
  }
  return FALLBACKS[Math.abs(hash) % FALLBACKS.length];
}
