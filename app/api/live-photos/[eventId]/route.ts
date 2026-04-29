import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LivePhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  if (!eventId) {
    return NextResponse.json([], { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("live_photos")
    .select("*")
    .eq("event_id", eventId)
    .eq("approved", true)
    .eq("rejected", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json((data ?? []) as LivePhoto[], {
    headers: { "Cache-Control": "no-store" },
  });
}
