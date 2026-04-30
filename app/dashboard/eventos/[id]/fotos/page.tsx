import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, QrCode } from "lucide-react";
import { PhotoAdminGrid } from "@/components/live-album/photo-admin-grid";
import { LiveScreenActions } from "@/components/live-screen-actions";
import { getAllLivePhotos } from "@/app/actions/live-photos";
import { canManagePhotos } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, shortLiveScreenUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("hosts_names").eq("id", id).single();
  return { title: data ? `Live Album · ${data.hosts_names}` : "Live Album" };
}

export default async function LiveAlbumAdminPage({ params }: Props) {
  const { id } = await params;
  const { profile } = await getCurrentUserProfile();
  if (!canManagePhotos(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, event_type, event_date, theme_color")
    .eq("id", id)
    .single();

  const event = data as Event | null;
  if (!event) notFound();

  const photos = await getAllLivePhotos(id);

  const pending = photos.filter((p) => !p.approved && !p.rejected).length;
  const approved = photos.filter((p) => p.approved && !p.rejected).length;
  const featured = photos.filter((p) => p.featured).length;

  const uploadUrl = absoluteUrl(`/evento/${event.slug}/fotos`);
  const livePath = `/l/${event.slug}`;
  const liveUrl = shortLiveScreenUrl(event.slug);
  const albumUrl = absoluteUrl(`/evento/${event.slug}/album`);

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/eventos/${id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al evento
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Live Album
        </p>
        <h1 className="font-display text-3xl font-bold">{event.hosts_names}</h1>
        <p className="text-sm text-muted-foreground capitalize">{event.event_type}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Total", photos.length, "text-foreground"],
          ["Pendientes", pending, "text-amber-600"],
          ["Aprobadas", approved, "text-emerald-600"],
          ["Destacadas", featured, "text-amber-500"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <LiveScreenActions livePath={livePath} liveUrl={liveUrl} />
        <a
          href={uploadUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-muted"
        >
          <QrCode className="h-4 w-4" />
          Enlace de subida
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        <a
          href={albumUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-muted"
        >
          Álbum público
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      </div>

      {/* Photo grid */}
      <PhotoAdminGrid photos={photos} eventId={id} />
    </div>
  );
}
