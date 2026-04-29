import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { getApprovedLivePhotos } from "@/app/actions/live-photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, formatDate } from "@/lib/utils";
import type { Event, LivePhoto } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("hosts_names, event_type").eq("slug", slug).maybeSingle();
  const title = data ? `Álbum · ${data.hosts_names}` : "Álbum";
  return { title };
}

export default async function AlbumPage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, event_type, event_date, theme_color, status")
    .eq("slug", slug)
    .maybeSingle();

  const event = data as Event | null;
  if (!event) notFound();

  if (event.status !== "publicado") {
    return <AlbumUnavailable slug={slug} />;
  }

  const photos = await getApprovedLivePhotos(event.id);
  const featured = photos.filter((p) => p.featured);
  const rest = photos.filter((p) => !p.featured);
  const accent = event.theme_color ?? "#d4af37";
  const uploadUrl = absoluteUrl(`/evento/${slug}/fotos`);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link
            href={`/evento/${slug}`}
            className="text-[0.65rem] font-black tracking-[0.22em] text-foreground/70 hover:text-foreground"
          >
            KAIS INVITACIONES
          </Link>
          <Link
            href={uploadUrl}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted"
            style={{ borderColor: accent, color: accent }}
          >
            <Camera className="h-3.5 w-3.5" />
            Subir foto
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10">
        {/* Hero section */}
        <div className="mb-12 text-center">
          <p
            className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.28em]"
            style={{ color: accent }}
          >
            Álbum del evento
          </p>
          <h1 className="font-display text-4xl font-light tracking-tight text-foreground md:text-5xl">
            {event.hosts_names}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatDate(event.event_date)} ·{" "}
            <span className="capitalize">{event.event_type}</span>
          </p>
          {photos.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {photos.length} {photos.length === 1 ? "foto" : "fotos"}
            </p>
          )}
        </div>

        {photos.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: `${accent}15` }}
            >
              <Camera className="h-9 w-9" style={{ color: accent }} />
            </div>
            <p className="text-lg font-semibold text-foreground">
              El álbum está vacío por ahora
            </p>
            <p className="text-sm text-muted-foreground">
              ¡Sé el primero en compartir un momento!
            </p>
            <Link
              href={uploadUrl}
              className="mt-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition"
              style={{ background: accent }}
            >
              Subir una foto
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {/* Featured photos — large */}
            {featured.length > 0 && (
              <section>
                <div className="mb-5 flex items-center gap-3">
                  <span className="text-amber-400">★</span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Destacadas
                  </h2>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((photo) => (
                    <AlbumCard key={photo.id} photo={photo} accent={accent} large />
                  ))}
                </div>
              </section>
            )}

            {/* Rest of photos */}
            {rest.length > 0 && (
              <section>
                {featured.length > 0 && (
                  <div className="mb-5 flex items-center gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Todas las fotos
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {rest.map((photo) => (
                    <AlbumCard key={photo.id} photo={photo} accent={accent} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Upload CTA at bottom */}
        {photos.length > 0 && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">¿Tienes fotos del evento?</p>
            <Link
              href={uploadUrl}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition"
              style={{ background: accent }}
            >
              <Camera className="h-4 w-4" />
              Subir tu foto
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Album card ────────────────────────────────────────────────────────────────

function AlbumCard({
  photo,
  accent,
  large = false,
}: {
  photo: LivePhoto;
  accent: string;
  large?: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <div
        className={`relative w-full overflow-hidden bg-muted ${large ? "aspect-[4/3]" : "aspect-square"}`}
      >
        <Image
          src={photo.image_url}
          alt={photo.guest_name ?? "Foto del evento"}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Gradient for caption readability */}
        {(photo.guest_name || photo.guest_message) && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        )}
      </div>

      {(photo.guest_name || photo.guest_message) && (
        <div className="px-4 py-3">
          {photo.guest_name && (
            <p className="truncate text-sm font-semibold text-foreground">
              {photo.guest_name}
            </p>
          )}
          {photo.guest_message && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              &ldquo;{photo.guest_message}&rdquo;
            </p>
          )}
        </div>
      )}
    </article>
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
            Album no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            El album estara disponible cuando la invitacion sea publicada.
          </p>
          <Link
            href={`/evento/${slug}`}
            className="mt-6 inline-flex rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted"
          >
            Volver a la invitacion
          </Link>
        </div>
      </main>
    </div>
  );
}
