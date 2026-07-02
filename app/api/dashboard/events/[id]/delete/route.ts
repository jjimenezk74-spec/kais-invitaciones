import { NextResponse, type NextRequest } from "next/server";
import { getCurrentD1UserProfile, isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";
import { deleteD1Event, getD1EventByIdOrSlug } from "@/lib/cloudflare/public-events";
import { canDeleteEvents } from "@/lib/permissions";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isCloudflareAuthEnabled()) {
    return actionError(request, "Este flujo solo esta disponible en Cloudflare.");
  }

  const { user, profile } = await getCurrentD1UserProfile();
  if (!user) {
    return actionError(request, "Tu sesion expiro. Vuelve a ingresar.", "/login", 401);
  }
  if (!canDeleteEvents(profile)) {
    return actionError(request, "Tu rol no tiene permisos para eliminar eventos.", "/dashboard", 403);
  }

  const { id } = await context.params;
  const event = await getD1EventByIdOrSlug(id);
  if (!event) {
    return actionError(request, "Evento no encontrado.", "/dashboard", 404);
  }

  try {
    await deleteD1Event(id);
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("deleted", event.title);
    return actionSuccess(request, `${url.pathname}${url.search}`);
  } catch (error) {
    return actionError(request, getErrorMessage(error));
  }
}

export function GET(request: NextRequest) {
  return redirectToDashboard(request, "No se elimino el evento. Usa el boton Eliminar evento desde Ajustes.");
}

function redirectToDashboard(request: NextRequest, error: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

function wantsActionJson(request: NextRequest) {
  return request.headers.get("x-kais-fetch-action") === "1";
}

function actionError(request: NextRequest, error: string, redirectTo = "/dashboard", status = 400) {
  if (wantsActionJson(request)) {
    return NextResponse.json({ ok: false, error, redirectTo }, { status });
  }

  if (redirectTo === "/dashboard") {
    return redirectToDashboard(request, error);
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
  return error instanceof Error ? error.message : "No se pudo eliminar el evento.";
}
