"use client";

import Image from "next/image";
import { Check, Star, Trash2, X } from "lucide-react";
import { useTransition } from "react";
import {
  approveLivePhoto,
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

  const approve = () =>
    startTransition(() => approveLivePhoto(photo.id, eventId));
  const reject = () =>
    startTransition(() => rejectLivePhoto(photo.id, eventId));
  const del = () =>
    startTransition(() => deleteLivePhoto(photo.id, eventId));
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
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
};

export function PhotoAdminGrid({ photos, eventId }: PhotoAdminGridProps) {
  const pending = photos.filter((p) => !p.approved && !p.rejected);
  const approved = photos.filter((p) => p.approved && !p.rejected);
  const rejected = photos.filter((p) => p.rejected);

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
      <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
        <span className="text-5xl">📷</span>
        <p className="text-sm font-semibold">Aún no hay fotos</p>
        <p className="text-xs">Los invitados podrán subir fotos desde el enlace público.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <Section title="Pendientes" items={pending} accent="bg-amber-100 text-amber-700" />
      <Section title="Aprobadas" items={approved} accent="bg-emerald-100 text-emerald-700" />
      <Section title="Rechazadas" items={rejected} accent="bg-red-100 text-red-700" />
    </div>
  );
}
