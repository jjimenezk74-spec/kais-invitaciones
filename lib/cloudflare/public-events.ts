import { getD1Database } from "@/lib/cloudflare/d1";
import type { CanvasV3Template, CanvasV3TemplateScope } from "@/lib/canvas-v3/templates";
import { normalizeCanvasV3EventType, type CanvasV3EventType } from "@/lib/canvas-v3/ceremonial-structures";
import type { CanvasV3Design } from "@/lib/canvas-v3/initial-design";
import type { Event, EventCategory, EventGuest, EventLogin, EventPhoto, InvitationTheme, LivePhoto, Rsvp } from "@/lib/types";

type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;

type D1TemplateRow = D1Row & {
  compatible_event_types?: string | null;
  design?: string | null;
};

const EVENT_JSON_FIELDS = new Set([
  "enabled_features",
  "disabled_features",
  "visual_decorations",
  "design_config",
  "canvas_design"
]);

export async function getD1PublicEventBySlug(slug: string) {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select * from events where slug = ? limit 1")
    .bind(slug)
    .first<D1Row>();

  return row ? mapD1Event(row) : null;
}

export async function getD1EventByIdOrSlug(idOrSlug: string) {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select * from events where id = ? or slug = ? limit 1")
    .bind(idOrSlug, idOrSlug)
    .first<D1Row>();

  return row ? mapD1Event(row) : null;
}

export async function getD1EventDashboardCounts(eventId: string) {
  const db = await getD1Database();
  if (!db) {
    return {
      rsvpsTotal: 0,
      rsvpsAttending: 0,
      photosCount: 0,
      liveTotal: 0,
      guestsCount: 0
    };
  }

  const [rsvpsTotal, rsvpsAttending, photosCount, liveTotal, guestsCount] = await Promise.all([
    db.prepare("select count(*) as count from rsvps where event_id = ?").bind(eventId).first<{ count: number }>(),
    db.prepare("select count(*) as count from rsvps where event_id = ? and attending = 1").bind(eventId).first<{ count: number }>(),
    db.prepare("select count(*) as count from event_photos where event_id = ?").bind(eventId).first<{ count: number }>(),
    db.prepare("select count(*) as count from live_photos where event_id = ?").bind(eventId).first<{ count: number }>(),
    db.prepare("select count(*) as count from event_guests where event_id = ?").bind(eventId).first<{ count: number }>()
  ]);

  return {
    rsvpsTotal: rsvpsTotal?.count ?? 0,
    rsvpsAttending: rsvpsAttending?.count ?? 0,
    photosCount: photosCount?.count ?? 0,
    liveTotal: liveTotal?.count ?? 0,
    guestsCount: guestsCount?.count ?? 0
  };
}

export async function updateD1EventStatus(eventId: string, status: Event["status"]) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update events set status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(status, eventId)
    .run();
}

export async function updateD1CanvasDesign(eventId: string, design: unknown) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update events set canvas_design = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(JSON.stringify(design), eventId)
    .run();
}

export async function updateD1EventFields(eventId: string, input: Record<string, D1Value>) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const allowedColumns = new Set([
    "title",
    "event_type",
    "hosts_names",
    "event_date",
    "event_time",
    "address",
    "google_maps_link",
    "whatsapp_phone",
    "external_photo_album_url",
    "main_message",
    "quinceanera_name",
    "parents_names",
    "church_name",
    "church_time",
    "dress_code",
    "color_palette",
    "theme",
    "quince_message",
    "parents_message",
    "graduate_name",
    "graduation_type",
    "institution_name",
    "academic_program",
    "degree_title",
    "promotion_name",
    "academic_ceremony_place",
    "academic_ceremony_time",
    "reception_place",
    "reception_time",
    "family_message",
    "graduate_message",
    "cover_image_url",
    "mobile_cover_image_url",
    "music_url",
    "visual_decorations",
    "design_config",
    "theme_color",
    "status",
    "guest_mode",
    "client_id",
    "template_id",
    "category_id",
    "theme_id",
    "package_key",
    "slug"
  ]);

  const entries = Object.entries(input).filter(([key]) => allowedColumns.has(key));
  if (entries.length === 0) return;

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  await db
    .prepare(`update events set ${assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?`)
    .bind(...entries.map(([, value]) => serializeD1Value(value)), eventId)
    .run();
}

