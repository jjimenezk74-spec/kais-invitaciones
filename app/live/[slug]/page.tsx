import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { LiveSlideshow } from "@/components/live-album/live-slideshow";
import { getApprovedLivePhotos } from "@/app/actions/live-photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("hosts_names").eq("slug", slug).single();
  return {
    title: data ? `Live · ${data.hosts_names}` : "KAIS Live",
    robots: "noindex",
  };
}

export default async function LivePage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, status")
    .eq("slug", slug)
    .single();

  const event = data as Event | null;
  if (!event || event.status !== "publicado") notFound();

  const [photos, qrDataUrl] = await Promise.all([
    getApprovedLivePhotos(event.id),
    QRCode.toDataURL(absoluteUrl(`/evento/${slug}/fotos`), {
      width: 240,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    }),
  ]);

  return (
    <LiveSlideshow
      initialPhotos={photos}
      eventId={event.id}
      qrDataUrl={qrDataUrl}
      uploadUrl={absoluteUrl(`/evento/${slug}/fotos`)}
      hostsNames={event.hosts_names}
    />
  );
}
