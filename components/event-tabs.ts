export const EVENT_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "invitados", label: "Invitados" },
  { key: "confirmaciones", label: "Confirmaciones" },
  { key: "publicacion", label: "Publicacion" },
  { key: "diseno-v3", label: "Diseño V3" },
  { key: "acceso", label: "Acceso cliente" },
  { key: "ajustes", label: "Ajustes" },
] as const;

export type EventTab = (typeof EVENT_TABS)[number];
export type EventTabKey = EventTab["key"];
