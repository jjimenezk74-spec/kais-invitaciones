import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, QrCode } from "lucide-react";
import {
  LiveAlbumAdminActions,
  PhotoAdminGrid,
} from "@/components/live-album/photo-admin-grid";
import { LiveScreenActions } from "@/components/live-screen-actions";
import { getAllLivePhotos } from "@/app/actions/live-photos";
import { getD1EventByIdOrSlug } from "@/lib/cloudflare/public-events";
import { canManagePhotos } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, shortLiveScreenUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const isCloudflareMode = () => process.env.USE_CLOUDFLARE_AUTH === "1";

async function getLiveAlbumEvent(id: string): Promise<Event | null> {
  if (isCloudflareMode()) {
    return getD1EventByIdOrSlug(id);
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, title, event_type, event_date, theme_color")
    .eq("id", id)
    .single();

  return data as Event | null;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;

  try {
    const event = await getLiveAlbumEvent(id);
    const eventName = event?.hosts_names || event?.title;
    return { title: eventName ? `Live Album - ${eventName}` : "Live Album" };
  } catch {
    return { title: "Live Album" };
  }
}

export default async function LiveAlbumAdminPage({ params }: Props) {
  const { id } = await params;
  const { profile } = await getCurrentUserProfile();
  if (!canManagePhotos(profile)) redirect("/dashboard");

  const event = await getLiveAlbumEvent(id);
  if (!event) notFound();

  const photos = await getAllLivePhotos(id);

  const pending = photos.filter((p) => !p.approved && !p.rejected).length;
  const approved = photos.filter((p) => p.approved && !p.rejected).length;
  const featured = photos.filter((p) => p.featured).length;

  const eventName = event.hosts_names || event.title;
  const uploadUrl = absoluteUrl(`/evento/${event.slug}/fotos`);
  const livePath = `/l/${event.slug}`;
  const liveUrl = shortLiveScreenUrl(event.slug);
  const albumUrl = absoluteUrl(`/evento/${event.slug}/album`);
  const stats = [
    ["Total", photos.length, "text-foreground"],
    ["Pendientes", pending, "text-amber-600"],
    ["Aprobadas", approved, "text-emerald-600"],
    ["Destacadas", featured, "text-amber-500"],
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <section className="flex min-w-0 flex-col gap-5">
        <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
          <Link
            href={`/dashboard/eventos/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al evento
          </Link>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Live Album
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{eventName}</h1>
              <p className="mt-1 text-sm text-muted-foreground capitalize">{event.event_type}</p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:min-w-[420px]">
              {stats.map(([label, value, color]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-border bg-background px-3 py-2"
                >
                  <p className="truncate text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className={`mt-0.5 text-2xl font-bold leading-none ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PhotoAdminGrid
          photos={photos}
          eventId={id}
          eventSlug={event.slug}
          showAdminActions={false}
        />
      </section>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Enlaces rápidos
          </p>
          <div className="mt-3 grid gap-2">
            <LiveScreenActions livePath={livePath} liveUrl={liveUrl} variant="light" />
            <a
              href={uploadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted"
            >
              <span className="inline-flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Enlace de subida
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <a
              href={albumUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted"
            >
              <span>Álbum público</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        </section>

        <LiveAlbumAdminActions photos={photos} eventId={id} eventSlug={event.slug} compact />
      </aside>
    </div>
  );
}
