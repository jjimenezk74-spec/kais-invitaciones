import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getPublicLivePhotoInteractions } from "@/app/actions/live-photo-interactions";
import { getApprovedLivePhotos } from "@/app/actions/live-photos";
import { EventLiveView } from "@/components/live-album/event-live-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { shortPhotoUploadUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("hosts_names")
    .eq("slug", slug)
    .maybeSingle();

  return {
    title: data ? `Live · ${data.hosts_names}` : "KAIS Live",
    robots: "noindex",
  };
}

export default async function EventLivePage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, status")
    .eq("slug", slug)
    .maybeSingle();

  const event = data as Event | null;
  if (!event || event.status !== "publicado") notFound();

  const photos = await getApprovedLivePhotos(event.id);
  const interactions = await getPublicLivePhotoInteractions(
    event.id,
    photos.map((photo) => photo.id),
  );

  const initialComments = Object.values(interactions.commentsByPhotoId)
    .flat()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 8);

  const initialReactions = Object.entries(interactions.reactionsByPhotoId).flatMap(([photoId, counts]) =>
    Object.entries(counts).flatMap(([emoji, count]) =>
      Array.from({ length: Math.min(count, 3) }, (_, index) => ({
        id: `${photoId}-${emoji}-${index}`,
        photo_id: photoId,
        event_id: event.id,
        emoji,
        created_at: new Date(0).toISOString(),
      })),
    ),
  );
  const initialReactionSummary = Object.values(interactions.reactionsByPhotoId).reduce<Record<string, number>>(
    (summary, counts) => {
      for (const [emoji, count] of Object.entries(counts)) {
        summary[emoji] = (summary[emoji] ?? 0) + count;
      }
      return summary;
    },
    {},
  );
  const uploadUrl = shortPhotoUploadUrl(event.slug);
  const qrDataUrl = await QRCode.toDataURL(uploadUrl, {
    width: 220,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return (
    <EventLiveView
      eventId={event.id}
      eventName={event.hosts_names}
      initialPhotos={photos}
      initialComments={initialComments}
      initialReactions={initialReactions}
      initialReactionSummary={initialReactionSummary}
      uploadUrl={uploadUrl}
      qrDataUrl={qrDataUrl}
    />
  );
}
