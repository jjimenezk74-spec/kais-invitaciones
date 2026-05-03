export const EVENT_FEATURES = [
  "countdown",
  "music",
  "rsvp",
  "external_rsvp_whatsapp",
  "guest_list",
  "live_album",
  "album_comments",
  "album_reactions",
  "photo_upload",
  "photo_qr",
  "gallery",
  "custom_themes",
  "free_decorations",
  "client_access",
  "analytics",
  "csv_export"
] as const;

export type EventFeatureKey = (typeof EVENT_FEATURES)[number];

export type PackageKey = "essential" | "premium" | "experience" | "luxury";

export const PACKAGE_FEATURES: Record<PackageKey, readonly EventFeatureKey[]> = {
  essential: ["countdown", "external_rsvp_whatsapp"],

  premium: [
    "countdown",
    "music",
    "rsvp",
    "guest_list",
    "gallery"
  ],

  experience: [
    "countdown",
    "music",
    "rsvp",
    "guest_list",
    "gallery",
    "live_album",
    "album_comments",
    "album_reactions",
    "photo_upload",
    "photo_qr",
    "custom_themes"
  ],

  luxury: [
    "countdown",
    "music",
    "rsvp",
    "guest_list",
    "gallery",
    "live_album",
    "album_comments",
    "album_reactions",
    "photo_upload",
    "photo_qr",
    "custom_themes",
    "free_decorations",
    "client_access",
    "analytics",
    "csv_export"
  ]
};

type EventFeatureSource = {
  package_key?: string | null;
  enabled_features?: readonly string[] | null;
  disabled_features?: readonly string[] | null;
};

const LEGACY_FALLBACK_PACKAGE: PackageKey = "luxury";

export function getPackageFeatures(packageKey?: string | null): readonly EventFeatureKey[] {
  return PACKAGE_FEATURES[normalizePackageKey(packageKey) ?? LEGACY_FALLBACK_PACKAGE];
}

export function hasPackageFeature(packageKey: string | null | undefined, feature: EventFeatureKey) {
  return getPackageFeatures(packageKey).includes(feature);
}

export function eventHasFeature(event: EventFeatureSource | null | undefined, feature: EventFeatureKey) {
  if (!event) return hasPackageFeature(LEGACY_FALLBACK_PACKAGE, feature);

  if (event.disabled_features?.includes(feature)) return false;
  if (event.enabled_features?.includes(feature)) return true;

  return hasPackageFeature(event.package_key, feature);
}

export function normalizePackageKey(value?: string | null): PackageKey | null {
  if (value === "essential" || value === "premium" || value === "experience" || value === "luxury") {
    return value;
  }

  return null;
}
