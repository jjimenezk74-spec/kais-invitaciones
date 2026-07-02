import { NextResponse } from "next/server";
import { canAccessDashboard } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createD1CanvasV3AssetCategory } from "@/lib/cloudflare/canvas-v3-assets";

export async function POST(request: Request) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !canAccessDashboard(profile)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, error: "Nombre de categoria requerido." }, { status: 400 });
  }

  try {
    const category = await createD1CanvasV3AssetCategory(name);
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo crear la categoria." },
      { status: 500 }
    );
  }
}
