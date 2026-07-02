import { NextResponse } from "next/server";
import { canAccessDashboard } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import {
  createD1CanvasV3Asset,
  listD1CanvasV3AssetLibrary
} from "@/lib/cloudflare/canvas-v3-assets";
import { uploadFileToR2MediaWithKey } from "@/lib/cloudflare/r2";

const MAX_ASSET_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET() {
  const authorized = await ensureDashboardAccess();
  if (!authorized.ok) return authorized.response;

  const library = await listD1CanvasV3AssetLibrary();
  return NextResponse.json({ ok: true, ...library });
}

export async function POST(request: Request) {
  const authorized = await ensureDashboardAccess();
  if (!authorized.ok) return authorized.response;

  const formData = await request.formData();
  const file = formData.get("file");
  const categoryId = cleanOptionalString(formData.get("categoryId"));
  const requestedName = cleanOptionalString(formData.get("name"));

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Selecciona una imagen." }, { status: 400 });
  }

  const validationError = validateAssetFile(file);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    const uploaded = await uploadFileToR2MediaWithKey({
      file,
      prefix: "canvas-v3/assets",
      contentType: file.type || fallbackImageContentType(file.name),
      baseUrl: process.env.NEXT_PUBLIC_APP_URL
    });

    const asset = await createD1CanvasV3Asset({
      categoryId,
      name: requestedName || file.name.replace(/\.[a-z0-9]+$/i, ""),
      fileUrl: uploaded.url,
      storageKey: uploaded.key,
      mimeType: file.type || fallbackImageContentType(file.name),
      fileSize: file.size
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo subir el recurso." },
      { status: 500 }
    );
  }
}

async function ensureDashboardAccess() {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !canAccessDashboard(profile)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
    };
  }
  return { ok: true as const };
}

function validateAssetFile(file: File) {
  if (file.size > MAX_ASSET_SIZE) return "La imagen no debe superar 5MB.";
  if (file.type && !IMAGE_TYPES.has(file.type)) return "Formato permitido: JPG, PNG o WEBP.";
  return "";
}

function fallbackImageContentType(fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function cleanOptionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}
