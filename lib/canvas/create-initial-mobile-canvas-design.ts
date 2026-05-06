import {
  DEFAULT_MOBILE_CANVAS_SECTIONS,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_CANVAS_WIDTH,
  getGlobalYPercent,
  normalizeCanvasDesign,
} from "@/lib/canvas/normalize-canvas-design";
import type { CanvasDesign, CanvasElement, CanvasImageElement, CanvasSectionId, CanvasTextElement } from "@/lib/types";

type InitialCanvasEventData = {
  title?: string | null;
  event_type?: string | null;
  hosts_names?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  address?: string | null;
  main_message?: string | null;
  cover_image_url?: string | null;
  mobile_cover_image_url?: string | null;
  quinceanera_name?: string | null;
  parents_names?: string | null;
  church_name?: string | null;
  church_time?: string | null;
  dress_code?: string | null;
  color_palette?: string | null;
  theme?: string | null;
  quince_message?: string | null;
  parents_message?: string | null;
};

type InitialCanvasTheme = {
  slug?: string | null;
  name?: string | null;
  primary?: string | null;
  secondary?: string | null;
} | null;

const DEFAULT_FONT = "Inter, system-ui, sans-serif";
const DISPLAY_FONT = "'Playfair Display', Georgia, serif";

export function createInitialMobileCanvasDesign(
  eventData: InitialCanvasEventData,
  theme?: InitialCanvasTheme
): CanvasDesign {
  const themeTokens = resolveThemeTokens(eventData, theme);
  const heroImage = eventData.mobile_cover_image_url || eventData.cover_image_url || null;
  const title = clean(eventData.quinceanera_name) || clean(eventData.hosts_names) || clean(eventData.title) || "Tu evento";
  const eventType = clean(eventData.event_type) || "Evento";
  const dateLabel = formatEventDate(eventData.event_date, eventData.event_time);
  const message =
    clean(eventData.quince_message) ||
    clean(eventData.main_message) ||
    "Celebremos juntos un momento inolvidable.";

  const elements: CanvasElement[] = [
    ...(heroImage ? [imageElement("hero-bg", heroImage, "hero", 50, yInSection("hero", 50), 390, 844, 1, true, "fill")] : []),
    imageOverlayElement(themeTokens.overlay),
    textElement("event-type", eventType.toUpperCase(), "hero", 50, yInSection("hero", 16), 270, 16, 3, {
      color: themeTokens.accent,
      fontFamily: DEFAULT_FONT,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.42,
      textShadow: "0 2px 10px rgba(0,0,0,0.45)",
    }),
    textElement("main-title", title, "hero", 50, yInSection("hero", 39), 360, null, 4, {
      color: themeTokens.title,
      fontFamily: DISPLAY_FONT,
      fontSize: title.length > 18 ? 52 : 66,
      fontWeight: "400",
      fontStyle: "italic",
      lineHeight: 0.95,
      textShadow: "0 4px 18px rgba(0,0,0,0.55)",
    }),
    textElement("event-date", dateLabel, "hero", 50, yInSection("hero", 58), 300, 24, 5, {
      color: themeTokens.body,
      fontFamily: DISPLAY_FONT,
      fontSize: 25,
      fontStyle: "italic",
      textShadow: "0 2px 12px rgba(0,0,0,0.55)",
    }),
    textElement("countdown-title", "Cuenta regresiva", "countdown", 50, yInSection("countdown", 22), 320, 32, 6, {
      color: themeTokens.accent,
      fontFamily: DISPLAY_FONT,
      fontSize: 31,
      fontStyle: "italic",
      letterSpacing: 0.02,
      textShadow: "0 2px 10px rgba(0,0,0,0.55)",
    }),
    textElement("countdown-placeholder", "00 DIAS   00 HORAS   00 MIN   00 SEG", "countdown", 50, yInSection("countdown", 48), 330, 42, 7, {
      color: themeTokens.body,
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.16,
      textShadow: "0 2px 10px rgba(0,0,0,0.55)",
    }),
    textElement("main-message", message, "presentation", 50, yInSection("presentation", 35), 320, null, 8, {
      color: themeTokens.body,
      fontSize: 17,
      lineHeight: 1.45,
      textShadow: "0 2px 10px rgba(0,0,0,0.65)",
      style: { background: "rgba(255,255,255,0.08)", borderRadius: 28, backdropBlur: 14 },
    }),
    ...optionalTextElements(eventData, themeTokens),
    textElement("rsvp-title", "Confirma tu asistencia", "rsvp", 50, yInSection("rsvp", 24), 320, 40, 19, {
      color: themeTokens.accent,
      fontFamily: DISPLAY_FONT,
      fontSize: 32,
      fontStyle: "italic",
      textShadow: "0 2px 10px rgba(0,0,0,0.55)",
    }),
    textElement("rsvp-button", "CONFIRMAR ASISTENCIA", "rsvp", 50, yInSection("rsvp", 54), 290, 52, 20, {
      color: themeTokens.buttonText,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.22,
      textShadow: null,
      style: { background: `linear-gradient(135deg, ${themeTokens.accent}, ${themeTokens.button})`, borderRadius: 999 },
    }),
  ];

  return normalizeCanvasDesign({
    version: 1,
    viewport: "mobile",
    width: MOBILE_CANVAS_WIDTH,
    height: MOBILE_CANVAS_HEIGHT,
    refWidth: MOBILE_CANVAS_WIDTH,
    refHeight: 844,
    sections: DEFAULT_MOBILE_CANVAS_SECTIONS,
    background: heroImage ? { type: "color", color: themeTokens.background } : { type: "gradient", gradient: themeTokens.fallbackGradient },
    elements,
    updatedAt: new Date().toISOString(),
  });
}

