import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { getPublicLivePhotoInteractions } from "@/app/actions/live-photo-interactions";
import { getApprovedLivePhotos } from "@/app/actions/live-photos";
import { PublicLiveAlbum } from "@/components/live-album/public-live-album";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { canUploadEventPhotos } from "@/lib/event-time";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("hosts_names, event_type")
    .eq("slug", slug)
    .maybeSingle();

  const title = data ? `Álbum · ${data.hosts_names}` : "Álbum";
  return { title };
}

export default async function AlbumPage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, event_type, event_date, event_time, theme_color, status")
    .eq("slug", slug)
    .maybeSingle();

  const event = data as Event | null;
  if (!event) notFound();

  if (event.status !== "publicado") {
    return <AlbumUnavailable slug={slug} />;
  }

  const photos = await getApprovedLivePhotos(event.id);
  const interactions = await getPublicLivePhotoInteractions(
    event.id,
    photos.map((photo) => photo.id),
  );

  return (
    <PublicLiveAlbum
      eventId={event.id}
      eventSlug={slug}
      title={event.hosts_names}
      dateLabel={formatDate(event.event_date)}
      eventType={event.event_type}
      accentColor={event.theme_color ?? "#d4af37"}
      photos={photos}
      commentsByPhotoId={interactions.commentsByPhotoId}
      reactionsByPhotoId={interactions.reactionsByPhotoId}
      canUploadPhotos={canUploadEventPhotos(event)}
    />
  );
}

function AlbumUnavailable({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Camera className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Álbum no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            El álbum estará disponible cuando la invitación sea publicada.
          </p>
          <Link
            href={`/evento/${slug}`}
            className="mt-6 inline-flex rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted"
          >
            Volver a la invitación
          </Link>
        </div>
      </main>
    </div>
  );
}