export async function listD1Clients() {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, name, contact_name, plan_id, phone, whatsapp, email, notes, status, created_at, created_by from clients order by created_at desc")
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1Client);
}

export async function listD1DashboardEvents() {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, title, status, hosts_names, client_id, event_date, slug, created_at from events order by created_at desc")
    .all<D1Row>();

  return rows.results ?? [];
}

export async function listD1Profiles(includeClients = true) {
  const db = await getD1Database();
  if (!db) return [];

  const query = includeClients
    ? "select id, full_name, email, role, is_active, created_at from profiles order by created_at desc"
    : "select id, full_name, email, role, is_active, created_at from profiles where role != 'cliente' order by created_at desc";

  const rows = await db.prepare(query).all<D1Row>();
  return (rows.results ?? []).map(mapD1Profile);
}

export async function getD1ProfileById(userId: string) {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select id, full_name, email, role, is_active, created_at from profiles where id = ? limit 1")
    .bind(userId)
    .first<D1Row>();

  return row ? mapD1Profile(row) : null;
}

export async function createD1Profile(input: {
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  passwordHash: string;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");
  const id = crypto.randomUUID();

  await db
    .prepare("insert into profiles (id, full_name, email, role, password_hash, is_active) values (?, ?, ?, ?, ?, ?)")
    .bind(id, input.fullName, input.email, normalizeD1Role(input.role), input.passwordHash, input.isActive ? 1 : 0)
    .run();

  return id;
}

export async function updateD1ProfileRole(userId: string, role: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update profiles set role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(normalizeD1Role(role), userId)
    .run();
}

export async function updateD1ProfileActive(userId: string, isActive: boolean) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update profiles set is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(isActive ? 1 : 0, userId)
    .run();
}

export async function deleteD1Profile(userId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");
  await db.prepare("delete from profiles where id = ?").bind(userId).run();
}

export async function listD1CommercialPlans() {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, name, slug, price_label, features, active, created_at from commercial_plans where active = 1 order by created_at asc")
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1CommercialPlan);
}

export async function listD1EventCategories(): Promise<EventCategory[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, slug, name, description, sort_order, is_active, created_at from event_categories where is_active = 1 order by sort_order asc, name asc")
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1EventCategory);
}

export async function listD1InvitationThemes(): Promise<InvitationTheme[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, category_id, slug, name, description, preview_image_url, thumbnail_url, default_design_config, available_options, is_premium, is_active, sort_order, created_at, updated_at from invitation_themes where is_active = 1 order by sort_order asc, name asc")
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1InvitationTheme);
}

export async function listD1CanvasV3Templates(filters: {
  eventType?: string | null;
  activeOnly?: boolean;
  scope?: CanvasV3TemplateScope | null;
} = {}): Promise<CanvasV3Template[]> {
  const db = await getD1Database();
  if (!db) return [];

  const clauses: string[] = [];
  const values: D1Value[] = [];

  if (filters.activeOnly) {
    clauses.push("is_active = 1");
  }

  if (filters.scope) {
    clauses.push("template_scope = ?");
    values.push(filters.scope);
  }

  const where = clauses.length > 0 ? ` where ${clauses.join(" and ")}` : "";
  const rows = await db
    .prepare(
      [
        "select id, name, slug, compatible_event_types, visual_category, description, template_scope, design,",
        "preview_image_url, thumbnail_url, is_premium, is_active, sort_order, source_event_id, created_by, created_at, updated_at",
        `from canvas_v3_templates${where}`,
        "order by sort_order asc, created_at desc"
      ].join(" ")
    )
    .bind(...values)
    .all<D1TemplateRow>();

  const normalizedEventType = normalizeCanvasV3EventType(filters.eventType ?? "");

  return (rows.results ?? [])
    .map(mapD1CanvasV3Template)
    .filter((template) => {
      if (!normalizedEventType) return true;
      return template.compatibleEventTypes.length === 0 || template.compatibleEventTypes.includes(normalizedEventType);
    });
}

