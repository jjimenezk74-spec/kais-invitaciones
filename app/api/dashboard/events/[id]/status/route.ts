import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentD1UserProfile, isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";
import { updateD1EventStatus } from "@/lib/cloudflare/public-events";
import { canPublishEvents } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventStatus } from "@/lib/types";

type StatusRequestBody = {
  status?: unknown;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const nextStatus = await readRequestedStatus(request);

  if (!nextStatus) {
    return actionError(request, "Estado invalido. Usa publicado o borrador.", `/dashboard/eventos/${id}`, 400);
  }

  if (isCloudflareAuthEnabled()) {
    const { user, profile } = await getCurrentD1UserProfile();
    if (!user) {
      return actionError(request, "Tu sesion expiro. Vuelve a ingresar.", "/login", 401);
    }
    if (!canPublishEvents(profile)) {
      return actionError(request, "Tu rol no tiene permisos para publicar eventos.", `/dashboard/eventos/${id}`, 403);
    }

    try {
      await updateD1EventStatus(id, nextStatus);
    } catch (error) {
      return actionError(request, getErrorMessage(error), `/dashboard/eventos/${id}`, 500);
    }
  } else {
    const { user, profile } = await getCurrentUserProfile();
    if (!user) {
      return actionError(request, "Tu sesion expiro. Vuelve a ingresar.", "/login", 401);
    }
    if (!canPublishEvents(profile)) {
      return actionError(request, "Tu rol no tiene permisos para publicar eventos.", `/dashboard/eventos/${id}`, 403);
    }

    const admin = createAdminClient();
    const { error } = await admin.from("events").update({ status: nextStatus }).eq("id", id);
    if (error) {
      return actionError(request, error.message, `/dashboard/eventos/${id}`, 500);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/eventos/${id}`);
  return actionSuccess(request, `/dashboard/eventos/${id}?saved=status`);
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Usa el boton de publicacion del evento." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

async function readRequestedStatus(request: NextRequest): Promise<EventStatus | null> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as StatusRequestBody;
      return normalizeEventStatus(body.status);
    }

    const formData = await request.formData();
    return normalizeEventStatus(formData.get("status"));
  } catch {
    return null;
  }
}

function normalizeEventStatus(value: unknown): EventStatus | null {
  if (value === "publicado" || value === "borrador" || value === "inactivo") {
    return value;
  }
  return null;
}

function wantsActionJson(request: NextRequest) {
  return request.headers.get("x-kais-fetch-action") === "1";
}

function actionError(request: NextRequest, error: string, redirectTo: string, status: number) {
  if (wantsActionJson(request)) {
    return NextResponse.json({ ok: false, error, redirectTo }, { status });
  }

  const url = new URL(redirectTo, request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function actionSuccess(request: NextRequest, redirectTo: string) {
  if (wantsActionJson(request)) {
    return NextResponse.json({ ok: true, redirectTo });
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo actualizar el estado.";
}
