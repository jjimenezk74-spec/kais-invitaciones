import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rsvps")
    .select("guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
    .eq("event_id", id)
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
      "content-disposition": `attachment; filename="rsvps-${id}.csv"`
    }
  });
}