export async function getD1CanvasV3TemplateById(templateId: string): Promise<CanvasV3Template | null> {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare(
      [
        "select id, name, slug, compatible_event_types, visual_category, description, template_scope, design,",
        "preview_image_url, thumbnail_url, is_premium, is_active, sort_order, source_event_id, created_by, created_at, updated_at",
        "from canvas_v3_templates where id = ? limit 1"
      ].join(" ")
    )
    .bind(templateId)
    .first<D1TemplateRow>();

  return row ? mapD1CanvasV3Template(row) : null;
}

export async function getD1AdminOverviewCounts() {
  const db = await getD1Database();
  if (!db) return { rsvps: 0, photos: 0 };

  const [rsvps, photos] = await Promise.all([
    db.prepare("select count(*) as count from rsvps").first<{ count: number }>(),
    db.prepare("select count(*) as count from event_photos").first<{ count: number }>()
  ]);

  return {
    rsvps: rsvps?.count ?? 0,
    photos: photos?.count ?? 0
  };
}

export async function createD1Client(input: {
  name: string;
  plan_id: string | null;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  status: "activo" | "inactivo";
  created_by: string;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");
  const id = crypto.randomUUID();

  await db
    .prepare(
      "insert into clients (id, name, plan_id, contact_name, phone, whatsapp, email, notes, status, created_by) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, input.name, input.plan_id, input.contact_name, input.phone, input.whatsapp, input.email, input.notes, input.status, input.created_by)
    .run();

  return id;
}

export async function updateD1Client(clientId: string, input: {
  name: string;
  plan_id: string | null;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  status: "activo" | "inactivo";
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare(
      "update clients set name = ?, plan_id = ?, contact_name = ?, phone = ?, whatsapp = ?, email = ?, notes = ?, status = ? where id = ?"
    )
    .bind(input.name, input.plan_id, input.contact_name, input.phone, input.whatsapp, input.email, input.notes, input.status, clientId)
    .run();
}

export async function updateD1ClientStatus(clientId: string, status: "activo" | "inactivo") {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update clients set status = ? where id = ?")
    .bind(status, clientId)
    .run();
}

export async function deleteD1Client(clientId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");
  await db.prepare("delete from clients where id = ?").bind(clientId).run();
}

export async function createD1Event(input: Record<string, D1Value>) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const id = crypto.randomUUID();
  await db
    .prepare(
      `insert into events (
        id, owner_id, package_key, enabled_features, disabled_features, title, event_type, hosts_names,
        event_date, event_time, address, google_maps_link, whatsapp_phone, external_photo_album_url,
        main_message, quinceanera_name, parents_names, church_name, church_time, dress_code,
        color_palette, theme, quince_message, parents_message, graduate_name, graduation_type,
        institution_name, academic_program, degree_title, promotion_name, academic_ceremony_place,
        academic_ceremony_time, reception_place, reception_time, family_message, graduate_message,
        cover_image_url, mobile_cover_image_url, music_url, theme_color, status, guest_mode,
        client_id, template_id, category_id, theme_id, slug
      ) values (
        ?, ?, ?, '[]', '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`
    )
    .bind(
      id,
      input.owner_id,
      input.package_key,
      input.title,
      input.event_type,
      input.hosts_names,
      input.event_date,
      input.event_time,
      input.address,
      input.google_maps_link,
      input.whatsapp_phone,
      input.external_photo_album_url,
      input.main_message,
      input.quinceanera_name,
      input.parents_names,
      input.church_name,
      input.church_time,
      input.dress_code,
      input.color_palette,
      input.theme,
      input.quince_message,
      input.parents_message,
      input.graduate_name,
      input.graduation_type,
      input.institution_name,
      input.academic_program,
      input.degree_title,
      input.promotion_name,
      input.academic_ceremony_place,
      input.academic_ceremony_time,
      input.reception_place,
      input.reception_time,
      input.family_message,
      input.graduate_message,
      input.cover_image_url,
      input.mobile_cover_image_url,
      input.music_url,
      input.theme_color,
      input.status,
      input.guest_mode,
      input.client_id,
      input.template_id,
      input.category_id,
      input.theme_id,
      input.slug
    )
    .run();

  return id;
}

export async function deleteD1Event(eventId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db.prepare("delete from live_photo_comments where event_id = ?").bind(eventId).run();
  await db.prepare("delete from live_photo_reactions where event_id = ?").bind(eventId).run();
  await db.prepare("delete from live_photos where event_id = ?").bind(eventId).run();
  await db.prepare("delete from event_photos where event_id = ?").bind(eventId).run();
  await db.prepare("delete from analytics_visits where event_id = ?").bind(eventId).run();
  await db.prepare("delete from event_logins where event_id = ?").bind(eventId).run();
  await db.prepare("delete from event_guests where event_id = ?").bind(eventId).run();
  await db.prepare("delete from rsvps where event_id = ?").bind(eventId).run();
  await db.prepare("update canvas_v3_templates set source_event_id = null where source_event_id = ?").bind(eventId).run();

  await db.prepare("delete from events where id = ?").bind(eventId).run();
}

export async function trackD1Visit(eventId: string, userAgent?: string | null) {
  const db = await getD1Database();
  if (!db) return;

  try {
    await db
      .prepare("insert into analytics_visits (id, event_id, user_agent, ip_hash) values (?, ?, ?, null)")
      .bind(crypto.randomUUID(), eventId, userAgent ?? null)
      .run();
  } catch (error) {
    console.warn("[D1 analytics] No se pudo registrar visita", error);
  }
}

export async function insertD1Rsvp(input: {
  eventId: string;
  guestName: string;
  phone: string | null;
  email: string | null;
  attending: boolean;
  companions: number;
  message: string | null;
  dietaryRestrictions: string | null;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const id = crypto.randomUUID();

  await db
    .prepare(
      [
        "insert into rsvps",
        "(id, event_id, guest_name, phone, email, attending, companions, message, dietary_restrictions)",
        "values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ].join(" ")
    )
    .bind(
      id,
      input.eventId,
      input.guestName,
      input.phone,
      input.email,
      input.attending ? 1 : 0,
      input.companions,
      input.message,
      input.dietaryRestrictions
    )
    .run();

  return id;
}

export async function listD1Rsvps(eventId: string): Promise<Rsvp[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, event_id, guest_name, phone, email, attending, companions, message, dietary_restrictions, created_at from rsvps where event_id = ? order by created_at desc")
    .bind(eventId)
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1Rsvp);
}

export async function listD1EventGuests(eventId: string): Promise<EventGuest[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, event_id, guest_name, phone, email, token, max_companions, status, rsvp_id, last_opened_at, created_at from event_guests where event_id = ? order by created_at desc")
    .bind(eventId)
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1EventGuest);
}

export async function getD1EventGuestByToken(eventId: string, token: string): Promise<EventGuest | null> {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select id, event_id, guest_name, phone, email, token, max_companions, status, rsvp_id, last_opened_at, created_at from event_guests where event_id = ? and token = ? limit 1")
    .bind(eventId, token)
    .first<D1Row>();

  return row ? mapD1EventGuest(row) : null;
}

export async function getD1RsvpById(rsvpId: string): Promise<Rsvp | null> {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select id, event_id, guest_name, phone, email, attending, companions, message, dietary_restrictions, created_at from rsvps where id = ? limit 1")
    .bind(rsvpId)
    .first<D1Row>();

  return row ? mapD1Rsvp(row) : null;
}

export async function updateD1EventGuestRsvp(input: {
  guestId: string;
  eventId: string;
  rsvpId: string | null;
  status: EventGuest["status"];
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update event_guests set rsvp_id = ?, status = ?, last_opened_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ? and event_id = ?")
    .bind(input.rsvpId, input.status, input.guestId, input.eventId)
    .run();
}

export async function createD1EventGuest(input: {
  eventId: string;
  guestName: string;
  phone: string;
  email: string | null;
  maxCompanions: number;
  token: string;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("insert into event_guests (id, event_id, guest_name, phone, email, token, max_companions, status) values (?, ?, ?, ?, ?, ?, ?, 'pendiente')")
    .bind(crypto.randomUUID(), input.eventId, input.guestName, input.phone, input.email, input.token, input.maxCompanions)
    .run();
}

export async function deleteD1EventGuest(guestId: string, eventId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db.prepare("delete from event_guests where id = ? and event_id = ?").bind(guestId, eventId).run();
}

export async function updateD1EventGuestStatus(guestId: string, eventId: string, status: EventGuest["status"]) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update event_guests set status = ? where id = ? and event_id = ?")
    .bind(status, guestId, eventId)
    .run();
}

export async function listD1EventPhotos(eventId: string): Promise<EventPhoto[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, event_id, storage_path, public_url, guest_name, status, is_public, is_approved, approved_at, approved_by_event_login, created_at from event_photos where event_id = ? order by created_at desc")
    .bind(eventId)
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1EventPhoto);
}

export async function getD1EventLoginById(loginId: string) {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select id, event_id, username, password_hash, active, expires_at, last_login_at, created_at, updated_at, created_by from event_logins where id = ? limit 1")
    .bind(loginId)
    .first<D1Row>();

  return row ? mapD1EventLogin(row) : null;
}

export async function getD1EventLoginByUsername(username: string) {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("select id, event_id, username, password_hash, active, expires_at, last_login_at, created_at, updated_at, created_by from event_logins where username = ? limit 1")
    .bind(username)
    .first<D1Row>();

  return row ? mapD1EventLogin(row) : null;
}

export async function listD1EventLogins(eventId: string): Promise<EventLogin[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("select id, event_id, username, password_hash, active, expires_at, last_login_at, created_at, updated_at, created_by from event_logins where event_id = ? order by created_at desc")
    .bind(eventId)
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1EventLogin);
}

export async function createD1EventLogin(input: {
  eventId: string;
  username: string;
  passwordHash: string;
  createdBy: string | null;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");
  const id = crypto.randomUUID();

  await db
    .prepare("insert into event_logins (id, event_id, username, password_hash, active, created_by) values (?, ?, ?, ?, 1, ?)")
    .bind(id, input.eventId, input.username, input.passwordHash, input.createdBy)
    .run();

  return id;
}

export async function updateD1EventLoginPassword(loginId: string, passwordHash: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update event_logins set password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(passwordHash, loginId)
    .run();
}

export async function updateD1EventLoginActive(loginId: string, active: boolean) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update event_logins set active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(active ? 1 : 0, loginId)
    .run();
}

export async function updateD1EventLoginExpiration(loginId: string, expiresAt: string | null) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update event_logins set expires_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(expiresAt, loginId)
    .run();
}

