import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorV3 } from "./canvas-v3-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Canvas V3 · Editor experimental" };
}

export default async function CanvasV3Page({ params }: Props) {
  const { id } = await params;
  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, hosts_names, title, canvas_design")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <CanvasEditorV3
      eventId={data.id}
      eventTitle={data.hosts_names || data.title || "Evento"}
      initialDesign={data.canvas_design ?? null}
    />
  );
}
