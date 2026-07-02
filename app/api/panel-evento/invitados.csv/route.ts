import { NextResponse } from "next/server";
import { getEventLoginSession } from "@/lib/event-login-auth";
import { isCloudflareAuthEnabled } from "@/lib/cloudflare/auth";
import { listD1EventGuests, listD1Rsvps } from "@/lib/cloudflare/public-events";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const login = await getEventLoginSession();

  if (!login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cloudflareMode = isCloudflareAuthEnabled();
  const admin = cloudflareMode ? null : createAdminClient();
  const data = cloudflareMode
    ? await listD1EventGuests(login.event_id)
    : (await admin!
        .from("event_guests")
        .select("guest_name,phone,email,status,max_companions,last_opened_at,rsvp_id")
        .eq("event_id", login.event_id)
        .order("created_at", { ascending: false })).data ?? [];

  const rsvpIds = data.map((row) => row.rsvp_id).filter(Boolean);
  const rsvpRows = cloudflareMode
    ? (await listD1Rsvps(login.event_id)).filter((rsvp) => rsvpIds.includes(rsvp.id))
    : rsvpIds.length
      ? (await admin!.from("rsvps").select("id,attending,companions,message,dietary_restrictions,created_at").in("id", rsvpIds)).data ?? []
      : [];
  const rsvpsById = new Map((rsvpRows ?? []).map((rsvp) => [rsvp.id, rsvp]));

  const header = [
    "nombre",
    "telefono",
    "email",
    "estado",
    "cupo_total",
    "asistira",
    "acompanantes_adicionales",
    "total_confirmado",
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
        rsvp?.attending ? Number(rsvp?.companions ?? 0) + 1 : 0,
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
