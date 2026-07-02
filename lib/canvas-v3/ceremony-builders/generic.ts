import type { CanvasV3AppType, CanvasV3Design, CanvasV3Element, CanvasV3EventData, CanvasV3Section } from "../initial-design";
import type { CanvasV3EventType, CeremonySectionKind, CeremonySemanticRole } from "../ceremonial-structures";

const CANVAS_W = 390;
const BODY_FONT = "Inter, system-ui, sans-serif";

type GenericSpec = {
  eventType: Exclude<CanvasV3EventType, "quinceanios" | "graduation">;
  themeId: CanvasV3Design["themeId"];
  label: string;
  heroTitle: string;
  heroRole: CeremonySemanticRole;
  accent: string;
  accent2: string;
  ink: string;
  dark: string;
  paper: string;
  titleFont: string;
  titleSize: number;
  intro: string;
  detailsTitle: string;
  messageTitle: string;
  footer: string;
};

const SPECS: Record<GenericSpec["eventType"], GenericSpec> = {
  wedding: {
    eventType: "wedding",
    themeId: "champagne-classic",
    label: "BODA",
    heroTitle: "Boda",
    heroRole: "couple_names",
    accent: "#c7a56b",
    accent2: "#ead8b7",
    ink: "#fff7ea",
    dark: "#171018",
    paper: "#fffaf1",
    titleFont: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    titleSize: 46,
    intro: "Una celebración para compartir este sí con las personas más importantes.",
    detailsTitle: "Ceremonia y celebración",
    messageTitle: "Con mucho cariño",
    footer: "Gracias por acompañarnos",
  },
  baptism: {
    eventType: "baptism",
    themeId: "champagne-classic",
    label: "BAUTISMO",
    heroTitle: "Bautismo",
    heroRole: "baby_name",
    accent: "#d9c4a6",
    accent2: "#f4e8d8",
    ink: "#fffaf4",
    dark: "#17212a",
    paper: "#fffdf7",
    titleFont: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    titleSize: 42,
    intro: "Un día de bendición para celebrar en familia.",
    detailsTitle: "Ceremonia",
    messageTitle: "Un momento especial",
    footer: "Gracias por ser parte",
  },
  kids_birthday: {
    eventType: "kids_birthday",
    themeId: "romantic-garden",
    label: "CUMPLEAÑOS",
    heroTitle: "Cumpleaños infantil",
    heroRole: "birthday_person_name",
    accent: "#ffb86b",
    accent2: "#9fe7dc",
    ink: "#fffdf8",
    dark: "#152135",
    paper: "#fff7ec",
    titleFont: "'Baloo 2', 'Fredoka', Inter, system-ui, sans-serif",
    titleSize: 42,
    intro: "Una tarde llena de alegría, juegos y recuerdos bonitos.",
    detailsTitle: "Fiesta",
    messageTitle: "Te esperamos",
    footer: "Será más lindo contigo",
  },
  birthday: {
    eventType: "birthday",
    themeId: "elegant-black",
    label: "CUMPLEAÑOS",
    heroTitle: "Cumpleaños",
    heroRole: "birthday_person_name",
    accent: "#d6b36d",
    accent2: "#8a5bff",
    ink: "#fff6e8",
    dark: "#111827",
    paper: "#f7efe3",
    titleFont: "'Playfair Display', Georgia, serif",
    titleSize: 46,
    intro: "Una noche para celebrar vida, amistad y nuevos recuerdos.",
    detailsTitle: "Celebración",
    messageTitle: "Celebremos juntos",
    footer: "Tu presencia hace la diferencia",
  },
  baby_shower: {
    eventType: "baby_shower",
    themeId: "floral-rose",
    label: "BABY SHOWER",
    heroTitle: "Baby shower",
    heroRole: "baby_name",
    accent: "#dca98d",
    accent2: "#f6d8cf",
    ink: "#fffaf7",
    dark: "#271821",
    paper: "#fff7f1",
    titleFont: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    titleSize: 43,
    intro: "Una dulce espera para compartir amor, familia y buenos deseos.",
    detailsTitle: "Encuentro",
    messageTitle: "Con mucho amor",
    footer: "Gracias por acompañarnos",
  },
  corporate: {
    eventType: "corporate",
    themeId: "elegant-black",
    label: "EVENTO CORPORATIVO",
    heroTitle: "Evento corporativo",
    heroRole: "event_title",
    accent: "#7dd3fc",
    accent2: "#c7a56b",
    ink: "#f8fbff",
    dark: "#0b1220",
    paper: "#f7f8fb",
    titleFont: "Montserrat, Inter, system-ui, sans-serif",
    titleSize: 35,
    intro: "Un encuentro diseñado para conectar, presentar y avanzar.",
    detailsTitle: "Agenda y lugar",
    messageTitle: "Información importante",
    footer: "KAIS Invitaciones",
  },
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cx(width: number) {
  return Math.round((CANVAS_W - width) / 2);
}

function safeExternalUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^(https?:\/\/|\/)/i.test(raw) && !/^(blob:|data:)/i.test(raw)) return raw;
  return "";
}