function optionalTextElements(eventData: InitialCanvasEventData, themeTokens: ReturnType<typeof resolveThemeTokens>) {
  const elements: CanvasElement[] = [];

  if (clean(eventData.parents_names)) {
    elements.push(textElement("parents", `Junto a mis padres\n${clean(eventData.parents_names)}`, "messages", 50, yInSection("messages", 26), 300, null, 10, {
      color: themeTokens.body,
      fontSize: 15,
      lineHeight: 1.35,
      textShadow: "0 2px 10px rgba(0,0,0,0.58)",
    }));
  }

  if (clean(eventData.church_name)) {
    const church = `Ceremonia religiosa\n${clean(eventData.church_name)}${clean(eventData.church_time) ? ` · ${clean(eventData.church_time)}` : ""}`;
    elements.push(textElement("church", church, "church", 50, yInSection("church", 35), 320, null, 11, {
      color: themeTokens.body,
      fontSize: 14,
      lineHeight: 1.35,
      textShadow: "0 2px 10px rgba(0,0,0,0.58)",
    }));
  }

  const details = [eventData.address, eventData.dress_code, eventData.color_palette, eventData.theme]
    .map(clean)
    .filter(Boolean);
  if (details.length > 0) {
    elements.push(textElement("details", details.join("\n"), "details", 50, yInSection("details", 35), 320, null, 12, {
      color: themeTokens.body,
      fontSize: 13,
      lineHeight: 1.38,
      textShadow: "0 2px 10px rgba(0,0,0,0.58)",
    }));
  }

  return elements;
}

function textElement(
  id: string,
  content: string,
  sectionId: CanvasSectionId,
  x: number,
  y: number,
  width: number,
  height: number | null,
  zIndex: number,
  overrides: Partial<CanvasTextElement> = {}
): CanvasTextElement {
  return {
    id,
    type: "text",
    sectionId,
    x: centerXToLeftPercent(x, width),
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    zIndex,
    locked: false,
    visible: true,
    device: "mobile",
    content,
    fontFamily: DEFAULT_FONT,
    fontSize: 16,
    fontWeight: "400",
    fontStyle: "normal",
    textAlign: "center",
    color: "#ffffff",
    lineHeight: 1.2,
    letterSpacing: 0,
    textShadow: "0 2px 10px rgba(0,0,0,0.55)",
    textDecoration: "none",
    ...overrides,
  };
}

function imageElement(
  id: string,
  url: string,
  sectionId: CanvasSectionId,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  locked: boolean,
  objectFit: CanvasImageElement["objectFit"]
): CanvasImageElement {
  return {
    id,
    type: "image",
    sectionId,
    x: centerXToLeftPercent(x, width),
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    zIndex,
    locked,
    visible: true,
    device: "mobile",
    url,
    storagePath: null,
    objectFit,
    effect: "none",
    glowColor: "#f4d27a",
    glowStrength: "medium",
    flipX: false,
    flipY: false,
  };
}

function centerXToLeftPercent(centerXPercent: number, width: number) {
  const centerX = (centerXPercent / 100) * MOBILE_CANVAS_WIDTH;
  return ((centerX - width / 2) / MOBILE_CANVAS_WIDTH) * 100;
}

function imageOverlayElement(color: string): CanvasImageElement {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".15"/><stop offset=".45" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity=".82"/></linearGradient></defs><rect width="390" height="844" fill="url(#g)"/></svg>`
  );
  return imageElement("hero-veil", `data:image/svg+xml,${svg}`, "hero", 50, yInSection("hero", 50), 390, 844, 2, true, "fill");
}

function yInSection(sectionId: CanvasSectionId, relativeY: number) {
  return getGlobalYPercent(sectionId, relativeY, DEFAULT_MOBILE_CANVAS_SECTIONS);
}

function resolveThemeTokens(eventData: InitialCanvasEventData, theme?: InitialCanvasTheme) {
  const slug = `${theme?.slug ?? eventData.theme ?? eventData.event_type ?? ""}`.toLowerCase();

  if (slug.includes("rose") || slug.includes("rosa")) {
    return {
      background: "#7A1F2B",
      fallbackGradient: "linear-gradient(180deg, #F7F0E6 0%, #B64A5A 55%, #7A1F2B 100%)",
      overlay: "#2a070d",
      title: "#fff7ef",
      body: "#fff3e5",
      accent: "#C8A96A",
      button: "#7A1F2B",
      buttonText: "#ffffff",
    };
  }

  if (slug.includes("kpop")) {
    return {
      background: "#070813",
      fallbackGradient: "linear-gradient(180deg, #070813 0%, #1a1038 48%, #070813 100%)",
      overlay: "#070813",
      title: "#f8fbff",
      body: "#e6f7ff",
      accent: "#67e8f9",
      button: "#a855f7",
      buttonText: "#ffffff",
    };
  }

  return {
    background: theme?.primary ?? "#12070a",
    fallbackGradient: `linear-gradient(180deg, ${theme?.primary ?? "#12070a"} 0%, #070404 100%)`,
    overlay: "#070404",
    title: "#fff8ed",
    body: "#f8ead4",
    accent: theme?.secondary ?? "#d4af37",
    button: theme?.primary ?? "#7a1f2b",
    buttonText: "#ffffff",
  };
}

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function formatEventDate(date?: string | null, time?: string | null) {
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T00:00:00`);
  const formatted = Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("es-PY", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
  return time ? `${formatted} · ${time}` : formatted;
}
