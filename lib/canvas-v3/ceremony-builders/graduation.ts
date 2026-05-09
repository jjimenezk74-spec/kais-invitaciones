import type { CanvasV3AppType, CanvasV3Design, CanvasV3Element, CanvasV3EventData, CanvasV3Section } from "../initial-design";

const CANVAS_W = 390;
const DISPLAY_FONT = "'Playfair Display', Georgia, serif";
const BODY_FONT = "Inter, system-ui, sans-serif";

const SECTION_VISUALS: Array<Pick<CanvasV3Section, "id" | "label" | "height" | "background" | "kind" | "required" | "sourceEventType">> = [
  { id: "hero", label: "Portada", height: 820, background: "linear-gradient(180deg,#060b18 0%,#111827 52%,#080a10 100%)", kind: "hero", required: true, sourceEventType: "graduation" },
  { id: "countdown", label: "Cuenta regresiva", height: 380, background: "linear-gradient(180deg,#080a10,#101827)", kind: "countdown", required: true, sourceEventType: "graduation" },
  { id: "presentation", label: "Graduado", height: 540, background: "linear-gradient(180deg,#101827,#080d18)", kind: "person_presentation", required: true, sourceEventType: "graduation" },
  { id: "academic_ceremony", label: "Acto academico", height: 520, background: "linear-gradient(180deg,#080d18,#12141c)", kind: "academic_ceremony", required: true, sourceEventType: "graduation" },
  { id: "reception", label: "Recepcion", height: 460, background: "linear-gradient(180deg,#12141c,#090d16)", kind: "reception", required: false, sourceEventType: "graduation" },
  { id: "graduate_message", label: "Mensaje del graduado", height: 520, background: "linear-gradient(180deg,#090d16,#111827)", kind: "message", required: false, sourceEventType: "graduation" },
  { id: "family_message", label: "Mensaje familiar", height: 500, background: "linear-gradient(180deg,#111827,#0b101a)", kind: "parents_message", required: false, sourceEventType: "graduation" },
  { id: "dress_code", label: "Vestimenta", height: 420, background: "linear-gradient(180deg,#0b101a,#10131b)", kind: "dress_code", required: false, sourceEventType: "graduation" },
  { id: "location", label: "Ubicacion", height: 520, background: "linear-gradient(180deg,#10131b,#080a10)", kind: "event_details", required: true, sourceEventType: "graduation" },
  { id: "rsvp", label: "Confirmacion", height: 520, background: "linear-gradient(180deg,#080a10,#111827)", kind: "rsvp", required: true, sourceEventType: "graduation" },
  { id: "footer", label: "Cierre", height: 260, background: "linear-gradient(180deg,#111827,#05070d)", kind: "footer", required: true, sourceEventType: "graduation" },
];

