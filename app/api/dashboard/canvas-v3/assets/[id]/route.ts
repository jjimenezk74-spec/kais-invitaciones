import { NextResponse } from "next/server";
import { canAccessDashboard } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { deleteD1CanvasV3Asset } from "@/lib/cloudflare/canvas-v3-assets";
import { deleteR2MediaKey } from "@/lib/cloudflare/r2";

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
    const asset = await deleteD1CanvasV3Asset(id);
    if (asset?.storageKey) {
      await deleteR2MediaKey(asset.storageKey).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar el recurso." },
      { status: 500 }
    );
  }
}
