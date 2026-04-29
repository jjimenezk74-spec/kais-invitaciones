import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { PhotoUploadAvailability } from "@/components/photo-upload-availability";
import { PhotoUploadForm } from "@/components/live-album/photo-upload-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasEventStarted } from "@/lib/event-time";
import { absoluteUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("hosts_names, event_type").eq("slug", slug).maybeSingle();
  const title = data ? `Sube tu foto · ${data.hosts_names}` : "Subir foto";
  return { title };
}

export default async function FotosPage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, event_type, event_date, event_time, theme_color, status")
    .eq("slug", slug)
    .maybeSingle();

  const event = data as (Event & { status: string }) | null;
  if (!event) notFound();

  if (event.status !== "publicado") {
    return <UploadUnavailable slug={slug} />;
  }

  if (!hasEventStarted(event.event_date, event.event_time)) {
    return <UploadLocked event={event} slug={slug} />;
  }

  const albumUrl = absoluteUrl(`/evento/${slug}/album`);
  const accent = event.theme_color ?? "#d4af37";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <Link
            href={`/evento/${slug}`}
            className="text-[0.65rem] font-black tracking-[0.22em] text-foreground/70 hover:text-foreground"
          >
            KAIS INVITACIONES
          </Link>
          <Link
            href={albumUrl}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Ver álbum
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 py-10">
        {/* Hero text */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: `${accent}18` }}
          >
            <span className="text-3xl">📸</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            ¡Comparte un momento!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sube tu foto de{" "}
            <span className="font-semibold text-foreground">{event.hosts_names}</span>.
            <br />
            Aparecerá en el álbum al ser aprobada.
          </p>
        </div>

        {/* Upload form */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <PhotoUploadForm
            eventId={event.id}
            eventSlug={slug}
            accentColor={accent}
          />
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al enviar tu foto aceptas que sea visible en el álbum del evento.
        </p>
      </main>
    </div>
  );
}

function UploadUnavailable({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Subida de fotos no disponible
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Este enlace pertenece a un evento que todavia no esta publicado. Cuando la invitacion este activa,
            los invitados podran subir fotos desde aqui.
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

function UploadLocked({ event, slug }: { event: Event; slug: string }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-10">
        <PhotoUploadAvailability
          date={event.event_date}
          time={event.event_time}
          uploadHref={`/evento/${slug}/fotos`}
          variant="plain"
        />
        <Link
          href={`/evento/${slug}`}
          className="mt-5 inline-flex rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted"
        >
          Volver a la invitacion
        </Link>
      </main>
    </div>
  );
}