function formatDateLabel(date?: string | null, time?: string | null) {
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T00:00:00`);
  const label = Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("es-PY", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
  return time ? `${label} - ${time} hs` : label;
}

function eventDateTime(event: CanvasV3EventData) {
  return event.event_date && event.event_time ? `${event.event_date}T${event.event_time}` : undefined;
}

function titleFor(event: CanvasV3EventData, spec: GenericSpec) {
  return clean(event.hosts_names) || clean(event.title) || spec.heroTitle;
}

function detailsPlace(event: CanvasV3EventData, spec: GenericSpec) {
  return clean(event.address) || `${spec.detailsTitle} por confirmar`;
}

function makeSections(spec: GenericSpec): CanvasV3Section[] {
  const defs: Array<[string, string, CeremonySectionKind, number, string, boolean]> = [
    ["hero", "Portada", "hero", 760, `linear-gradient(180deg,${spec.dark} 0%,#201325 54%,${spec.dark} 100%)`, true],
    ["presentation", "Presentación", "person_presentation", 500, `linear-gradient(180deg,${spec.dark},#111722)`, true],
    ["details", "Detalles", "event_details", 560, `linear-gradient(180deg,#111722,${spec.dark})`, true],
    ["message", "Mensaje", "message", 520, `linear-gradient(180deg,${spec.dark},#191320)`, false],
    ["rsvp", "Confirmación", "rsvp", 500, `linear-gradient(180deg,#191320,#10141d)`, true],
    ["footer", "Cierre", "footer", 300, `linear-gradient(180deg,#10141d,${spec.dark})`, true],
  ];
  let y = 0;
  return defs.map(([id, label, kind, height, background, required]) => {
    const section = { id, label, y, height, background, kind, required, sourceEventType: spec.eventType };
    y += height;
    return section;
  });
}

function createElementFactory(spec: GenericSpec) {
  let zIndex = 1;
  const nextZ = () => zIndex++;
  return {
    text(id: string, sectionY: number, content: string, x: number, y: number, width: number, height: number, extra: Partial<CanvasV3Element> = {}): CanvasV3Element {
      return {
        id,
        type: "text",
        x,
        y: sectionY + y,
        width,
        height,
        locked: false,
        visible: true,
        zIndex: nextZ(),
        content,
        fontSize: 15,
        fontFamily: BODY_FONT,
        fontWeight: "500",
        color: spec.ink,
        textAlign: "center",
        lineHeight: 1.42,
        verticalAlign: "center",
        ...extra,
      };
    },
    shape(id: string, sectionY: number, x: number, y: number, width: number, height: number, background: string, extra: Partial<CanvasV3Element> = {}): CanvasV3Element {
      return {
        id,
        type: "decoration",
        x,
        y: sectionY + y,
        width,
        height,
        locked: false,
        visible: true,
        zIndex: nextZ(),
        background,
        borderRadius: 26,
        opacity: 1,
        ...extra,
      };
    },
    app(id: string, appType: CanvasV3AppType, sectionY: number, content: string, x: number, y: number, width: number, height: number, extra: Partial<CanvasV3Element> = {}): CanvasV3Element {
      return {
        id,
        type: "app",
        appKind: appType,
        appType,
        x,
        y: sectionY + y,
        width,
        height,
        locked: false,
        visible: true,
        zIndex: nextZ(),
        content,
        background: appType === "whatsapp" ? "linear-gradient(135deg,#25d366,#128c7e)" : `linear-gradient(135deg,${spec.accent},${spec.dark})`,
        color: appType === "rsvp" ? "#151010" : "#fffdf7",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.25)",
        config: { url: "", primaryColor: appType === "whatsapp" ? "#25d366" : spec.accent, textColor: appType === "rsvp" ? "#151010" : "#fffdf7" },
        semanticRole: appType === "countdown" ? "countdown" : appType === "maps" ? "maps_link" : appType === "whatsapp" ? "whatsapp_action" : "rsvp_action",
        dataKey: appType === "countdown" ? "event_date" : appType === "maps" ? "google_maps_link" : appType === "whatsapp" ? "whatsapp_phone" : "package_key",
        lockedContent: true,
        ...extra,
      };
    },
  };
}

