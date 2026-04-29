import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { PhotoUploadForm } from "@/components/live-album/photo-upload-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/utils";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("events").select("hosts_names, event_type").eq("slug", slug).single();
  const title = data ? `Sube tu foto · ${data.hosts_names}` : "Subir foto";
  return { title };
}

export default async function FotosPage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("events")
    .select("id, slug, hosts_names, event_type, event_date, theme_color, status")
    .eq("slug", slug)
    .single();

  const event = data as (Event & { status: string }) | null;
  if (!event || event.status !== "publicado") notFound();

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
