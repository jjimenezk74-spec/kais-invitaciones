import type { CanvasV3EventData } from "./initial-design";

export type CanvasV3EventType =
  | "quinceanios"
  | "wedding"
  | "baptism"
  | "kids_birthday"
  | "birthday"
  | "baby_shower"
  | "corporate"
  | "graduation";

export type GraduationSubtype =
  | "high_school"
  | "university"
  | "technical"
  | "kindergarten"
  | "primary"
  | "postgraduate"
  | "course"
  | "general";

export type CeremonySectionKind =
  | "hero"
  | "countdown"
  | "person_presentation"
  | "couple_presentation"
  | "family_presentation"
  | "message"
  | "parents_message"
  | "ceremony"
  | "academic_ceremony"
  | "reception"
  | "event_details"
  | "agenda"
  | "dress_code"
  | "gift_note"
  | "rsvp"
  | "footer";

export type CeremonySemanticRole =
  | "event_type"
  | "event_title"
  | "honoree_name"
  | "event_date"
  | "event_time"
  | "countdown"
  | "main_message"
  | "honoree_message"
  | "parents_names"
  | "parents_message"
  | "ceremony_place"
  | "ceremony_time"
  | "event_address"
  | "maps_link"
  | "dress_code"
  | "color_palette"
  | "theme"
  | "rsvp_action"
  | "whatsapp_action"
  | "package_note"
  | "couple_names"
  | "partner_one_name"
  | "partner_two_name"
  | "godparents_names"
  | "baby_name"
  | "birthday_person_name"
  | "age"
  | "company_name"
  | "speaker_name"
  | "agenda_summary"
  | "institution_name"
  | "graduate_name"
  | "graduation_program"
  | "graduation_subtype"
  | "academic_ceremony"
  | "reception_place"
  | "gift_note";

export type CeremonySectionDefinition = {
  id: string;
  label: string;
  kind: CeremonySectionKind;
  required: boolean;
  dataKeys: Array<keyof CanvasV3EventData>;
  semanticRoles?: CeremonySemanticRole[];
  graduationSubtype?: GraduationSubtype;
  includeWhen?: (event: CanvasV3EventData) => boolean;
};

export type CeremonyStructure = {
  eventType: CanvasV3EventType;
  label: string;
  sections: CeremonySectionDefinition[];
};

export const QUINCEANOS_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "quinceanios",
  label: "Quinceanios",
  sections: [
    {
      id: "hero",
      label: "Portada",
      kind: "hero",
      required: true,
      dataKeys: ["event_type", "title", "hosts_names", "quinceanera_name", "event_date", "event_time", "main_message", "quince_message"],
      semanticRoles: ["event_type", "honoree_name", "event_date", "event_time", "main_message", "honoree_message"],
    },
    {
      id: "countdown",
      label: "Cuenta regresiva",
      kind: "countdown",
      required: true,
      dataKeys: ["event_date", "event_time"],
      semanticRoles: ["countdown", "event_date", "event_time"],
    },
    {
      id: "presentation",
      label: "Presentacion",
      kind: "person_presentation",
      required: true,
      dataKeys: ["quinceanera_name", "hosts_names", "title", "event_date", "event_time"],
      semanticRoles: ["honoree_name", "event_date", "event_time"],
    },
    {
      id: "messages",
      label: "Mensajes",
      kind: "message",
      required: true,
      dataKeys: ["main_message", "quince_message", "parents_message", "parents_names"],
      semanticRoles: ["honoree_message", "parents_message", "parents_names"],
    },
    {
      id: "church",
      label: "Misa",
      kind: "ceremony",
      required: false,
      dataKeys: ["church_name", "church_time", "event_time"],
      semanticRoles: ["ceremony_place", "ceremony_time"],
      includeWhen: (event) => Boolean(event.church_name || event.church_time),
    },
    {
      id: "details",
      label: "Detalles",
      kind: "event_details",
      required: true,
      dataKeys: ["event_date", "event_time", "address", "google_maps_link"],
      semanticRoles: ["event_date", "event_time", "event_address", "maps_link"],
    },
    {
      id: "dresscode",
      label: "Vestimenta",
      kind: "dress_code",
      required: false,
      dataKeys: ["dress_code", "color_palette", "theme"],
      semanticRoles: ["dress_code", "color_palette", "theme"],
      includeWhen: (event) => Boolean(event.dress_code || event.color_palette || event.theme),
    },
    {
      id: "rsvp",
      label: "Confirmacion",
      kind: "rsvp",
      required: true,
      dataKeys: ["whatsapp_phone", "package_key"],
      semanticRoles: ["rsvp_action", "whatsapp_action", "package_note"],
    },
    {
      id: "footer",
      label: "Cierre",
      kind: "footer",
      required: true,
      dataKeys: ["title", "hosts_names", "quinceanera_name"],
      semanticRoles: ["event_title", "honoree_name"],
    },
  ],
};