export async function updateD1EventLoginLastLogin(loginId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare("update event_logins set last_login_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?")
    .bind(new Date().toISOString(), loginId)
    .run();
}

export async function updateD1EventPhotoStatus(input: {
  photoId: string;
  eventId: string;
  status: EventPhoto["status"];
  isPublic: boolean;
  approvedByEventLogin: string | null;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare(
      [
        "update event_photos set",
        "status = ?, is_public = ?, is_approved = ?, approved_at = ?, approved_by_event_login = ?",
        "where id = ? and event_id = ?"
      ].join(" ")
    )
    .bind(
      input.status,
      input.isPublic ? 1 : 0,
      input.status === "aprobada" && input.isPublic ? 1 : 0,
      input.status === "aprobada" ? new Date().toISOString() : null,
      input.status === "aprobada" ? input.approvedByEventLogin : null,
      input.photoId,
      input.eventId
    )
    .run();
}

export async function listD1ApprovedLivePhotos(eventId: string, limit = 60): Promise<LivePhoto[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      "select id, event_id, image_url, storage_path, guest_name, guest_message, approved, featured, rejected, created_at from live_photos where event_id = ? and approved = 1 and rejected = 0 order by created_at desc limit ?"
    )
    .bind(eventId, limit)
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1LivePhoto);
}

