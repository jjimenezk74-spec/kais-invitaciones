import type { CanvasV3EventData } from "./initial-design";

export type CanvasV3EventType =
  | "quinceaños"
  | "boda"
  | "bautismo"
  | "cumpleaños_infantil"
  | "cumpleaños"
  | "baby_shower"
  | "corporativo";

export type CeremonySectionKind =
  | "hero"
  | "countdown"
  | "person_presentation"
  | "message"
  | "parents_message"
  | "ceremony"
  | "event_details"
  | "dress_code"
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
  | "package_note";

export type CeremonySectionDefinition = {
  id: string;
  label: string;
  kind: CeremonySectionKind;
  required: boolean;
  dataKeys: Array<keyof CanvasV3EventData>;
  includeWhen?: (event: CanvasV3EventData) => boolean;
};

export type CeremonyStructure = {
  eventType: CanvasV3EventType;
  label: string;
  sections: CeremonySectionDefinition[];
};

export const QUINCEANOS_CEREMONY_STRUCTURE: CeremonyStructure = {
  eventType: "quinceaños",
  label: "Quinceaños",
  sections: [
    {
      id: "hero",
      label: "Portada",
      kind: "hero",
      required: true,
      dataKeys: ["event_type", "title", "hosts_names", "quinceanera_name", "event_date", "event_time", "main_message", "quince_message"],
    },
    {
      id: "countdown",
      label: "Cuenta regresiva",
      kind: "countdown",
      required: true,
      dataKeys: ["event_date", "event_time"],
    },
    {
      id: "presentation",
      label: "Presentacion",
      kind: "person_presentation",
      required: true,
      dataKeys: ["quinceanera_name", "hosts_names", "title", "event_date", "event_time"],
    },
    {
      id: "messages",
      label: "Mensajes",
      kind: "message",
      required: true,
      dataKeys: ["main_message", "quince_message", "parents_message", "parents_names"],
    },
    {
      id: "church",
      label: "Misa",
      kind: "ceremony",
      required: false,
      dataKeys: ["church_name", "church_time", "event_time"],
      includeWhen: (event) => Boolean(event.church_name || event.church_time),
    },
    {
      id: "details",
      label: "Detalles",
      kind: "event_details",
      required: true,
      dataKeys: ["event_date", "event_time", "address", "google_maps_link"],
    },
    {
      id: "dresscode",
      label: "Vestimenta",
      kind: "dress_code",
      required: false,
      dataKeys: ["dress_code", "color_palette", "theme"],
      includeWhen: (event) => Boolean(event.dress_code || event.color_palette || event.theme),
    },
    {
      id: "rsvp",
      label: "Confirmacion",
      kind: "rsvp",
      required: true,
      dataKeys: ["whatsapp_phone", "package_key"],
    },
    {
      id: "footer",
      label: "Cierre",
      kind: "footer",
      required: true,
      dataKeys: ["title", "hosts_names", "quinceanera_name"],
    },
  ],
};

export const CEREMONY_STRUCTURES: Partial<Record<CanvasV3EventType, CeremonyStructure>> = {
  "quinceaños": QUINCEANOS_CEREMONY_STRUCTURE,
};

export function normalizeCanvasV3EventType(value?: string | null): CanvasV3EventType | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "quinceaños" || normalized === "quinceanos" || normalized === "quinceanera") return "quinceaños";
  if (normalized === "boda") return "boda";
  if (normalized === "bautismo") return "bautismo";
  if (normalized === "cumpleaños_infantil" || normalized === "cumpleanos_infantil") return "cumpleaños_infantil";
  if (normalized === "cumpleaños" || normalized === "cumpleanos") return "cumpleaños";
  if (normalized === "baby_shower" || normalized === "baby shower") return "baby_shower";
  if (normalized === "corporativo") return "corporativo";
  return null;
}

export function getCeremonyStructure(eventType?: string | null): CeremonyStructure {
  const normalized = normalizeCanvasV3EventType(eventType);
  return (normalized && CEREMONY_STRUCTURES[normalized]) || QUINCEANOS_CEREMONY_STRUCTURE;
}
