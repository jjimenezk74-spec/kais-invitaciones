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
    .from("rsvps")
    .select("guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
    .eq("event_id", login.event_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ["nombre", "telefono", "email", "asistira", "acompanantes", "mensaje", "restriccion_alimentaria", "fecha"];
  const csv = [
    header.join(","),
    ...(data ?? []).map((row) =>
      [
        row.guest_name,
        row.phone,
        row.email,
        row.attending ? "si" : "no",
        row.companions,
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
      "content-disposition": `attachment; filename="rsvps-${login.event_id}.csv"`
    }
  });
}
