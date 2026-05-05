import { notFound, redirect } from "next/navigation";
import { canEditEventDesign } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { CanvasEditorClient } from "./editor-client";
import type { CanvasDesign } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("hosts_names")
    .eq("id", id)
    .single();
  return { title: data ? `Editor · ${data.hosts_names}` : "Editor canvas" };
}

export default async function CanvasEditorPage({ params }: Props) {
  const { id } = await params;

  const { profile } = await getCurrentUserProfile();
  if (!canEditEventDesign(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, canvas_design")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const row = data as Record<string, unknown>;

  return (
    <CanvasEditorClient
      eventId={row.id as string}
      eventSlug={row.slug as string}
      eventTitle={row.hosts_names as string}
      initialDesign={(row.canvas_design as CanvasDesign | null) ?? null}
    />
  );
}