function buildSections(): CanvasV3Section[] {
  let y = 0;
  return SECTION_VISUALS.map((section) => {
    const next: CanvasV3Section = {
      id: section.id,
      label: section.label,
      y,
      height: section.height,
      background: section.background,
      kind: section.kind,
      required: section.required,
      sourceEventType: section.sourceEventType,
    };
    y += section.height;
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

function formatGraduationType(value?: string | null) {
  const map: Record<string, string> = {
    high_school: "Graduacion secundaria",
    university: "Graduacion universitaria",
    technical: "Graduacion tecnica",
    kindergarten: "Graduacion de kinder",
    primary: "Graduacion primaria",
    postgraduate: "Graduacion de postgrado",
    course: "Certificacion de curso",
    general: "Graduacion",
  };
  const key = clean(value);
  return map[key] ?? "Graduacion";
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

export function createGraduationCanvasV3Design(event: CanvasV3EventData): CanvasV3Design {
  const sections = buildSections();
  const graduateName = clean(event.graduate_name) || clean(event.hosts_names) || clean(event.title) || "Graduacion";
  const graduationType = formatGraduationType(event.graduation_type);
  const institution = clean(event.institution_name) || "Institucion por confirmar";
  const academicProgram = clean(event.academic_program);
  const degreeTitle = clean(event.degree_title);
  const promotionName = clean(event.promotion_name);
  const dateLabel = formatDateLabel(event.event_date, event.event_time);
  const ceremonyPlace = clean(event.academic_ceremony_place) || clean(event.address) || "Lugar del acto por confirmar";
  const ceremonyTime = clean(event.academic_ceremony_time) || clean(event.event_time);
  const receptionPlace = clean(event.reception_place) || clean(event.address);
  const receptionTime = clean(event.reception_time) || clean(event.event_time);
  const graduateMessage = clean(event.graduate_message) || clean(event.main_message) || "Gracias por acompanarme en este logro.";
  const familyMessage = clean(event.family_message) || "Celebramos este logro con gratitud, orgullo y alegria.";
  const dressText = [
    clean(event.dress_code),
    clean(event.color_palette) ? `Colores: ${clean(event.color_palette)}` : "",
    clean(event.theme) ? `Estilo: ${clean(event.theme)}` : "",
  ].filter(Boolean).join("\n") || "Vestimenta por confirmar";
  const locationText = [
    dateLabel,
    clean(event.address) || ceremonyPlace,
  ].filter(Boolean).join("\n");
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
      color: "#f7f0df",
      lineHeight: 1.35,
      letterSpacing: 0,
      textShadow: "0 2px 14px rgba(0,0,0,0.56)",
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
      background: "linear-gradient(135deg,rgba(255,255,255,0.08),rgba(212,175,55,0.08))",
      border: "1px solid rgba(212,175,55,0.28)",
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
      background: "linear-gradient(135deg,#d4af37,#9b7a22)",
      color: "#07111f",
      borderRadius: 16,
      opacity: 1,
      config: {
        url,
        primaryColor: "linear-gradient(135deg,#d4af37,#9b7a22)",
        textColor: "#07111f",
        countdownMode: appType === "countdown" ? "event" : undefined,
        countdownTarget: appType === "countdown" ? target : undefined,
      },
    });
  };

  card("grad-hero-bg", "hero", 0, 390, 820, 0, {
    locked: true,
    borderRadius: 0,
    border: undefined,
    background: sections.find((section) => section.id === "hero")?.background,
  });
  card("grad-hero-glow", "hero", 214, 300, 300, 1, {
    background: "radial-gradient(circle,#d4af3744 0%,#1e40af22 48%,transparent 72%)",
    borderRadius: 999,
    border: undefined,
    blur: 14,
    opacity: 0.78,
  });
  text("grad-hero-type", "hero", 118, graduationType.toUpperCase(), 300, 22, 2, {
    semanticRole: "graduation_subtype",
    dataKey: "graduation_type",
    lockedContent: true,
    fontSize: 11,
    fontWeight: "800",
    color: "#d4af37",
    letterSpacing: 0.16,
  });
  text("grad-hero-name", "hero", 160, graduateName, 356, null, 3, {
    semanticRole: "graduate_name",
    dataKey: "graduate_name",
    lockedContent: true,
    fontSize: graduateName.length > 22 ? 44 : 56,
    fontFamily: DISPLAY_FONT,
    fontWeight: "500",
    color: "#fff8e6",
    lineHeight: 1,
  });
  text("grad-hero-program", "hero", 286, [degreeTitle, academicProgram].filter(Boolean).join("\n") || "Logro academico", 320, null, 4, {
    semanticRole: "graduation_program",
    dataKey: degreeTitle ? "degree_title" : "academic_program",
    lockedContent: true,
    fontSize: 15,
    color: "#d8cfbd",
    lineHeight: 1.42,
  });
  text("grad-hero-institution", "hero", 372, institution, 330, null, 5, {
    semanticRole: "institution_name",
    dataKey: "institution_name",
    lockedContent: true,
    fontSize: 17,
    fontFamily: DISPLAY_FONT,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-hero-date", "hero", 446, dateLabel, 340, 30, 6, {
    semanticRole: "event_date",
    dataKey: "event_date",
    lockedContent: true,
    fontSize: 14,
    color: "#f7f0df",
  });
  app("grad-hero-countdown", "hero", 560, "countdown", "", 340, 72, 7);

  text("grad-countdown-title", "countdown", 62, "La cuenta final", 320, 42, 8, {
    semanticRole: "countdown",
    fontFamily: DISPLAY_FONT,
    fontSize: 34,
    fontStyle: "italic",
    color: "#f5d782",
  });
  app("grad-countdown-app", "countdown", 138, "countdown", "", 340, 80, 9);
  text("grad-countdown-caption", "countdown", 248, "para celebrar este logro", 300, 24, 10, {
    fontSize: 13,
    color: "#b9c2d6",
    letterSpacing: 0.08,
  });

  card("grad-presentation-card", "presentation", 78, 340, 340, 11);
  text("grad-presentation-label", "presentation", 112, "GRADUADO", 280, 18, 12, {
    fontSize: 10,
    fontWeight: "900",
    color: "#d4af37",
    letterSpacing: 0.16,
  });
  text("grad-presentation-name", "presentation", 152, graduateName, 310, null, 13, {
    semanticRole: "graduate_name",
    dataKey: "graduate_name",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 38,
    color: "#fff8e6",
  });
  text("grad-presentation-details", "presentation", 248, [academicProgram, degreeTitle].filter(Boolean).join("\n") || "Trayectoria academica", 300, null, 14, {
    semanticRole: "graduation_program",
    dataKey: academicProgram ? "academic_program" : "degree_title",
    lockedContent: true,
    fontSize: 15,
    color: "#d8cfbd",
    lineHeight: 1.45,
  });
  if (promotionName) {
    text("grad-promotion-name", "presentation", 336, promotionName, 300, 24, 15, {
      semanticRole: "graduation_program",
      dataKey: "promotion_name",
      lockedContent: true,
      fontSize: 12,
      fontWeight: "800",
      color: "#d4af37",
      letterSpacing: 0.1,
    });
  }

  card("grad-ceremony-card", "academic_ceremony", 74, 340, 300, 15);
  text("grad-ceremony-title", "academic_ceremony", 106, "Acto academico", 300, 38, 16, {
    semanticRole: "academic_ceremony",
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-ceremony-place", "academic_ceremony", 174, ceremonyPlace, 300, null, 17, {
    semanticRole: "academic_ceremony",
    dataKey: "academic_ceremony_place",
    lockedContent: true,
    fontSize: 15,
    color: "#f7f0df",
    lineHeight: 1.4,
  });
  text("grad-ceremony-time", "academic_ceremony", 262, ceremonyTime ? `${ceremonyTime} hs` : "Hora por confirmar", 260, 28, 18, {
    semanticRole: "academic_ceremony",
    dataKey: "academic_ceremony_time",
    lockedContent: true,
    fontSize: 14,
    color: "#d4af37",
  });

  card("grad-reception-card", "reception", 72, 340, 250, 19);
  text("grad-reception-title", "reception", 104, "Recepcion", 300, 38, 20, {
    semanticRole: "reception_place",
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-reception-place", "reception", 174, receptionPlace || "Recepcion por confirmar", 300, null, 21, {
    semanticRole: "reception_place",
    dataKey: "reception_place",
    lockedContent: true,
    fontSize: 15,
    color: "#f7f0df",
    lineHeight: 1.4,
  });
  text("grad-reception-time", "reception", 250, receptionTime ? `${receptionTime} hs` : "Hora por confirmar", 260, 28, 22, {
    semanticRole: "reception_place",
    dataKey: "reception_time",
    lockedContent: true,
    fontSize: 14,
    color: "#d4af37",
  });

  card("grad-message-card", "graduate_message", 74, 340, 270, 23);
  text("grad-message-title", "graduate_message", 106, "Mensaje del graduado", 300, 24, 24, {
    fontSize: 10,
    fontWeight: "900",
    color: "#d4af37",
    letterSpacing: 0.16,
  });
  text("grad-message-copy", "graduate_message", 154, graduateMessage, 292, null, 25, {
    semanticRole: "honoree_message",
    dataKey: clean(event.graduate_message) ? "graduate_message" : "main_message",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    fontStyle: "italic",
    color: "#fff8e6",
    lineHeight: 1.45,
  });

  card("grad-family-card", "family_message", 72, 340, 250, 26);
  text("grad-family-title", "family_message", 104, "Mensaje familiar", 300, 24, 27, {
    fontSize: 10,
    fontWeight: "900",
    color: "#d4af37",
    letterSpacing: 0.16,
  });
  text("grad-family-copy", "family_message", 152, familyMessage, 292, null, 28, {
    semanticRole: "parents_message",
    dataKey: "family_message",
    lockedContent: true,
    fontSize: 16,
    color: "#f7f0df",
    lineHeight: 1.45,
  });

  card("grad-dress-card", "dress_code", 72, 340, 220, 29);
  text("grad-dress-title", "dress_code", 104, "Codigo de vestimenta", 300, 34, 30, {
    semanticRole: "dress_code",
    fontFamily: DISPLAY_FONT,
    fontSize: 29,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-dress-copy", "dress_code", 162, dressText, 300, null, 31, {
    semanticRole: "dress_code",
    dataKey: "dress_code",
    lockedContent: true,
    fontSize: 13,
    color: "#d8cfbd",
    lineHeight: 1.38,
  });

  card("grad-location-card", "location", 70, 340, 260, 32);
  text("grad-location-title", "location", 102, "Ubicacion", 300, 36, 33, {
    semanticRole: "event_address",
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-location-copy", "location", 166, locationText, 300, null, 34, {
    semanticRole: "event_address",
    dataKey: "address",
    lockedContent: true,
    fontSize: 14,
    color: "#f7f0df",
    lineHeight: 1.4,
  });
  app("grad-location-map", "location", 360, "maps", "Ver mapa", 230, 48, 35, mapsUrl);

  text("grad-rsvp-title", "rsvp", 86, "Confirma tu asistencia", 340, 42, 36, {
    semanticRole: "rsvp_action",
    fontFamily: DISPLAY_FONT,
    fontSize: 31,
    fontStyle: "italic",
    color: "#f5d782",
  });
  app("grad-rsvp-app", "rsvp", 176, "rsvp", "Confirmar asistencia", 320, 64, 37);
  if (waUrl) app("grad-whatsapp-app", "rsvp", 260, "whatsapp", "Enviar WhatsApp", 320, 60, 38, waUrl);
  text("grad-package-note", "rsvp", 374, `Plan ${clean(event.package_key) || "KAIS"}`, 260, 24, 39, {
    semanticRole: "package_note",
    dataKey: "package_key",
    lockedContent: true,
    fontSize: 11,
    fontWeight: "800",
    color: "#d4af37",
    letterSpacing: 0.12,
  });

  text("grad-footer-name", "footer", 72, graduateName, 320, null, 40, {
    semanticRole: "graduate_name",
    dataKey: "graduate_name",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 30,
    fontStyle: "italic",
    color: "#fff8e6",
  });
  text("grad-footer-inst", "footer", 142, institution, 320, null, 41, {
    semanticRole: "institution_name",
    dataKey: "institution_name",
    lockedContent: true,
    fontSize: 12,
    color: "#d4af37",
    letterSpacing: 0.08,
  });

  const lastSection = sections.at(-1)!;
  return {
    version: 3,
    viewport: "mobile",
    width: CANVAS_W,
    height: lastSection.y + lastSection.height,
    themeId: "elegant-black",
    sections,
    elements,
  };
}
