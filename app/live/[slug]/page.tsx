import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { LiveSlideshow } from "@/components/live-album/live-slideshow";
import { getApprovedLivePhotos } from "@/app/actions/live-photos";
import { getD1PublicEventBySlug } from "@/lib/cloudflare/public-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;

  if (process.env.USE_CLOUDFLARE_AUTH === "1") {
    const event = await getD1PublicEventBySlug(slug);
    return {
      title: event ? `Live · ${event.hosts_names}` : "KAIS Live",
      robots: "noindex",
    };
  }

  const { data } = await createAdminClient().from("events").select("hosts_names").eq("slug", slug).single();
  return {
    title: data ? `Live · ${data.hosts_names}` : "KAIS Live",
    robots: "noindex",
  };
}

export default async function LivePage({ params }: Props) {
  const { slug } = await params;
  const event = process.env.USE_CLOUDFLARE_AUTH === "1"
    ? await getD1PublicEventBySlug(slug)
    : ((await createAdminClient()
        .from("events")
        .select("id, slug, hosts_names, status")
        .eq("slug", slug)
        .single()).data as Event | null);

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
