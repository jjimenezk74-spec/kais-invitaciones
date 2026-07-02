import { NextResponse } from "next/server";
import { canAccessDashboard } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { uploadFileToR2Media } from "@/lib/cloudflare/r2";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]);

export async function POST(request: Request) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !canAccessDashboard(profile)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const bucket = String(formData.get("bucket") ?? "event-photos");
  const path = String(formData.get("path") ?? "uploads");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
  }

  const validationError = validateUpload(file, bucket);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    const url = await uploadFileToR2Media({
      file,
      prefix: `${bucket}/${path}`,
      contentType: file.type || getFallbackContentType(file.name, bucket),
      baseUrl: process.env.NEXT_PUBLIC_APP_URL
    });

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo subir el archivo." },
      { status: 500 }
    );
  }
}

function validateUpload(file: File, bucket: string) {
  if (bucket === "event-audio") {
    if (file.size > MAX_AUDIO_SIZE) return "La musica no debe superar 10MB.";
    if (file.type && !AUDIO_TYPES.has(file.type)) return "Formato de audio no permitido.";
    return "";
  }

  if (file.size > MAX_IMAGE_SIZE) return "La imagen no debe superar 5MB.";
  if (file.type && !IMAGE_TYPES.has(file.type)) return "Formato de imagen no permitido.";
  return "";
}

function getFallbackContentType(fileName: string, bucket: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (bucket === "event-audio") {
    if (extension === ".wav") return "audio/wav";
    if (extension === ".ogg") return "audio/ogg";
    return "audio/mpeg";
  }
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}