export const WEDDING_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "wedding",
  label: "Wedding",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date", "event_time"], ["couple_names", "event_date", "event_time"]),
    section("countdown", "Cuenta regresiva", "countdown", true, ["event_date", "event_time"], ["countdown"]),
    section("couple", "Pareja", "couple_presentation", true, ["hosts_names", "main_message"], ["couple_names", "main_message"]),
    section("ceremony", "Ceremonia", "ceremony", false, ["church_name", "church_time", "event_time"], ["ceremony_place", "ceremony_time"]),
    section("reception", "Recepcion", "reception", true, ["address", "google_maps_link", "event_time"], ["reception_place", "event_address", "maps_link"]),
    section("dresscode", "Vestimenta", "dress_code", false, ["dress_code", "color_palette", "theme"], ["dress_code", "color_palette", "theme"]),
    section("rsvp", "Confirmacion", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "couple_names"]),
  ],
};

export const BAPTISM_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "baptism",
  label: "Baptism",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date"], ["baby_name", "event_date"]),
    section("family", "Familia", "family_presentation", true, ["hosts_names", "parents_names", "main_message"], ["parents_names", "main_message"]),
    section("godparents", "Padrinos", "person_presentation", false, ["main_message"], ["godparents_names"]),
    section("ceremony", "Ceremonia", "ceremony", true, ["church_name", "church_time", "event_time"], ["ceremony_place", "ceremony_time"]),
    section("reception", "Celebracion", "reception", false, ["address", "google_maps_link", "event_time"], ["reception_place", "event_address", "maps_link"]),
    section("rsvp", "Confirmacion", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "baby_name"]),
  ],
};

export const KIDS_BIRTHDAY_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "kids_birthday",
  label: "Kids birthday",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date", "event_time"], ["birthday_person_name", "age", "event_date"]),
    section("countdown", "Cuenta regresiva", "countdown", false, ["event_date", "event_time"], ["countdown"]),
    section("message", "Invitacion", "message", true, ["main_message", "parents_names"], ["main_message", "parents_names"]),
    section("details", "Detalles", "event_details", true, ["event_date", "event_time", "address", "google_maps_link"], ["event_date", "event_time", "event_address", "maps_link"]),
    section("theme", "Tematica", "dress_code", false, ["theme", "color_palette", "dress_code"], ["theme", "color_palette", "dress_code"]),
    section("rsvp", "Confirmacion", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "birthday_person_name"]),
  ],
};

export const BIRTHDAY_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "birthday",
  label: "Birthday",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date", "event_time"], ["birthday_person_name", "event_date"]),
    section("countdown", "Cuenta regresiva", "countdown", false, ["event_date", "event_time"], ["countdown"]),
    section("message", "Mensaje", "message", true, ["main_message"], ["main_message"]),
    section("details", "Detalles", "event_details", true, ["event_date", "event_time", "address", "google_maps_link"], ["event_date", "event_time", "event_address", "maps_link"]),
    section("dresscode", "Vestimenta", "dress_code", false, ["dress_code", "color_palette", "theme"], ["dress_code", "color_palette", "theme"]),
    section("rsvp", "Confirmacion", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "birthday_person_name"]),
  ],
};

export const BABY_SHOWER_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "baby_shower",
  label: "Baby shower",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date", "event_time"], ["baby_name", "event_date"]),
    section("parents", "Familia", "family_presentation", true, ["hosts_names", "parents_names", "main_message"], ["parents_names", "main_message"]),
    section("details", "Detalles", "event_details", true, ["event_date", "event_time", "address", "google_maps_link"], ["event_date", "event_time", "event_address", "maps_link"]),
    section("theme", "Tematica", "dress_code", false, ["theme", "color_palette", "dress_code"], ["theme", "color_palette", "dress_code"]),
    section("gifts", "Regalos", "gift_note", false, ["main_message"], ["gift_note"]),
    section("rsvp", "Confirmacion", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "baby_name"]),
  ],
};

