import { getCeremonyStructure } from "../ceremonial-structures";
import type { CanvasV3AppType, CanvasV3Design, CanvasV3Element, CanvasV3EventData, CanvasV3Section } from "../initial-design";

const CANVAS_W = 390;
const DISPLAY_FONT = "'Playfair Display', Georgia, serif";
const BODY_FONT = "Inter, system-ui, sans-serif";
const SECTION_VISUALS: Record<string, Pick<CanvasV3Section, "height" | "background">> = {
  hero: { height: 844, background: "linear-gradient(180deg,#1a0a18 0%,#3d1535 48%,#180a14 100%)" },
  countdown: { height: 420, background: "linear-gradient(180deg,#180a14,#211129)" },
  presentation: { height: 560, background: "linear-gradient(180deg,#211129,#160f1f)" },
  messages: { height: 640, background: "linear-gradient(180deg,#160f1f,#241125)" },
  church: { height: 520, background: "linear-gradient(180deg,#241125,#18121f)" },
  details: { height: 620, background: "linear-gradient(180deg,#18121f,#20101c)" },
  dresscode: { height: 460, background: "linear-gradient(180deg,#20101c,#17111c)" },
  rsvp: { height: 1000, background: "linear-gradient(180deg,#17111c,#241225)" },
  footer: { height: 280, background: "linear-gradient(180deg,#241225,#0f0f17)" },
};

function buildSections(eventType?: string | null): CanvasV3Section[] {
  const structure = getCeremonyStructure(eventType);
  let y = 0;
  return structure.sections.map((section) => {
    const visual = SECTION_VISUALS[section.id] ?? { height: 420, background: "linear-gradient(180deg,#17111c,#241225)" };
    const next: CanvasV3Section = {
      id: section.id,
      label: section.label,
      y,
      height: visual.height,
      background: visual.background,
      kind: section.kind,
      required: section.required,
      sourceEventType: structure.eventType,
    };
    y += visual.height;
    return next;
  });
}

function sectionTop(sections: CanvasV3Section[], id: string) {
  return sections.find((section) => section.id === id)?.y ?? 0;
}

