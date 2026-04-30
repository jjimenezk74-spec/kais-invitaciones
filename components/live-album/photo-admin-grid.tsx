"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Download, Star, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  approveLivePhoto,
  createLiveAlbumDownloadLinks,
  deleteAllLivePhotos,
  deleteLivePhoto,
  featureLivePhoto,
  rejectLivePhoto,
} from "@/app/actions/live-photos";
import type { LivePhoto } from "@/lib/types";

type Tab = "pending" | "approved" | "rejected";

type PhotoCardProps = {
  photo: LivePhoto;
  eventId: string;
};

function PhotoCard({ photo, eventId }: PhotoCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const approve = () =>
    startTransition(() => approveLivePhoto(photo.id, eventId));
  const reject = () =>
    startTransition(() => rejectLivePhoto(photo.id, eventId));
  const del = () => {
    if (!window.confirm("Esta acción eliminará la foto del álbum y de Storage. ¿Continuar?")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteLivePhoto(photo.id, eventId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };
  const toggleFeatured = () =>
    startTransition(() => featureLivePhoto(photo.id, eventId, !photo.featured));

  const statusBadge = photo.rejected
    ? { label: "Rechazada", cls: "bg-red-100 text-red-700" }
    : photo.approved
    ? { label: "Aprobada", cls: "bg-emerald-100 text-emerald-700" }
    : { label: "Pendiente", cls: "bg-amber-100 text-amber-700" };

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Image
          src={photo.image_url}
          alt={photo.guest_name ?? "Foto de invitado"}
          fill
          className="object-cover transition duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100dvw, (max-width: 1024px) 50dvw, 33dvw"
        />
        {/* Status badge overlay */}
        <span
          className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${statusBadge.cls}`}
        >
          {statusBadge.label}
        </span>
        {/* Featured star */}
        {photo.approved && !photo.rejected && (
          <button
            onClick={toggleFeatured}
            aria-label={photo.featured ? "Quitar destacada" : "Destacar foto"}
            className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full shadow transition ${
              photo.featured
                ? "bg-amber-400 text-white"
                : "bg-black/40 text-white/70 hover:bg-amber-400 hover:text-white"
            }`}
          >
            <Star className="h-3.5 w-3.5" fill={photo.featured ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* Meta */}
      <div className="px-4 py-3">
        <p className="truncate text-sm font-semibold text-foreground">
          {photo.guest_name ?? <span className="italic text-muted-foreground">Anónimo</span>}
        </p>
        {photo.guest_message ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {photo.guest_message}
          </p>
        ) : null}
        <p className="mt-1 text-[0.65rem] text-muted-foreground/60">
          {new Date(photo.created_at).toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
        {error ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-border px-4 py-3">
        {!photo.approved && !photo.rejected && (
          <button
            onClick={approve}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            <Check className="h-3.5 w-3.5" />
            Aprobar
          </button>
        )}
        {!photo.rejected && (
          <button
            onClick={reject}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-foreground transition hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
            Rechazar
          </button>
        )}
        {photo.rejected && (
          <button
            onClick={approve}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            <Check className="h-3.5 w-3.5" />
            Aprobar
          </button>
        )}
        <button
          onClick={del}
          aria-label="Eliminar foto"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

type PhotoAdminGridProps = {
  photos: LivePhoto[];
  eventId: string;
  eventSlug: string;
};

type DownloadLink = {
  id: string;
  filename: string;
  url: string;
};

export function PhotoAdminGrid({ photos, eventId, eventSlug }: PhotoAdminGridProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const router = useRouter();
  const pending = photos.filter((p) => !p.approved && !p.rejected);
  const approved = photos.filter((p) => p.approved && !p.rejected);
  const rejected = photos.filter((p) => p.rejected);

  const downloadAlbum = () => {
    setMessage("");
    setDownloadLinks([]);
    startTransition(async () => {
      const result = await createLiveAlbumDownloadLinks(eventId);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setDownloadLinks(result.links);
      setMessage(
        result.links.length > 0
          ? `Álbum preparado: ${result.links.length} foto(s). Los enlaces vencen en 1 hora.`
          : "No hay fotos aprobadas para descargar.",
      );
    });
  };

  const deleteAll = () => {
    const confirmation = window.prompt(
      "Esta acción eliminará TODAS las fotos del álbum, Storage, comentarios y reacciones. Escribe ELIMINAR para confirmar.",
    );
    if (confirmation !== "ELIMINAR") return;

    setMessage("");
    setDownloadLinks([]);
    startTransition(async () => {
      const result = await deleteAllLivePhotos(eventId);
      setMessage(result.error ?? "Todas las fotos del álbum fueron eliminadas.");
      if (!result.error) router.refresh();
    });
  };

  const AdminActions = () => (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Acciones del álbum</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Descarga fotos aprobadas o elimina el álbum completo del evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadAlbum}
            disabled={isPending || approved.length === 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Descargar álbum
          </button>
          <button
            type="button"
            onClick={deleteAll}
            disabled={isPending || photos.length === 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar todas las fotos
          </button>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm font-medium text-foreground">
          {message}
        </p>
      ) : null}

      {downloadLinks.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Enlaces temporales del álbum {eventSlug}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {downloadLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                download={link.filename}
                target="_blank"
                rel="noreferrer"
                className="truncate rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                {link.filename}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );

  const Section = ({ title, items, accent }: { title: string; items: LivePhoto[]; accent: string }) =>
    items.length > 0 ? (
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${accent}`}>
            {items.length}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <PhotoCard key={p.id} photo={p} eventId={eventId} />
          ))}
        </div>
      </section>
    ) : null;

  if (photos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <AdminActions />
        <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
          <span className="text-5xl">📷</span>
          <p className="text-sm font-semibold">Aún no hay fotos</p>
          <p className="text-xs">Los invitados podrán subir fotos desde el enlace público.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <AdminActions />
      <Section title="Pendientes" items={pending} accent="bg-amber-100 text-amber-700" />
      <Section title="Aprobadas" items={approved} accent="bg-emerald-100 text-emerald-700" />
      <Section title="Rechazadas" items={rejected} accent="bg-red-100 text-red-700" />
    </div>
  );
}
