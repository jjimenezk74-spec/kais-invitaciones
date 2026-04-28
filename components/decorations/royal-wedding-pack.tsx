/**
 * Royal Wedding Pack — SVG inline decoration layer
 *
 * Renders when: theme.slug === "royal-wedding" || decorationPreset === "luxury-gold"
 *
 * - No external assets, no PNGs, no Supabase, no RSVP logic.
 * - pointer-events: none on all layers.
 * - z-index behind content (see globals.css .kais-rwp-* rules).
 * - prefers-reduced-motion: animation removed via CSS.
 */

// ── Corner ornament (top-left canonical; CSS transforms flip for other corners) ──

function CornerOrnament({
  flipH = false,
  flipV = false,
}: {
  flipH?: boolean;
  flipV?: boolean;
}) {
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  const t = sx !== 1 || sy !== 1 ? `scale(${sx}, ${sy})` : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={t ? { transform: t, transformOrigin: "center" } : undefined}
    >
      {/* Main L-bracket arms */}
      <path
        d="M9 9 L62 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 9 L9 62"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Corner gem */}
      <circle cx="9" cy="9" r="4.5" fill="currentColor" opacity={0.78} />
      {/* Horizontal end-cap diamond */}
      <polygon
        points="62,9 68,4 74,9 68,14"
        fill="currentColor"
        opacity={0.65}
      />
      {/* Vertical end-cap diamond */}
      <polygon
        points="9,62 4,68 9,74 14,68"
        fill="currentColor"
        opacity={0.65}
      />
      {/* Inner filigree curve */}
      <path
        d="M22 22 C30 22 38 30 38 38"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity={0.38}
      />
      {/* Secondary inner bracket ticks */}
      <line
        x1="9"
        y1="18"
        x2="20"
        y2="18"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity={0.28}
      />
      <line
        x1="18"
        y1="9"
        x2="18"
        y2="20"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity={0.28}
      />
    </svg>
  );
}

// ── Crown SVG ─────────────────────────────────────────────────────────────────

function Crown() {
  return (
    <svg
      viewBox="0 0 240 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="kais-rwp-crown"
      aria-hidden="true"
    >
      {/* Crown silhouette profile */}
      <path
        d="M8 68 L8 46 L32 60 L60 30 L90 58 L120 6 L150 58 L180 30 L208 60 L232 46 L232 68"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Base band */}
      <rect
        x="4"
        y="68"
        width="232"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Inner band mid-line */}
      <line
        x1="12"
        y1="77"
        x2="228"
        y2="77"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity={0.45}
      />
      {/* Decorative band ticks */}
      {[30, 60, 120, 180, 210].map((x) => (
        <line
          key={x}
          x1={x}
          y1="68"
          x2={x}
          y2="86"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity={0.32}
        />
      ))}
      {/* Center spike gem (elongated diamond) */}
      <polygon
        points="120,3 127,14 120,11 113,14"
        fill="currentColor"
        opacity={0.88}
      />
      {/* Mid-spike gems */}
      <circle cx="60" cy="28" r="4.5" fill="currentColor" opacity={0.72} />
      <circle cx="180" cy="28" r="4.5" fill="currentColor" opacity={0.72} />
      {/* Inner mid-spike decorative ring */}
      <circle
        cx="60"
        cy="28"
        r="7.5"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity={0.30}
      />
      <circle
        cx="180"
        cy="28"
        r="7.5"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity={0.30}
      />
      {/* Outer edge spikes gems */}
      <circle cx="8" cy="44" r="3" fill="currentColor" opacity={0.55} />
      <circle cx="232" cy="44" r="3" fill="currentColor" opacity={0.55} />
    </svg>
  );
}

// ── Ornamental Section Divider ────────────────────────────────────────────────

export function RoyalWeddingDivider() {
  return (
    <div className="kais-rwp-divider-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 500 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="kais-rwp-divider-svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Left line with gradient feel (full opacity tapers at extremes) */}
        <line
          x1="0"
          y1="20"
          x2="196"
          y2="20"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity={0.50}
        />
        {/* Left accent diamond */}
        <polygon
          points="202,20 210,14 218,20 210,26"
          fill="currentColor"
          opacity={0.65}
        />
        {/* Center large diamond — outline */}
        <polygon
          points="250,7 265,20 250,33 235,20"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
          opacity={0.85}
        />
        {/* Center inner diamond — filled */}
        <polygon
          points="250,13 259,20 250,27 241,20"
          fill="currentColor"
          opacity={0.55}
        />
        {/* Center tiny inner dot */}
        <circle cx="250" cy="20" r="2" fill="currentColor" opacity={0.80} />
        {/* Right accent diamond */}
        <polygon
          points="282,20 290,14 298,20 290,26"
          fill="currentColor"
          opacity={0.65}
        />
        {/* Right line */}
        <line
          x1="304"
          y1="20"
          x2="500"
          y2="20"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity={0.50}
        />
        {/* Secondary fine lines flanking center */}
        <line
          x1="0"
          y1="23"
          x2="196"
          y2="23"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity={0.22}
        />
        <line
          x1="304"
          y1="23"
          x2="500"
          y2="23"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity={0.22}
        />
      </svg>
    </div>
  );
}

// ── Main Pack — overlay layer ─────────────────────────────────────────────────

export function RoyalWeddingPack() {
  return (
    <>
      {/* Absolute overlay — spans full page, renders below sections via DOM order */}
      <div className="kais-rwp-overlay" aria-hidden="true">
        {/* Page-edge frame lines */}
        <div className="kais-rwp-frame-top" />
        <div className="kais-rwp-frame-bottom" />
        <div className="kais-rwp-frame-left" />
        <div className="kais-rwp-frame-right" />

        {/* Four corner ornaments */}
        <div className="kais-rwp-corner kais-rwp-tl">
          <CornerOrnament />
        </div>
        <div className="kais-rwp-corner kais-rwp-tr">
          <CornerOrnament flipH />
        </div>
        <div className="kais-rwp-corner kais-rwp-bl">
          <CornerOrnament flipV />
        </div>
        <div className="kais-rwp-corner kais-rwp-br">
          <CornerOrnament flipH flipV />
        </div>
      </div>

      {/* Crown — sits at the top of the page content (absolute, below hero text via DOM order) */}
      <div className="kais-rwp-crown-wrap" aria-hidden="true">
        <Crown />
        {/* Shimmer gradient beneath crown */}
        <div className="kais-rwp-crown-glow" />
      </div>
    </>
  );
}
