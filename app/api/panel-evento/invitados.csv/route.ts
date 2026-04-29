import { NextResponse } from "next/server";
import { getEventLoginSession } from "@/lib/event-login-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const login = await getEventLoginSession();

  if (!login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_guests")
    .select("guest_name,phone,email,status,max_companions,last_opened_at,rsvp_id")
    .eq("event_id", login.event_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rsvpIds = (data ?? []).map((row) => row.rsvp_id).filter(Boolean);
  const { data: rsvpRows } = rsvpIds.length
    ? await admin.from("rsvps").select("id,attending,companions,message,dietary_restrictions,created_at").in("id", rsvpIds)
    : { data: [] };
  const rsvpsById = new Map((rsvpRows ?? []).map((rsvp) => [rsvp.id, rsvp]));

  const header = [
    "nombre",
    "telefono",
    "email",
    "estado",
    "cupo_total",
    "asistira",
    "acompanantes_adicionales",
    "mensaje",
    "restriccion_alimentaria",
    "ultima_apertura",
    "fecha_rsvp"
  ];
  const csv = [
    header.join(","),
    ...(data ?? []).map((row) => {
      const rsvp = row.rsvp_id ? rsvpsById.get(row.rsvp_id) : null;
      return [
        row.guest_name,
        row.phone,
        row.email,
        row.status,
        row.max_companions + 1,
        typeof rsvp?.attending === "boolean" ? (rsvp.attending ? "si" : "no") : "",
        rsvp?.companions,
        rsvp?.message,
        rsvp?.dietary_restrictions,
        row.last_opened_at,
        rsvp?.created_at
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",");
    })
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="invitados-${login.event_id}.csv"`
    }
  });
}
