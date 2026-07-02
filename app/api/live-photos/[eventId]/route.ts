import { NextResponse } from "next/server";
import { insertLivePhoto } from "@/app/actions/insert-live-photo";
import { getD1EventByIdOrSlug, listD1ApprovedLivePhotos } from "@/lib/cloudflare/public-events";
import { uploadFileToR2Media } from "@/lib/cloudflare/r2";
import { canUploadEventPhotos } from "@/lib/event-time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LivePhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  if (!eventId) {
    return NextResponse.json([], { status: 400 });
  }

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    return NextResponse.json(await listD1ApprovedLivePhotos(eventId), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("live_photos")
    .select("*")
    .eq("event_id", eventId)
    .eq("approved", true)
    .eq("rejected", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json((data ?? []) as LivePhoto[], {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "Evento requerido." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const guestName = cleanText(formData.get("guest_name"), 80);
  const guestMessage = cleanText(formData.get("guest_message"), 280);

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Selecciona una foto." }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ ok: false, error: "La imagen no puede superar 10 MB." }, { status: 400 });
  }
  if (file.type && !ALLOWED_PHOTO_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Solo se permiten fotos JPG, PNG o WEBP." }, { status: 400 });
  }

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const event = await getD1EventByIdOrSlug(eventId);
    if (!event) return NextResponse.json({ ok: false, error: "Evento no encontrado." }, { status: 404 });
    if (event.status !== "publicado") return NextResponse.json({ ok: false, error: "El evento no esta activo." }, { status: 400 });
    if (!canUploadEventPhotos(event)) {
      return NextResponse.json({ ok: false, error: "La subida de fotos estara disponible el dia del evento." }, { status: 400 });
    }
  }

  try {
    const storagePath = `${eventId}/${crypto.randomUUID()}${getFileExtension(file.name) || ".jpg"}`;
    const imageUrl = await uploadFileToR2Media({
      file,
      prefix: `live-photos/${eventId}`,
      contentType: file.type || getImageContentType(file.name),
      baseUrl: process.env.NEXT_PUBLIC_APP_URL
    });

    const result = await insertLivePhoto({
      event_id: eventId,
      image_url: imageUrl,
      storage_path: storagePath,
      guest_name: guestName,
      guest_message: guestMessage
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, image_url: imageUrl });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo subir la foto." },
      { status: 500 }
    );
  }
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function getFileExtension(fileName: string) {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  return [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : "";
}

function getImageContentType(fileName: string) {
  const extension = getFileExtension(fileName);
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}
