import type { CanvasV3AppType, CanvasV3Design, CanvasV3Element, CanvasV3EventData, CanvasV3Section } from "../initial-design";

const CANVAS_W = 390;
const DISPLAY_FONT = "'Playfair Display', Georgia, serif";
const BODY_FONT = "Inter, system-ui, sans-serif";

const SECTION_VISUALS: Array<Pick<CanvasV3Section, "id" | "label" | "height" | "background" | "kind" | "required" | "sourceEventType">> = [
  { id: "hero", label: "Portada", height: 820, background: "linear-gradient(180deg,#030712 0%,#0f172a 48%,#070a12 100%)", kind: "hero", required: true, sourceEventType: "graduation" },
  { id: "presentation", label: "Presentación", height: 520, background: "linear-gradient(180deg,#070a12,#111827 62%,#080c15)", kind: "person_presentation", required: true, sourceEventType: "graduation" },
  { id: "achievement", label: "Sello académico", height: 380, background: "linear-gradient(180deg,#080c15,#101827)", kind: "academic_ceremony", required: true, sourceEventType: "graduation" },
  { id: "academic_ceremony", label: "Acto académico", height: 500, background: "linear-gradient(180deg,#101827,#0b1020)", kind: "academic_ceremony", required: true, sourceEventType: "graduation" },
  { id: "reception", label: "Recepción", height: 420, background: "linear-gradient(180deg,#0b1020,#12141c)", kind: "reception", required: false, sourceEventType: "graduation" },
  { id: "message", label: "Mensaje principal", height: 560, background: "linear-gradient(180deg,#12141c,#080d18)", kind: "message", required: false, sourceEventType: "graduation" },
  { id: "dress_code", label: "Vestimenta", height: 400, background: "linear-gradient(180deg,#080d18,#10131b)", kind: "dress_code", required: false, sourceEventType: "graduation" },
  { id: "location", label: "Ubicación", height: 520, background: "linear-gradient(180deg,#10131b,#070a12)", kind: "event_details", required: true, sourceEventType: "graduation" },
  { id: "rsvp", label: "Confirmación", height: 500, background: "linear-gradient(180deg,#070a12,#111827)", kind: "rsvp", required: true, sourceEventType: "graduation" },
  { id: "footer", label: "Cierre", height: 360, background: "linear-gradient(180deg,#111827,#030712)", kind: "footer", required: true, sourceEventType: "graduation" },
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
    high_school: "Graduación secundaria",
    university: "Graduación universitaria",
    technical: "Graduación técnica",
    kindergarten: "Graduación de kinder",
    primary: "Graduación primaria",
    postgraduate: "Graduación de postgrado",
    course: "Certificación de curso",
    general: "Graduación",
  };
  const key = clean(value);
  return map[key] ?? "Graduación";
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function areSimilarAcademicTerms(left: string, right: string) {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length > 5 && b.length > 5 && (a.startsWith(b.slice(0, -1)) || b.startsWith(a.slice(0, -1)));
}

function academicLine(degreeTitle: string, academicProgram: string) {
  if (degreeTitle && academicProgram && areSimilarAcademicTerms(degreeTitle, academicProgram)) return degreeTitle;
  return degreeTitle || academicProgram || "Logro académico";
}

function subtitleLine(degreeTitle: string, academicProgram: string) {
  if (!degreeTitle || !academicProgram || areSimilarAcademicTerms(degreeTitle, academicProgram)) return "";
  return academicProgram;
}

function achievementSummary(degreeTitle: string, academicProgram: string, _promotionName: string) {
  return [academicLine(degreeTitle, academicProgram), subtitleLine(degreeTitle, academicProgram)]
    .filter(Boolean)
    .slice(0, 2)
    .join("\n");
}