export function createGenericCeremonyCanvasV3Design(event: CanvasV3EventData, eventType: GenericSpec["eventType"]): CanvasV3Design {
  const spec = SPECS[eventType];
  const sections = makeSections(spec);
  const top = (id: string) => sections.find((section) => section.id === id)?.y ?? 0;
  const make = createElementFactory(spec);
  const title = titleFor(event, spec);
  const dateLine = formatDateLabel(event.event_date, event.event_time);
  const mainMessage = clean(event.main_message) || spec.intro;
  const styleLine = [clean(event.theme), clean(event.color_palette)].filter(Boolean).join(" · ") || "Estilo por definir";
  const mapsUrl = safeExternalUrl(event.google_maps_link);
  const countdownTarget = eventDateTime(event);

  const elements: CanvasV3Element[] = [];

  elements.push(make.shape("generic-hero-atmosphere", top("hero"), -110, 20, 610, 560, `radial-gradient(ellipse at 42% 36%,${spec.accent}38 0%,${spec.accent2}22 30%,transparent 74%),radial-gradient(ellipse at 74% 66%,${spec.accent2}20 0%,transparent 64%)`, { blur: 8, opacity: 0.82, config: { effect: "ambient-glow", color: spec.accent, accentColor: spec.accent2, intensity: 0.45, blendWithBackground: true } }));
  elements.push(make.shape("generic-hero-rule", top("hero"), cx(230), 76, 230, 1, `linear-gradient(90deg,transparent,${spec.accent},transparent)`, { borderRadius: 0, opacity: 0.76 }));
  elements.push(make.text("generic-hero-kicker", top("hero"), spec.label, cx(260), 116, 260, 32, { fontSize: 11, fontWeight: "800", letterSpacing: 0.32, color: spec.accent, semanticRole: "event_type", lockedContent: true }));
  elements.push(make.text("generic-hero-title", top("hero"), title, cx(338), 172, 338, 146, { fontSize: spec.titleSize, fontFamily: spec.titleFont, fontWeight: "700", lineHeight: 1.2, textShadow: "0 8px 28px rgba(0,0,0,0.42)", semanticRole: spec.heroRole, dataKey: "hosts_names", lockedContent: true }));
  elements.push(make.text("generic-hero-date", top("hero"), dateLine, cx(300), 334, 300, 54, { fontSize: 14, fontWeight: "700", color: spec.accent, semanticRole: "event_date", dataKey: "event_date", lockedContent: true }));
  elements.push(make.text("generic-hero-message", top("hero"), mainMessage, cx(318), 440, 318, 132, { fontSize: 17, fontFamily: spec.titleFont, lineHeight: 1.48, color: spec.ink, semanticRole: "main_message", dataKey: "main_message", lockedContent: true, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 24 }));
  elements.push(make.app("generic-hero-countdown", "countdown", top("hero"), "", cx(310), 626, 310, 66, { config: { countdownTarget, countdownMode: "event", primaryColor: spec.accent, textColor: spec.ink }, background: "rgba(255,255,255,0.10)", color: spec.ink }));

  elements.push(make.text("generic-intro-kicker", top("presentation"), "PRESENTACIÓN", cx(224), 48, 224, 28, { fontSize: 10, fontWeight: "800", letterSpacing: 0.28, color: spec.accent, lockedContent: true }));
  elements.push(make.text("generic-intro-title", top("presentation"), title, cx(318), 92, 318, 104, { fontSize: Math.max(32, spec.titleSize - 8), fontFamily: spec.titleFont, lineHeight: 1.24, semanticRole: spec.heroRole, dataKey: "hosts_names", lockedContent: true }));
  elements.push(make.text("generic-intro-copy", top("presentation"), spec.intro, cx(316), 224, 316, 112, { fontSize: 16, color: "rgba(255,247,236,0.78)", lineHeight: 1.52 }));
  elements.push(make.text("generic-intro-style", top("presentation"), styleLine, cx(306), 370, 306, 54, { fontSize: 13, color: spec.accent, semanticRole: "theme", dataKey: "theme", lockedContent: true }));

  elements.push(make.text("generic-details-title", top("details"), spec.detailsTitle, cx(320), 52, 320, 90, { fontSize: Math.max(30, spec.titleSize - 10), fontFamily: spec.titleFont, lineHeight: 1.26, semanticRole: "ceremony_place" }));
  elements.push(make.text("generic-details-date", top("details"), dateLine, cx(306), 152, 306, 54, { fontSize: 15, fontWeight: "700", color: spec.accent, semanticRole: "event_date", dataKey: "event_date", lockedContent: true }));
  elements.push(make.text("generic-details-place", top("details"), detailsPlace(event, spec), cx(316), 232, 316, 84, { fontSize: 17, fontFamily: spec.titleFont, color: "rgba(255,247,236,0.82)", lineHeight: 1.42, semanticRole: "event_address", dataKey: "address", lockedContent: true }));
  elements.push(make.app("generic-details-map", "maps", top("details"), "Ver ubicación", cx(250), 350, 250, 56, { config: { url: mapsUrl, primaryColor: spec.accent, textColor: spec.ink }, background: "rgba(255,255,255,0.10)", color: spec.ink }));
  elements.push(make.text("generic-details-dress", top("details"), clean(event.dress_code) || "Dress code por confirmar", cx(300), 438, 300, 58, { fontSize: 13, color: spec.accent, semanticRole: "dress_code", dataKey: "dress_code", lockedContent: true }));

  elements.push(make.text("generic-message-kicker", top("message"), "MENSAJE", cx(178), 48, 178, 28, { fontSize: 10, fontWeight: "800", letterSpacing: 0.32, color: spec.accent }));
  elements.push(make.text("generic-message-title", top("message"), spec.messageTitle, cx(318), 92, 318, 86, { fontSize: Math.max(30, spec.titleSize - 12), fontFamily: spec.titleFont, lineHeight: 1.28 }));
  elements.push(make.text("generic-message-copy", top("message"), mainMessage, cx(320), 204, 320, 160, { fontSize: 19, fontFamily: spec.titleFont, color: "rgba(255,247,236,0.9)", lineHeight: 1.5, semanticRole: "main_message", dataKey: "main_message", lockedContent: true }));

  elements.push(make.text("generic-rsvp-title", top("rsvp"), "Confirmar asistencia", cx(318), 54, 318, 104, { fontSize: Math.max(30, spec.titleSize - 9), fontFamily: spec.titleFont, fontWeight: "700", lineHeight: 1.32, semanticRole: "rsvp_action" }));
  elements.push(make.app("generic-rsvp-action", "rsvp", top("rsvp"), "Confirmar asistencia", cx(304), 186, 304, 62));
  elements.push(make.app("generic-rsvp-whatsapp", "whatsapp", top("rsvp"), "Enviar WhatsApp", cx(270), 272, 270, 60));

  elements.push(make.text("generic-footer-title", top("footer"), spec.footer, cx(320), 70, 320, 98, { fontSize: 26, fontFamily: spec.titleFont, lineHeight: 1.34 }));
  elements.push(make.text("generic-footer-name", top("footer"), title, cx(280), 176, 280, 56, { fontSize: 16, fontWeight: "700", color: spec.accent, semanticRole: spec.heroRole, dataKey: "hosts_names", lockedContent: true }));

  return {
    version: 3,
    viewport: "mobile",
    width: CANVAS_W,
    height: sections.reduce((max, section) => Math.max(max, section.y + section.height), 0),
    themeId: spec.themeId,
    sections,
    elements,
  };
}
