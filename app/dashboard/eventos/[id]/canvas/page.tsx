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
    .select("id, slug, title, hosts_names, cover_image_url, canvas_design")
    .eq("id", id)
    .single();

  if (!data) notFound();

  return (
    <CanvasEditorClient
      eventId={data.id}
      eventSlug={data.slug}
      eventTitle={data.hosts_names}
      coverImageUrl={data.cover_image_url ?? null}
      initialDesign={(data.canvas_design as CanvasDesign | null) ?? null}
    />
  );
}
