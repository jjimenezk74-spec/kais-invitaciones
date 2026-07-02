import { getD1Database } from "./d1";

type AssetCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  category_id: string | null;
  name: string;
  file_url: string;
  storage_key: string;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CanvasV3AssetCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CanvasV3Asset = {
  id: string;
  categoryId: string | null;
  name: string;
  fileUrl: string;
  storageKey: string;
  mimeType: string | null;
  fileSize: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function listD1CanvasV3AssetLibrary() {
  const db = await getD1Database();
  if (!db) return { categories: [] as CanvasV3AssetCategory[], assets: [] as CanvasV3Asset[] };

  const [categories, assets] = await Promise.all([
    db.prepare(
      "select id, name, slug, sort_order, created_at, updated_at from canvas_v3_asset_categories order by sort_order asc, name asc"
    ).all<AssetCategoryRow>(),
    db.prepare(
      "select id, category_id, name, file_url, storage_key, mime_type, file_size, sort_order, created_at, updated_at from canvas_v3_assets order by sort_order asc, created_at desc"
    ).all<AssetRow>()
  ]);

  return {
    categories: (categories.results ?? []).map(mapCategory),
    assets: (assets.results ?? []).map(mapAsset)
  };
}

export async function createD1CanvasV3AssetCategory(name: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!cleanName) throw new Error("Nombre de categoria requerido.");

  const baseSlug = slugify(cleanName);
  const slug = await createUniqueCategorySlug(baseSlug);
  const id = crypto.randomUUID();

  await db.prepare(
    "insert into canvas_v3_asset_categories (id, name, slug) values (?, ?, ?)"
  ).bind(id, cleanName, slug).run();

  const row = await db.prepare(
    "select id, name, slug, sort_order, created_at, updated_at from canvas_v3_asset_categories where id = ?"
  ).bind(id).first<AssetCategoryRow>();

  if (!row) throw new Error("No se pudo crear la categoria.");
  return mapCategory(row);
}

export async function createD1CanvasV3Asset(input: {
  categoryId?: string | null;
  name: string;
  fileUrl: string;
  storageKey: string;
  mimeType?: string | null;
  fileSize?: number | null;
}) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 90);
  if (!name) throw new Error("Nombre del recurso requerido.");
  if (!input.fileUrl || !input.storageKey) throw new Error("Archivo invalido.");

  const categoryId = input.categoryId || null;
  if (categoryId) {
    const category = await db.prepare("select id from canvas_v3_asset_categories where id = ?").bind(categoryId).first<{ id: string }>();
    if (!category) throw new Error("Categoria no encontrada.");
  }

  const id = crypto.randomUUID();
  await db.prepare(
    [
      "insert into canvas_v3_assets",
      "(id, category_id, name, file_url, storage_key, mime_type, file_size)",
      "values (?, ?, ?, ?, ?, ?, ?)"
    ].join(" ")
  ).bind(
    id,
    categoryId,
    name,
    input.fileUrl,
    input.storageKey,
    input.mimeType ?? null,
    input.fileSize ?? null
  ).run();

  const row = await getD1CanvasV3AssetRow(id);
  if (!row) throw new Error("No se pudo guardar el recurso.");
  return mapAsset(row);
}

export async function deleteD1CanvasV3Asset(id: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const row = await getD1CanvasV3AssetRow(id);
  if (!row) return null;

  await db.prepare("delete from canvas_v3_assets where id = ?").bind(id).run();
  return mapAsset(row);
}

export async function deleteD1CanvasV3AssetCategory(id: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  await db.prepare("delete from canvas_v3_asset_categories where id = ?").bind(id).run();
}

async function getD1CanvasV3AssetRow(id: string) {
  const db = await getD1Database();
  if (!db) return null;
  return db.prepare(
    "select id, category_id, name, file_url, storage_key, mime_type, file_size, sort_order, created_at, updated_at from canvas_v3_assets where id = ?"
  ).bind(id).first<AssetRow>();
}

async function createUniqueCategorySlug(baseSlug: string) {
  const db = await getD1Database();
  if (!db) throw new Error("D1 no esta disponible.");

  const base = baseSlug || "categoria";
  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await db.prepare("select id from canvas_v3_asset_categories where slug = ?").bind(slug).first<{ id: string }>();
    if (!existing) return slug;
  }
  return `${base}-${Date.now()}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function mapCategory(row: AssetCategoryRow): CanvasV3AssetCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAsset(row: AssetRow): CanvasV3Asset {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    fileUrl: row.file_url,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSize: row.file_size == null ? null : Number(row.file_size),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