function institutionLine(institution: string, dateLabel?: string) {
  return [institution, dateLabel].filter(Boolean).join(" · ");
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
  const graduateName = clean(event.graduate_name) || clean(event.hosts_names) || clean(event.title) || "Graduación";
  const graduationType = formatGraduationType(event.graduation_type);
  const institution = clean(event.institution_name) || "Institución por confirmar";
  const academicProgram = clean(event.academic_program);
  const degreeTitle = clean(event.degree_title);
  const promotionName = clean(event.promotion_name);
  const dateLabel = formatDateLabel(event.event_date, event.event_time);
  const ceremonyPlace = clean(event.academic_ceremony_place) || clean(event.address) || "Lugar del acto por confirmar";
  const ceremonyTime = clean(event.academic_ceremony_time) || clean(event.event_time);
  const receptionPlace = clean(event.reception_place) || clean(event.address);
  const receptionTime = clean(event.reception_time) || clean(event.event_time);
  const graduateMessage =
    clean(event.graduate_message) ||
    clean(event.main_message) ||
    "Una noche para celebrar años de esfuerzo, aprendizaje y nuevos comienzos.";
  const familyMessage = clean(event.family_message) || "Acompáñanos a compartir este logro tan especial.";
  const dressLines = [
    clean(event.dress_code),
    clean(event.color_palette) ? `Colores: ${clean(event.color_palette)}` : "",
    clean(event.theme) ? `Estilo: ${clean(event.theme)}` : "",
  ].filter(Boolean);
  const hasDressDetails = dressLines.length > 0;
  const dressText = dressLines.join("\n") || "Vestimenta sugerida por confirmar";
  const academicMain = academicLine(degreeTitle, academicProgram);
  const academicSubtitle = subtitleLine(degreeTitle, academicProgram);
  const achievementText = achievementSummary(degreeTitle, academicProgram, promotionName);
  const heroInstitutionLine = institutionLine(institution, promotionName || undefined);
  const locationText = [dateLabel, clean(event.address) || ceremonyPlace].filter(Boolean).join("\n");
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

  const block = (id: string, sectionId: string, y: number, width: number, height: number, zIndex: number, extra: Partial<CanvasV3Element> = {}) => {
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
      border: "1px solid rgba(212,175,55,0.26)",
      borderRadius: 22,
      opacity: 1,
      ...extra,
    });
  };

  const line = (id: string, sectionId: string, y: number, width: number, zIndex: number, opacity = 0.72) => {
    block(id, sectionId, y, width, 1, zIndex, {
      background: "linear-gradient(90deg,transparent,#d4af37,transparent)",
      border: undefined,
      borderRadius: 999,
      opacity,
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
      background: "linear-gradient(135deg,#f3d783 0%,#c59a2f 48%,#74551b 100%)",
      border: "1px solid rgba(255,244,198,0.34)",
      color: "#07111f",
      borderRadius: 18,
      opacity: 1,
      config: {
        url,
        primaryColor: "linear-gradient(135deg,#f3d783,#9b7a22)",
        textColor: "#07111f",
        countdownMode: appType === "countdown" ? "event" : undefined,
        countdownTarget: appType === "countdown" ? target : undefined,
      },
    });
  };

  block("grad-hero-bg", "hero", 0, 390, 820, 0, {
    locked: true,
    borderRadius: 0,
    border: undefined,
    background: sections.find((section) => section.id === "hero")?.background,
  });
  block("grad-hero-glow-main", "hero", 154, 330, 330, 1, {
    background: "radial-gradient(circle,#d4af3742 0%,#1d4ed833 46%,transparent 72%)",
    borderRadius: 999,
    border: undefined,
    blur: 16,
    opacity: 0.82,
  });
  block("grad-hero-orbit", "hero", 88, 286, 286, 2, {
    background: "transparent",
    border: "1px solid rgba(212,175,55,0.22)",
    borderRadius: 999,
    opacity: 0.75,
  });
  line("grad-hero-line-top", "hero", 116, 170, 3);
  text("grad-hero-type", "hero", 142, graduationType.toUpperCase(), 310, 22, 4, {
    semanticRole: "graduation_subtype",
    dataKey: "graduation_type",
    lockedContent: true,
    fontSize: 11,
    fontWeight: "800",
    color: "#d4af37",
    letterSpacing: 0.16,
  });
  text("grad-hero-name", "hero", 196, graduateName, 356, 136, 5, {
    semanticRole: "graduate_name",
    dataKey: "graduate_name",
    lockedContent: true,
    fontSize: graduateName.length > 22 ? 44 : 58,
    fontFamily: DISPLAY_FONT,
    fontWeight: "500",
    color: "#fff8e6",
    lineHeight: 0.98,
  });
  text("grad-hero-date", "hero", 334, dateLabel, 340, 30, 6, {
    semanticRole: "event_date",
    dataKey: "event_date",
    lockedContent: true,
    fontSize: 14,
    color: "#f7f0df",
  });
  text("grad-hero-invitation", "hero", 396, "Tu presencia hará parte de este recuerdo.", 310, 74, 7, {
    semanticRole: "main_message",
    dataKey: clean(event.main_message) ? "main_message" : undefined,
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    fontStyle: "italic",
    color: "#f5d782",
    lineHeight: 1.35,
  });
  app("grad-hero-countdown", "hero", 540, "countdown", "", 340, 78, 8);
  line("grad-hero-line-bottom", "hero", 686, 210, 9, 0.55);
  block("grad-hero-seal", "hero", 694, 310, 76, 10, {
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(212,175,55,0.22)",
    borderRadius: 999,
    opacity: 0.95,
  });
  text("grad-hero-institution", "hero", 714, heroInstitutionLine, 274, 42, 11, {
    semanticRole: "institution_name",
    dataKey: "institution_name",
    lockedContent: true,
    fontSize: 12,
    fontWeight: "800",
    color: "#b9c2d6",
    lineHeight: 1.25,
  });

  text("grad-presentation-kicker", "presentation", 78, "PRESENTACIÓN", 330, 18, 12, {
    fontSize: 10,
    fontWeight: "900",
    color: "#d4af37",
    letterSpacing: 0.16,
  });
  text("grad-presentation-copy", "presentation", 132, "Una noche para celebrar años de esfuerzo, aprendizaje y nuevos comienzos.", 334, 126, 13, {
    semanticRole: "main_message",
    dataKey: clean(event.main_message) ? "main_message" : undefined,
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    fontStyle: "italic",
    color: "#fff8e6",
    lineHeight: 1.25,
  });
  line("grad-presentation-line", "presentation", 292, 150, 14);
  text("grad-presentation-support", "presentation", 330, familyMessage, 318, 112, 15, {
    semanticRole: "parents_message",
    dataKey: "family_message",
    lockedContent: true,
    fontSize: 15,
    color: "#d8cfbd",
    lineHeight: 1.45,
  });

  block("grad-achievement-glow", "achievement", 28, 334, 334, 16, {
    background: "radial-gradient(circle,rgba(212,175,55,0.18) 0%,rgba(37,99,235,0.10) 42%,transparent 72%)",
    border: undefined,
    borderRadius: 999,
    blur: 12,
    opacity: 0.86,
  });
  block("grad-achievement-seal", "achievement", 62, 266, 266, 17, {
    background: "radial-gradient(circle,rgba(255,255,255,0.075) 0%,rgba(212,175,55,0.10) 52%,rgba(255,255,255,0.015) 100%)",
    border: "1px solid rgba(255,244,198,0.12)",
    borderRadius: 999,
    opacity: 0.94,
  });
  line("grad-achievement-line", "achievement", 106, 112, 18, 0.5);
  text("grad-achievement-title", "achievement", 128, "Sello académico", 286, 34, 19, {
    semanticRole: "graduation_program",
    fontFamily: DISPLAY_FONT,
    fontSize: 27,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-achievement-degree", "achievement", 184, achievementText, 278, 62, 20, {
    semanticRole: "graduation_program",
    dataKey: degreeTitle ? "degree_title" : academicProgram ? "academic_program" : "promotion_name",
    lockedContent: true,
    fontSize: 17,
    color: "#fff8e6",
    lineHeight: 1.34,
  });
  if (promotionName) {
    text("grad-promotion-name", "achievement", 258, promotionName, 250, 24, 21, {
      semanticRole: "graduation_program",
      dataKey: "promotion_name",
      lockedContent: true,
      fontSize: 12,
      fontWeight: "800",
      color: "#d4af37",
      letterSpacing: 0.1,
    });
  }
  text("grad-achievement-inst", "achievement", 314, institution, 286, 42, 22, {
    semanticRole: "institution_name",
    dataKey: "institution_name",
    lockedContent: true,
    fontSize: 13,
    color: "#d8cfbd",
  });

  block("grad-ceremony-side-line", "academic_ceremony", 72, 2, 310, 21, {
    x: 42,
    background: "linear-gradient(180deg,#d4af37,transparent)",
    border: undefined,
    borderRadius: 999,
    opacity: 0.72,
  });
  text("grad-ceremony-label", "academic_ceremony", 92, "ACTO ACADÉMICO", 280, 18, 22, {
    fontSize: 10,
    fontWeight: "900",
    color: "#d4af37",
    letterSpacing: 0.16,
    textAlign: "left",
    x: 66,
  });
  text("grad-ceremony-place", "academic_ceremony", 140, ceremonyPlace, 294, 124, 23, {
    semanticRole: "academic_ceremony",
    dataKey: "academic_ceremony_place",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: ceremonyPlace.length > 32 ? 25 : 29,
    fontStyle: "italic",
    color: "#fff8e6",
    lineHeight: 1.25,
    textAlign: "left",
    x: 66,
  });
  text("grad-ceremony-time", "academic_ceremony", 276, ceremonyTime ? `${ceremonyTime} hs` : "Hora por confirmar", 250, 28, 24, {
    semanticRole: "academic_ceremony",
    dataKey: "academic_ceremony_time",
    lockedContent: true,
    fontSize: 14,
    fontWeight: "800",
    color: "#d4af37",
    textAlign: "left",
    x: 66,
  });
  text("grad-ceremony-note", "academic_ceremony", 336, "Acompáñanos a compartir este logro tan especial.", 282, 62, 25, {
    fontSize: 14,
    color: "#d8cfbd",
    lineHeight: 1.42,
    textAlign: "left",
    x: 66,
  });

  block("grad-reception-glow", "reception", 50, 230, 230, 26, {
    background: "radial-gradient(circle,#d4af372e,transparent 72%)",
    border: undefined,
    borderRadius: 999,
    blur: 12,
    opacity: 0.8,
  });
  text("grad-reception-title", "reception", 92, "Recepción", 300, 38, 27, {
    semanticRole: "reception_place",
    fontFamily: DISPLAY_FONT,
    fontSize: 34,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-reception-place", "reception", 166, receptionPlace || "Recepción por confirmar", 318, 78, 28, {
    semanticRole: "reception_place",
    dataKey: "reception_place",
    lockedContent: true,
    fontSize: 16,
    color: "#fff8e6",
    lineHeight: 1.4,
  });
  line("grad-reception-line", "reception", 244, 118, 29, 0.52);
  text("grad-reception-time", "reception", 282, receptionTime ? `${receptionTime} hs` : "Hora por confirmar", 260, 28, 30, {
    semanticRole: "reception_place",
    dataKey: "reception_time",
    lockedContent: true,
    fontSize: 13,
    fontWeight: "800",
    color: "#d4af37",
  });

  text("grad-message-title", "message", 80, "Para recordar", 300, 38, 30, {
    fontFamily: DISPLAY_FONT,
    fontSize: 34,
    fontStyle: "italic",
    color: "#f5d782",
  });
  line("grad-message-line", "message", 142, 120, 31);
  text("grad-message-copy", "message", 194, graduateMessage, 320, 150, 32, {
    semanticRole: "honoree_message",
    dataKey: clean(event.graduate_message) ? "graduate_message" : "main_message",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: graduateMessage.length > 150 ? 19 : 22,
    fontStyle: "italic",
    color: "#fff8e6",
    lineHeight: 1.45,
  });
  text("grad-message-family", "message", 378, familyMessage, 312, 104, 33, {
    semanticRole: "parents_message",
    dataKey: "family_message",
    lockedContent: true,
    fontSize: 14,
    color: "#b9c2d6",
    lineHeight: 1.42,
  });

  if (hasDressDetails) {
    block("grad-dress-glow", "dress_code", 36, 270, 270, 33, {
      background: "radial-gradient(circle,rgba(212,175,55,0.12),transparent 70%)",
      border: undefined,
      borderRadius: 999,
      blur: 10,
      opacity: 0.8,
    });
    block("grad-dress-pill", "dress_code", 82, 318, 214, 34, {
      background: "rgba(255,255,255,0.055)",
      border: "1px solid rgba(212,175,55,0.22)",
      borderRadius: 999,
    });
    text("grad-dress-title", "dress_code", 122, "Vestimenta", 280, 32, 35, {
      semanticRole: "dress_code",
      fontFamily: DISPLAY_FONT,
      fontSize: 29,
      fontStyle: "italic",
      color: "#f5d782",
    });
    text("grad-dress-copy", "dress_code", 180, dressText, 280, null, 36, {
      semanticRole: "dress_code",
      dataKey: "dress_code",
      lockedContent: true,
      fontSize: 13,
      color: "#d8cfbd",
      lineHeight: 1.38,
    });
  } else {
    line("grad-dress-line", "dress_code", 166, 96, 34, 0.32);
    text("grad-dress-copy", "dress_code", 198, "Vestimenta por confirmar", 230, 28, 35, {
      semanticRole: "dress_code",
      dataKey: "dress_code",
      lockedContent: true,
      fontSize: 10,
      color: "#7e8798",
      lineHeight: 1.38,
      opacity: 0.55,
    });
  }

  text("grad-location-title", "location", 78, "Ubicación", 300, 36, 37, {
    semanticRole: "event_address",
    fontFamily: DISPLAY_FONT,
    fontSize: 34,
    fontStyle: "italic",
    color: "#f5d782",
  });
  block("grad-location-glow", "location", 72, 300, 300, 38, {
    background: "radial-gradient(circle,rgba(37,99,235,0.16),rgba(212,175,55,0.08) 44%,transparent 72%)",
    border: undefined,
    borderRadius: 999,
    blur: 12,
    opacity: 0.84,
  });
  block("grad-location-panel", "location", 146, 340, 178, 39, {
    background: "linear-gradient(135deg,rgba(15,23,42,0.74),rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,244,198,0.11)",
    borderRadius: 28,
  });
  text("grad-location-copy", "location", 178, locationText, 304, 108, 40, {
    semanticRole: "event_address",
    dataKey: "address",
    lockedContent: true,
    fontSize: 14,
    color: "#f7f0df",
    lineHeight: 1.4,
  });
  app("grad-location-map", "location", 370, "maps", "Ver mapa", 230, 48, 41, mapsUrl);

  block("grad-rsvp-glow", "rsvp", 84, 300, 300, 41, {
    background: "radial-gradient(circle,rgba(212,175,55,0.14),rgba(37,99,235,0.08),transparent 72%)",
    border: undefined,
    borderRadius: 999,
    blur: 12,
    opacity: 0.76,
  });
  text("grad-rsvp-title", "rsvp", 86, "Confirmá tu asistencia", 340, 50, 42, {
    semanticRole: "rsvp_action",
    fontFamily: DISPLAY_FONT,
    fontSize: 31,
    fontStyle: "italic",
    color: "#f5d782",
  });
  text("grad-rsvp-copy", "rsvp", 150, "Tu presencia hará parte de este recuerdo.", 304, 46, 43, {
    fontSize: 14,
    color: "#d8cfbd",
    lineHeight: 1.38,
  });
  app("grad-rsvp-app", "rsvp", 226, "rsvp", "Confirmar asistencia", 320, 66, 44);
  if (waUrl) app("grad-whatsapp-app", "rsvp", 316, "whatsapp", "Enviar WhatsApp", 320, 60, 45, waUrl);
  text("grad-package-note", "rsvp", 430, "KAIS", 120, 18, 46, {
    semanticRole: "package_note",
    dataKey: "package_key",
    lockedContent: true,
    fontSize: 9,
    fontWeight: "800",
    color: "#d4af37",
    letterSpacing: 0.12,
    opacity: 0.28,
  });

  block("grad-footer-orbit", "footer", 42, 230, 230, 46, {
    background: "transparent",
    border: "1px solid rgba(212,175,55,0.18)",
    borderRadius: 999,
    opacity: 0.8,
  });
  text("grad-footer-title", "footer", 92, "El comienzo de una nueva historia", 320, 78, 47, {
    semanticRole: "event_title",
    dataKey: "title",
    lockedContent: true,
    fontFamily: DISPLAY_FONT,
    fontSize: 27,
    fontStyle: "italic",
    color: "#fff8e6",
    lineHeight: 1.22,
  });
  text("grad-footer-inst", "footer", 196, institution, 320, 42, 48, {
    semanticRole: "institution_name",
    dataKey: "institution_name",
    lockedContent: true,
    fontSize: 12,
    color: "#d4af37",
    letterSpacing: 0.08,
  });
  line("grad-footer-line", "footer", 258, 150, 49, 0.6);

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
