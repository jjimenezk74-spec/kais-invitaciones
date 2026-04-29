export const EVENT_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "invitados", label: "Invitados" },
  { key: "confirmaciones", label: "Confirmaciones" },
  { key: "publicacion", label: "Publicacion" },
  { key: "acceso", label: "Acceso cliente" },
  { key: "ajustes", label: "Ajustes" },
] as const;

export type EventTab = (typeof EVENT_TABS)[number];
export type EventTabKey = EventTab["key"];