export async function listD1AllLivePhotos(eventId: string): Promise<LivePhoto[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      "select id, event_id, image_url, storage_path, guest_name, guest_message, approved, featured, rejected, created_at from live_photos where event_id = ? order by created_at desc"
    )
    .bind(eventId)
    .all<D1Row>();

  return (rows.results ?? []).map(mapD1LivePhoto);
}

export async function insertD1LivePhoto(input: {
  eventId: string;
  imageUrl: string;
  storagePath: string;
  guestName: string | null;
  guestMessage: string | null;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db
    .prepare(
      "insert into live_photos (id, event_id, image_url, storage_path, guest_name, guest_message, approved, featured, rejected) values (?, ?, ?, ?, ?, ?, 0, 0, 0)"
    )
    .bind(crypto.randomUUID(), input.eventId, input.imageUrl, input.storagePath, input.guestName, input.guestMessage)
    .run();
}

export async function updateD1LivePhotoStatus(photoId: string, eventId: string, input: Partial<Pick<LivePhoto, "approved" | "featured" | "rejected">>) {
  const updates: Record<string, D1Value> = {};
  if (typeof input.approved === "boolean") updates.approved = input.approved ? 1 : 0;
  if (typeof input.featured === "boolean") updates.featured = input.featured ? 1 : 0;
  if (typeof input.rejected === "boolean") updates.rejected = input.rejected ? 1 : 0;
  if (Object.keys(updates).length === 0) return;

  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");
  const entries = Object.entries(updates);
  await db
    .prepare(`update live_photos set ${entries.map(([key]) => `${key} = ?`).join(", ")} where id = ? and event_id = ?`)
    .bind(...entries.map(([, value]) => value), photoId, eventId)
    .run();
}

export async function deleteD1LivePhoto(photoId: string, eventId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await Promise.all([
    db.prepare("delete from live_photo_comments where event_id = ? and photo_id = ?").bind(eventId, photoId).run(),
    db.prepare("delete from live_photo_reactions where event_id = ? and photo_id = ?").bind(eventId, photoId).run()
  ]);
  await db.prepare("delete from live_photos where id = ? and event_id = ?").bind(photoId, eventId).run();
}

export async function deleteD1AllLivePhotos(eventId: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await Promise.all([
    db.prepare("delete from live_photo_comments where event_id = ?").bind(eventId).run(),
    db.prepare("delete from live_photo_reactions where event_id = ?").bind(eventId).run()
  ]);
  await db.prepare("delete from live_photos where event_id = ?").bind(eventId).run();
}

export function mapD1Event(row: D1Row): Event {
  const parsed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (EVENT_JSON_FIELDS.has(key)) {
      parsed[key] = parseJsonField(value);
    } else if (key === "is_active" || key.startsWith("is_")) {
      parsed[key] = Boolean(value);
    } else {
      parsed[key] = value;
    }
  }

  parsed.enabled_features = Array.isArray(parsed.enabled_features) ? parsed.enabled_features : [];
  parsed.disabled_features = Array.isArray(parsed.disabled_features) ? parsed.disabled_features : [];
  parsed.package_key = typeof parsed.package_key === "string" ? parsed.package_key : "essential";
  parsed.guest_mode = parsed.guest_mode === "lista_invitados" ? "lista_invitados" : "publico";
  parsed.status = typeof parsed.status === "string" ? parsed.status : "borrador";
  parsed.theme_color = typeof parsed.theme_color === "string" ? parsed.theme_color : "#111827";

  return parsed as Event;
}

