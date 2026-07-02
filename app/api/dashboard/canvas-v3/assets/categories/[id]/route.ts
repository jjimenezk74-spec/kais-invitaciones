import { NextResponse } from "next/server";
import { canAccessDashboard } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { deleteD1CanvasV3AssetCategory } from "@/lib/cloudflare/canvas-v3-assets";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !canAccessDashboard(profile)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteD1CanvasV3AssetCategory(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar la categoria." },
      { status: 500 }
    );
  }
}
