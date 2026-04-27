export type UserRole = "super_admin" | "admin" | "admin_kais" | "diseñador" | "soporte_evento" | "cliente";
export type EventStatus = "borrador" | "publicado" | "inactivo";
export type GuestMode = "publico" | "lista_invitados";
export type InvitationTemplateConfig = {
  background?: string;
  primary?: string;
  secondary?: string;
  fontTitle?: string;
  fontBody?: string;
  overlay?: string;
  countdownStyle?: string;
  flowerTheme?: string;
};
export type EventType =
  | "boda"
  | "cumpleaños"
  | "quinceaños"
  | "bautizo"
  | "baby shower"
  | "corporativo"
  | "graduación"
  | "otro";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type Event = {
  id: string;
  owner_id: string;
  client_id: string | null;
  template_id: string | null;
  title: string;
  event_type: EventType;
  hosts_names: string;
  event_date: string;
  event_time: string;
  address: string;
  google_maps_link: string | null;
  main_message: string | null;
  dress_code: string | null;
  cover_image_url: string | null;
  music_url: string | null;
  theme_color: string;
  status: EventStatus;
  guest_mode: GuestMode;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type InvitationTemplate = {
  id: string;
  name: string;
  slug: string;
  category: string;
  preview_image: string | null;
  config: InvitationTemplateConfig;
  active: boolean;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  status: "activo" | "inactivo";
  created_at: string;
  created_by: string | null;
};

export type EventGuest = {
  id: string;
  event_id: string;
  guest_name: string;
  phone: string;
  email: string | null;
  token: string;
  max_companions: number;
  status: "pendiente" | "confirmado" | "no_asiste" | "bloqueado";
  rsvp_id: string | null;
  last_opened_at: string | null;
  created_at: string;
};

export type Rsvp = {
  id: string;
  event_id: string;
  guest_name: string;
  phone: string | null;
  email: string | null;
  attending: boolean;
  companions: number;
  message: string | null;
  dietary_restrictions: string | null;
  created_at: string;
};

export type EventPhoto = {
  id: string;
  event_id: string;
  storage_path: string;
  public_url: string;
  guest_name: string | null;
  is_approved: boolean;
  status: "pendiente" | "aprobada" | "rechazada";
  is_public: boolean;
  approved_at: string | null;
  approved_by_event_login: string | null;
  created_at: string;
};

export type EventLogin = {
  id: string;
  event_id: string;
  username: string;
  password_hash: string;
  active: boolean;
  expires_at: string | null;
  last_login_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type DashboardMetrics = {
  events: number;
  published: number;
  rsvps: number;
  visits: number;
};
