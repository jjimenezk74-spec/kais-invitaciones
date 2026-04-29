import { NextResponse } from "next/server";
import { canViewRsvps } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewRsvps(profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("rsvps")
    .select("id,guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rsvpIds = (data ?? []).map((row) => row.id).filter(Boolean);
  const { data: guestRows } = rsvpIds.length
    ? await admin.from("event_guests").select("rsvp_id,max_companions").eq("event_id", id).in("rsvp_id", rsvpIds)
    : { data: [] };
  const cupoByRsvpId = new Map((guestRows ?? []).map((guest) => [guest.rsvp_id, Number(guest.max_companions ?? 0) + 1]));

  const header = ["nombre", "telefono", "email", "asistira", "cupo_total", "acompanantes_confirmados", "total_confirmado", "mensaje", "restriccion_alimentaria", "fecha"];
  const csv = [
    header.join(","),
    ...(data ?? []).map((row) =>
      [
        row.guest_name,
        row.phone,
        row.email,
        row.attending ? "si" : "no",
        cupoByRsvpId.get(row.id) ?? "",
        row.companions,
        row.attending ? Number(row.companions ?? 0) + 1 : 0,
        row.message,
        row.dietary_restrictions,
        row.created_at
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rsvps-${id}.csv"`
    }
  });
}
