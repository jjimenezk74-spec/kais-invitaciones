export type UserRole = "super_admin" | "admin" | "admin_kais" | "diseñador" | "soporte_evento" | "vendedor" | "cliente";
export type EventStatus = "borrador" | "publicado" | "inactivo";
export type GuestMode = "publico" | "lista_invitados";
export type EventPackageKey = "essential" | "premium" | "experience" | "luxury";
export type DecorationSlot =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right"
  | "side_left"
  | "side_right";
export type EventDecorations = Partial<Record<DecorationSlot, string | null>>;
export type VisualDecorationSection = "hero" | "info" | "rsvp" | "gallery" | "footer";
export type VisualDecorationDevice = "desktop" | "mobile";
export type VisualDecorationEffect = "none" | "glow" | "soft_shadow" | "float" | "pulse";
export type VisualDecorationGlowStrength = "low" | "medium" | "high";
export type VisualDecorationFitMode = "manual" | "section";
export type VisualDecoration = {
  id: string;
  url: string;
  section: VisualDecorationSection;
  device: VisualDecorationDevice;
  x: number;
  y: number;
  width: number;
  height?: number | null;
  opacity: number;
  rotate: number;
  effect: VisualDecorationEffect;
  glowColor: string;
  glowStrength: VisualDecorationGlowStrength;
  fitMode?: VisualDecorationFitMode;
  desktop?: boolean;
  mobile?: boolean;
};
export type InvitationFontPreset = "default" | "romantic-script" | "luxury-serif" | "royal-classic" | "modern-chic";
export type InvitationBackgroundVariant = "default" | "dark-roses" | "satin-red" | "gold-glow" | "romantic-floral";
export type InvitationAnimationPreset = "none" | "soft-petals" | "gold-sparkles" | "elegant-glow";
export type InvitationDecorationLevel = "minimal" | "medium" | "premium";
export type InvitationDecorationPreset = "none" | "luxury-gold" | "floral-romance" | "royal-classic" | "minimal-chic" | "kids-fantasy";
export type InvitationDesignConfig = {
  fontPreset: InvitationFontPreset;
  backgroundVariant: InvitationBackgroundVariant;
  animationPreset: InvitationAnimationPreset;
  decorationLevel: InvitationDecorationLevel;
  decorationPreset: InvitationDecorationPreset;
};
export type InvitationTemplateConfig = {
  background?: string;
  primary?: string;
  secondary?: string;
  fontTitle?: string;
  fontBody?: string;
  overlay?: string;
  countdownStyle?: string;
  flowerTheme?: string;
  designConfig?: Partial<InvitationDesignConfig>;
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

export type CanvasSectionId =
  | "hero"
  | "countdown"
  | "presentation"
  | "messages"
  | "details"
  | "church"
  | "dresscode"
  | "rsvp"
  | "footer";

// ─────────────────────────────────────────────────────────────────────────────
// Canvas Design — editor visual libre
// ─────────────────────────────────────────────────────────────────────────────

export type CanvasElementType = "text" | "image";

type CanvasBaseElement = {
  id: string;
  type: CanvasElementType;
  /** Posicion horizontal: % del ancho del canvas (0-100). Anclado al centro. */
  x: number;
  /** Posicion vertical: % del alto del canvas (0-100). Anclado al centro. */
  y: number;
  /** Ancho en px sobre el canvas de referencia (refWidth). */
  width: number;
  /** Alto en px, o null = automatico segun contenido. */
  height: number | null;
  /** Rotacion en grados (-180 a 180). */
  rotation: number;
  /** Opacidad (0-1). */
  opacity: number;
  /** Orden de capa (1 = fondo). */
  zIndex: number;
  /** Si true, el editor no permite mover ni redimensionar. */
  locked: boolean;
  /** Visibilidad sin eliminar el elemento. */
  visible: boolean;
  /** Dispositivos en los que se muestra. */
  device: "all" | "mobile" | "desktop";
  /** Sección de la invitación donde se renderiza. undefined = "hero" (compatibilidad). */
  sectionId?: CanvasSectionId;
  /** Estilos visuales opcionales para el renderer absoluto. */
  style?: {
    animation?: string;
    opacity?: number;
    backdropBlur?: number;
    textShadow?: string;
    borderRadius?: number;
    background?: string;
  };
};

export type CanvasTextElement = CanvasBaseElement & {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "300" | "400" | "500" | "600" | "700";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  color: string;
  lineHeight: number;
  letterSpacing: number;
  textShadow: string | null;
  textDecoration: "none" | "underline";
  autoHeight?: boolean;
};

export type CanvasImageElement = CanvasBaseElement & {
  type: "image";
  url: string;
  /** Path en Supabase Storage para poder eliminar el archivo. */
  storagePath: string | null;
  objectFit: "contain" | "fill";
  effect: VisualDecorationEffect;
  glowColor: string;
  glowStrength: VisualDecorationGlowStrength;
  flipX: boolean;
  flipY: boolean;
};

export type CanvasElement = CanvasTextElement | CanvasImageElement;

export type CanvasBackground = {
  type: "none" | "color" | "gradient" | "image";
  color?: string;
  gradient?: string;
  imageUrl?: string;
  imageObjectFit?: "cover" | "contain";
  imageOpacity?: number;
};

export type CanvasSection = {
  id: CanvasSectionId;
  label: string;
  y: number;
  height: number;
};

export type CanvasDesign = {
  /** Version del schema. Incrementar si hay cambios incompatibles. */
  version: 1;
  /** Viewport objetivo del documento canvas. */
  viewport?: "mobile" | "desktop";
  /** Ancho absoluto del documento canvas. */
  width?: number;
  /** Alto absoluto del documento canvas. */
  height?: number;
  /** Ancho del canvas de referencia en px (390 = iPhone estandar). */
  refWidth: number;
  /** Alto del canvas de referencia en px (844 = iPhone estandar). */
  refHeight: number;
  background: CanvasBackground;
  sections?: CanvasSection[];
  elements: CanvasElement[];
  /** ISO timestamp del ultimo guardado. */
  updatedAt: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type EventCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type InvitationTheme = {
  id: string;
  category_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  thumbnail_url: string | null;
  default_design_config: Partial<InvitationDesignConfig>;
  available_options: {
    fontPresets?: InvitationFontPreset[];
    backgroundVariants?: InvitationBackgroundVariant[];
    animationPresets?: InvitationAnimationPreset[];
    decorationLevels?: InvitationDecorationLevel[];
  };
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  owner_id: string;
  client_id: string | null;
  package_key: EventPackageKey;
  enabled_features: string[];
  disabled_features: string[];
  template_id: string | null;
  category_id: string | null;
  theme_id: string | null;
  title: string;
  event_type: EventType;
  hosts_names: string;
  event_date: string;
  event_time: string;
  address: string;
  google_maps_link: string | null;
  whatsapp_phone: string | null;
  external_photo_album_url: string | null;
  main_message: string | null;
  quinceanera_name?: string | null;
  parents_names?: string | null;
  church_name?: string | null;
  church_time?: string | null;
  dress_code: string | null;
  color_palette?: string | null;
  theme?: string | null;
  quince_message?: string | null;
  parents_message?: string | null;
  cover_image_url: string | null;
  mobile_cover_image_url: string | null;
  music_url: string | null;
  decoration_top_left: string | null;
  decoration_top_right: string | null;
  decoration_bottom_left: string | null;
  decoration_bottom_right: string | null;
  decoration_side_left: string | null;
  decoration_side_right: string | null;
  visual_decorations: VisualDecoration[] | null;
  design_config: Partial<InvitationDesignConfig> | null;
  canvas_design?: CanvasDesign | null;
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
  plan_id: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  status: "activo" | "inactivo";
  created_at: string;
  created_by: string | null;
};

export type CommercialPlan = {
  id: string;
  name: string;
  slug: string;
  price_label: string | null;
  features: string[];
  active: boolean;
  created_at: string;
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

export type LivePhoto = {
  id: string;
  event_id: string;
  image_url: string;
  storage_path: string;
  guest_name: string | null;
  guest_message: string | null;
  approved: boolean;
  featured: boolean;
  rejected: boolean;
  created_at: string;
};