function parseJsonField(value: D1Value) {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serializeD1Value(value: D1Value) {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

function parseJsonArray(value: D1Value) {
  const parsed = parseJsonField(value);
  return Array.isArray(parsed) ? parsed : [];
}

function parseObjectField(value: D1Value) {
  const parsed = parseJsonField(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function mapD1Client(row: D1Row) {
  return {
    ...row,
    status: row.status === "inactivo" ? "inactivo" : "activo"
  };
}

function mapD1CommercialPlan(row: D1Row) {
  return {
    ...row,
    features: parseJsonArray(row.features),
    active: row.active === 1 || row.active === true
  };
}

function mapD1EventCategory(row: D1Row): EventCategory {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active === 1 || row.is_active === true,
    created_at: String(row.created_at ?? "")
  };
}

function mapD1InvitationTheme(row: D1Row): InvitationTheme {
  return {
    id: String(row.id ?? ""),
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    preview_image_url: typeof row.preview_image_url === "string" ? row.preview_image_url : null,
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    default_design_config: parseObjectField(row.default_design_config),
    available_options: parseObjectField(row.available_options),
    is_premium: row.is_premium === 1 || row.is_premium === true,
    is_active: row.is_active === 1 || row.is_active === true,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? "")
  };
}

function mapD1CanvasV3Template(row: D1TemplateRow): CanvasV3Template {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    compatibleEventTypes: parseStringArray(row.compatible_event_types),
    visualCategory: typeof row.visual_category === "string" ? row.visual_category : undefined,
    description: typeof row.description === "string" ? row.description : undefined,
    templateScope: row.template_scope === "section" || row.template_scope === "component" ? row.template_scope : "full",
    design: (parseJsonField(row.design ?? null) ?? {}) as CanvasV3Design,
    previewImageUrl: typeof row.preview_image_url === "string" ? row.preview_image_url : undefined,
    thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : undefined,
    isPremium: row.is_premium === 1 || row.is_premium === true,
    isActive: row.is_active === 1 || row.is_active === true,
    sortOrder: Number(row.sort_order ?? 0),
    sourceEventId: typeof row.source_event_id === "string" ? row.source_event_id : undefined,
  };
}

function parseStringArray(value: D1Value | undefined): CanvasV3EventType[] {
  const parsed = parseJsonField(value ?? null);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => (typeof item === "string" ? normalizeCanvasV3EventType(item) : null))
    .filter((item): item is CanvasV3EventType => Boolean(item));
}