export const CORPORATE_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "corporate",
  label: "Corporate",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date", "event_time"], ["company_name", "event_title", "event_date"]),
    section("agenda", "Agenda", "agenda", true, ["main_message"], ["agenda_summary", "speaker_name"]),
    section("speaker", "Expositor", "person_presentation", false, ["hosts_names", "main_message"], ["speaker_name", "company_name"]),
    section("details", "Detalles", "event_details", true, ["event_date", "event_time", "address", "google_maps_link"], ["event_date", "event_time", "event_address", "maps_link"]),
    section("rsvp", "Registro", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "company_name"]),
  ],
};

export const GRADUATION_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "graduation",
  label: "Graduation",
  sections: [
    section("hero", "Portada", "hero", true, ["title", "hosts_names", "event_date", "event_time"], ["graduate_name", "graduation_program", "event_date"]),
    section("graduate", "Graduado", "person_presentation", true, ["hosts_names", "title", "main_message"], ["graduate_name", "graduation_program", "institution_name"]),
    section("ceremony", "Ceremonia academica", "academic_ceremony", true, ["event_date", "event_time", "address", "google_maps_link"], ["academic_ceremony", "institution_name", "event_date", "event_time", "maps_link"]),
    section("reception", "Recepcion", "reception", false, ["address", "google_maps_link", "event_time"], ["reception_place", "event_address", "maps_link"]),
    section("message", "Mensaje", "message", false, ["main_message", "parents_message"], ["main_message", "parents_message"]),
    section("rsvp", "Confirmacion", "rsvp", true, ["whatsapp_phone", "package_key"], ["rsvp_action", "whatsapp_action", "package_note"]),
    section("footer", "Cierre", "footer", true, ["title", "hosts_names"], ["event_title", "graduate_name", "institution_name"]),
  ],
};

export const CONCEPTUAL_CEREMONY_STRUCTURES: Record<CanvasV3EventType, CeremonyStructure> = {
  quinceanios: QUINCEANOS_CEREMONY_STRUCTURE,
  wedding: WEDDING_CEREMONY_STRUCTURE,
  baptism: BAPTISM_CEREMONY_STRUCTURE,
  kids_birthday: KIDS_BIRTHDAY_CEREMONY_STRUCTURE,
  birthday: BIRTHDAY_CEREMONY_STRUCTURE,
  baby_shower: BABY_SHOWER_CEREMONY_STRUCTURE,
  corporate: CORPORATE_CEREMONY_STRUCTURE,
  graduation: GRADUATION_CEREMONY_STRUCTURE,
};

// Fase 2A: keep only quinceanios connected to the current builder.
export const CEREMONY_STRUCTURES: Partial<Record<CanvasV3EventType, CeremonyStructure>> = {
  quinceanios: QUINCEANOS_CEREMONY_STRUCTURE,
};

export function normalizeCanvasV3EventType(value?: string | null): CanvasV3EventType | null {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["quinceanios", "quinceanos", "quinceanera"].includes(normalized)) return "quinceanios";
  if (["wedding", "boda"].includes(normalized)) return "wedding";
  if (["baptism", "bautismo", "bautizo"].includes(normalized)) return "baptism";
  if (["kids_birthday", "cumpleanos_infantil"].includes(normalized)) return "kids_birthday";
  if (["birthday", "cumpleanos"].includes(normalized)) return "birthday";
  if (["baby_shower", "baby shower"].includes(normalized)) return "baby_shower";
  if (["corporate", "corporativo"].includes(normalized)) return "corporate";
  if (["graduation", "graduacion"].includes(normalized)) return "graduation";
  return null;
}

export function getCeremonyStructure(eventType?: string | null): CeremonyStructure {
  const normalized = normalizeCanvasV3EventType(eventType);
  return (normalized && CEREMONY_STRUCTURES[normalized]) || QUINCEANOS_CEREMONY_STRUCTURE;
}

function section(
  id: string,
  label: string,
  kind: CeremonySectionKind,
  required: boolean,
  dataKeys: Array<keyof CanvasV3EventData>,
  semanticRoles: CeremonySemanticRole[]
): CeremonySectionDefinition {
  return { id, label, kind, required, dataKeys, semanticRoles };
}