function cx(width: number) {
  return Math.round((CANVAS_W - width) / 2);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function eventDateTime(event: CanvasV3EventData) {
  return event.event_date && event.event_time ? `${event.event_date}T${event.event_time}` : undefined;
}

function formatDateLabel(date?: string | null, time?: string | null) {
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T00:00:00`);
  const label = Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("es-PY", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
  return time ? `${label} - ${time} hs` : label;
}

function formatDateParts(date?: string | null) {
  if (!date) return { day: "--", monthYear: "FECHA POR CONFIRMAR" };
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { day: "--", monthYear: date.toUpperCase() };
  return {
    day: new Intl.DateTimeFormat("es-PY", { day: "2-digit" }).format(parsed),
    monthYear: new Intl.DateTimeFormat("es-PY", { month: "long", year: "numeric" }).format(parsed).toUpperCase(),
  };
}

function safeExternalUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^(https?:\/\/|\/)/i.test(raw) && !/^(blob:|data:)/i.test(raw)) return raw;
  return "";
}

function whatsappUrl(phone?: string | null) {
  const digits = clean(phone).replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function createQuinceaniosCanvasV3Design(event: CanvasV3EventData): CanvasV3Design {
  const sections = buildSections(event.event_type);
  const title =
    clean(event.quinceanera_name) ||
    clean(event.hosts_names) ||
    clean(event.title) ||
    "Tu evento";
  const eventType = clean(event.event_type) || "Evento";
  const dateLabel = formatDateLabel(event.event_date, event.event_time);
  const dateParts = formatDateParts(event.event_date);
  const mainMessage = clean(event.quince_message) || clean(event.main_message) || "Celebremos juntos una noche inolvidable.";
  const parentsMessage = clean(event.parents_message) || (clean(event.parents_names) ? `Junto a mis padres\n${clean(event.parents_names)}` : "");
  const churchText = [
    clean(event.church_name) || "Lugar de misa por confirmar",
    clean(event.church_time) || (event.event_time ? `${event.event_time} hs` : ""),
  ].filter(Boolean).join("\n");
  const detailsText = [
    event.event_time ? `Hora: ${event.event_time} hs` : "",
    clean(event.address),
  ].filter(Boolean).join("\n");
  const dressText = [
    clean(event.dress_code),
    clean(event.color_palette) ? `Colores: ${clean(event.color_palette)}` : "",
    clean(event.theme) ? `Tematica: ${clean(event.theme)}` : "",
  ].filter(Boolean).join("\n") || "Codigo de vestimenta por definir.";
  const mapsUrl = safeExternalUrl(event.google_maps_link) || "https://maps.google.com";
  const waUrl = whatsappUrl(event.whatsapp_phone);
  const target = eventDateTime(event);

  const elements: CanvasV3Element[] = [];
  const push = (element: CanvasV3Element) => elements.push(element);
  const text = (id: string, sectionId: string, y: number, content: string, width: number, height: number | null, zIndex: number, extra: Partial<CanvasV3Element> = {}) => {
    push({
      id,
      type: "text",
      x: cx(width),
      y: sectionTop(sections, sectionId) + y,
      width,
      height,
      locked: false,
      visible: true,
      zIndex,
      content,
      fontFamily: BODY_FONT,
      fontSize: 14,
      fontWeight: "500",
      fontStyle: "normal",
      textAlign: "center",
      color: "#f6ead2",
      lineHeight: 1.35,
      letterSpacing: 0,
      textShadow: "0 2px 12px rgba(0,0,0,0.45)",
      ...extra,
    });
  };
  const card = (id: string, sectionId: string, y: number, width: number, height: number, zIndex: number, extra: Partial<CanvasV3Element> = {}) => {
    push({
      id,
      type: "decoration",
      x: cx(width),
      y: sectionTop(sections, sectionId) + y,
      width,
      height,
      locked: false,
      visible: true,
      zIndex,
      background: "linear-gradient(135deg,rgba(255,255,255,0.09),rgba(200,169,106,0.08))",
      border: "1px solid rgba(200,169,106,0.26)",
      borderRadius: 22,
      opacity: 1,
      ...extra,
    });
  };
  const app = (id: string, sectionId: string, y: number, appType: CanvasV3AppType, content: string, width: number, height: number, zIndex: number, url = "") => {
    push({
      id,
      type: "app",
      x: cx(width),
      y: sectionTop(sections, sectionId) + y,
      width,
      height,
      locked: false,
      visible: true,
      zIndex,
      appKind: appType,
      appType,
      semanticRole: appType === "countdown"
        ? "countdown"
        : appType === "maps"
          ? "maps_link"
          : appType === "rsvp"
            ? "rsvp_action"
            : appType === "whatsapp"
              ? "whatsapp_action"
              : undefined,
      dataKey: appType === "countdown"
        ? "event_date"
        : appType === "maps"
          ? "google_maps_link"
          : appType === "whatsapp"
            ? "whatsapp_phone"
            : undefined,
      lockedContent: appType === "rsvp" || appType === "countdown" || appType === "maps" || appType === "whatsapp",
      content,
      background: "linear-gradient(135deg,#c8a96a,#8f6a2d)",
      color: "#1a0a18",
      borderRadius: 16,
      opacity: 1,
      config: {
        url,
        primaryColor: "linear-gradient(135deg,#c8a96a,#8f6a2d)",
        textColor: "#1a0a18",
        countdownMode: appType === "countdown" ? "event" : undefined,
        countdownTarget: appType === "countdown" ? target : undefined,
      },
    });
  };

  card("hero-bg", "hero", 0, 390, 844, 0, {
    locked: true,
    borderRadius: 0,
    border: undefined,
    background: sections.find((section) => section.id === "hero")?.background ?? SECTION_VISUALS.hero.background,
  });
  card("hero-glow", "hero", 270, 280, 280, 1, {
    background: "radial-gradient(circle,#c8a96a44 0%,#7c3aed22 50%,transparent 72%)",
    borderRadius: 999,
    border: undefined,
    blur: 12,
    opacity: 0.72,
  });
  text("hero-badge", "hero", 124, `* ${eventType.toUpperCase()} *`, 250, 22, 2, {
    semanticRole: "event_type",
    dataKey: "event_type",
    lockedContent: true,
    fontSize: 11,
    fontWeight: "700",
    color: "#c8a96a",
    letterSpacing: 0.18,
  });
  text("hero-title", "hero", 160, title, 360, null, 3, {
    semanticRole: "honoree_name",
    dataKey: "quinceanera_name",
    lockedContent: true,
    fontSize: title.length > 18 ? 52 : 68,
    fontFamily: DISPLAY_FONT,
    fontWeight: "400",
    fontStyle: "italic",
    color: "#fff7ef",
    lineHeight: 0.92,
    textShadow: "0 4px 22px rgba(0,0,0,0.65)",
  });
  text("hero-date", "hero", 340, dateLabel, 360, 34, 4, {
    semanticRole: "event_date",
    dataKey: "event_date",
    lockedContent: true,
    fontSize: 15,
    fontFamily: DISPLAY_FONT,
    fontStyle: "italic",
    color: "#f8d9a0",
  });
  card("hero-message-card", "hero", 404, 340, 126, 5, {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(200,169,106,0.2)",
  });
  text("hero-message", "hero", 430, mainMessage, 300, null, 6, {
    semanticRole: "main_message",
    dataKey: clean(event.quince_message) ? "quince_message" : "main_message",
    lockedContent: true,
    fontSize: 14,
    color: "#f0e4cc",
    lineHeight: 1.48,
  });
  app("hero-countdown", "hero", 582, "countdown", "", 340, 72, 7);

  text("countdown-title", "countdown", 70, "Falta poco", 300, 42, 8, {
    semanticRole: "countdown",
    fontFamily: DISPLAY_FONT,
    fontSize: 34,
    fontStyle: "italic",
    color: "#f8d9a0",
  });
  app("countdown-app", "countdown", 144, "countdown", "", 340, 80, 9);
  text("countdown-caption", "countdown", 250, "para celebrar juntos", 280, 24, 10, {
    fontFamily: DISPLAY_FONT,
    fontSize: 16,
    fontStyle: "italic",
    color: "#c8a96a",
  });

  text("presentation-title", "presentation", 92, title, 340, null, 11, {
    semanticRole: "honoree_name",
    dataKey: "quinceanera_name",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 44,
    fontStyle: "italic",
    color: "#fff7ef",
  });
  text("presentation-copy", "presentation", 210, `Mis 15 anos\n${dateLabel}`, 320, null, 12, {
    semanticRole: "event_date",
    dataKey: "event_date",
    lockedContent: true,
    fontSize: 18,
    color: "#e8e0cc",
    lineHeight: 1.45,
  });

  card("quince-message-card", "messages", 70, 340, 210, 13);
  text("quince-message-title", "messages", 98, "Mensaje de la quinceanera", 300, 24, 14, {
    fontSize: 10,
    fontWeight: "900",
    color: "#c8a96a",
    letterSpacing: 0.16,
  });
  text("quince-message", "messages", 142, mainMessage, 290, null, 15, {
    semanticRole: "honoree_message",
    dataKey: clean(event.quince_message) ? "quince_message" : "main_message",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 18,
    fontStyle: "italic",
    color: "#fff7ef",
    lineHeight: 1.45,
  });
  if (parentsMessage) {
    card("parents-message-card", "messages", 330, 340, 180, 16);
    text("parents-message-title", "messages", 356, "Mensaje de los padres", 300, 24, 17, {
      fontSize: 10,
      fontWeight: "900",
      color: "#c8a96a",
      letterSpacing: 0.16,
    });
    text("parents-message", "messages", 398, parentsMessage, 290, null, 18, {
      semanticRole: "parents_message",
      dataKey: clean(event.parents_message) ? "parents_message" : "parents_names",
      lockedContent: true,
      fontSize: 15,
      color: "#e8e0cc",
      lineHeight: 1.42,
    });
  }

  card("church-card", "church", 92, 340, 214, 19);
  text("church-title", "church", 122, "Misa", 280, 36, 20, {
    semanticRole: "ceremony_place",
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    fontStyle: "italic",
    color: "#f8d9a0",
  });
  text("church-details", "church", 184, churchText, 300, null, 21, {
    semanticRole: "ceremony_place",
    dataKey: "church_name",
    lockedContent: true,
    fontSize: 15,
    color: "#e8e0cc",
    lineHeight: 1.45,
  });

  card("details-card", "details", 72, 340, 250, 22);
  text("details-label", "details", 104, "DETALLES DEL EVENTO", 300, 18, 23, {
    fontSize: 10,
    fontWeight: "900",
    color: "#c8a96a",
    letterSpacing: 0.16,
  });
  text("details-day", "details", 136, dateParts.day, 94, 64, 24, {
    semanticRole: "event_date",
    dataKey: "event_date",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 58,
    fontWeight: "500",
    color: "#fff7ef",
    lineHeight: 1,
  });
  text("details-month", "details", 162, dateParts.monthYear, 260, 24, 25, {
    semanticRole: "event_date",
    dataKey: "event_date",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    fontStyle: "italic",
    color: "#f4d28a",
  });
  text("details-address", "details", 218, detailsText || "Direccion por confirmar", 300, null, 26, {
    semanticRole: "event_address",
    dataKey: "address",
    lockedContent: true,
    fontSize: 13,
    color: "#d8cfbd",
    lineHeight: 1.35,
  });
  app("details-map", "details", 346, "maps", "Ver mapa", 230, 48, 27, mapsUrl);

  card("dress-card", "dresscode", 74, 340, 220, 28);
  text("dress-title", "dresscode", 106, "Dress code", 280, 34, 29, {
    semanticRole: "dress_code",
    fontFamily: DISPLAY_FONT,
    fontSize: 31,
    fontStyle: "italic",
    color: "#fff7ef",
  });
  text("dress-details", "dresscode", 160, dressText, 300, null, 30, {
    semanticRole: "dress_code",
    dataKey: "dress_code",
    lockedContent: true,
    fontSize: 13,
    color: "#d8cfbd",
    lineHeight: 1.38,
  });

  text("rsvp-title", "rsvp", 92, "Confirma tu asistencia", 340, 42, 31, {
    semanticRole: "rsvp_action",
    fontFamily: DISPLAY_FONT,
    fontSize: 31,
    fontStyle: "italic",
    color: "#f8d9a0",
  });
  app("rsvp-app", "rsvp", 220, "rsvp", "Confirmar asistencia", 320, 64, 32);
  text("package-note", "rsvp", 520, `Plan ${clean(event.package_key) || "KAIS"}`, 260, 24, 34, {
    semanticRole: "package_note",
    dataKey: "package_key",
    lockedContent: true,
    fontSize: 11,
    fontWeight: "800",
    color: "#c8a96a",
    letterSpacing: 0.12,
  });

  text("footer-title", "footer", 86, title, 320, null, 35, {
    semanticRole: "honoree_name",
    dataKey: "quinceanera_name",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 30,
    fontStyle: "italic",
    color: "#fff7ef",
  });

  const height = sections.at(-1)!.y + sections.at(-1)!.height;
  return {
    version: 3,
    viewport: "mobile",
    width: CANVAS_W,
    height,
    themeId: "kais-luxury",
    sections,
    elements,
  };
}