function mapD1Profile(row: D1Row) {
  return {
    ...row,
    role: row.role === "disenador" ? "dise\\u00f1ador" : row.role,
    is_active: row.is_active === 1 || row.is_active === true
  };
}

function normalizeD1Role(role: string) {
  if (role === "dise\\u00f1ador") return "disenador";
  return role;
}

function mapD1Rsvp(row: D1Row): Rsvp {
  return {
    id: String(row.id ?? ""),
    event_id: String(row.event_id ?? ""),
    guest_name: String(row.guest_name ?? ""),
    phone: typeof row.phone === "string" ? row.phone : null,
    email: typeof row.email === "string" ? row.email : null,
    attending: row.attending === 1 || row.attending === true,
    companions: Number(row.companions ?? 0),
    message: typeof row.message === "string" ? row.message : null,
    dietary_restrictions: typeof row.dietary_restrictions === "string" ? row.dietary_restrictions : null,
    created_at: String(row.created_at ?? "")
  };
}

function mapD1EventGuest(row: D1Row): EventGuest {
  return {
    id: String(row.id ?? ""),
    event_id: String(row.event_id ?? ""),
    guest_name: String(row.guest_name ?? ""),
    phone: String(row.phone ?? ""),
    email: typeof row.email === "string" ? row.email : null,
    token: String(row.token ?? ""),
    max_companions: Number(row.max_companions ?? 0),
    status: row.status === "confirmado" || row.status === "no_asiste" || row.status === "bloqueado" ? row.status : "pendiente",
    rsvp_id: typeof row.rsvp_id === "string" ? row.rsvp_id : null,
    last_opened_at: typeof row.last_opened_at === "string" ? row.last_opened_at : null,
    created_at: String(row.created_at ?? "")
  };
}

function mapD1EventPhoto(row: D1Row): EventPhoto {
  return {
    id: String(row.id ?? ""),
    event_id: String(row.event_id ?? ""),
    storage_path: String(row.storage_path ?? ""),
    public_url: String(row.public_url ?? ""),
    guest_name: typeof row.guest_name === "string" ? row.guest_name : null,
    status: row.status === "aprobada" || row.status === "rechazada" ? row.status : "pendiente",
    is_public: row.is_public === 1 || row.is_public === true,
    is_approved: row.is_approved === 1 || row.is_approved === true,
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
    approved_by_event_login: typeof row.approved_by_event_login === "string" ? row.approved_by_event_login : null,
    created_at: String(row.created_at ?? "")
  };
}

function mapD1EventLogin(row: D1Row): EventLogin {
  return {
    id: String(row.id ?? ""),
    event_id: String(row.event_id ?? ""),
    username: String(row.username ?? ""),
    password_hash: String(row.password_hash ?? ""),
    active: row.active === 1 || row.active === true,
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    last_login_at: typeof row.last_login_at === "string" ? row.last_login_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null
  };
}

function mapD1LivePhoto(row: D1Row): LivePhoto {
  return {
    id: String(row.id ?? ""),
    event_id: String(row.event_id ?? ""),
    image_url: String(row.image_url ?? ""),
    storage_path: String(row.storage_path ?? ""),
    guest_name: typeof row.guest_name === "string" ? row.guest_name : null,
    guest_message: typeof row.guest_message === "string" ? row.guest_message : null,
    approved: row.approved === 1 || row.approved === true,
    rejected: row.rejected === 1 || row.rejected === true,
    featured: row.featured === 1 || row.featured === true,
    created_at: String(row.created_at ?? "")
  };
}
