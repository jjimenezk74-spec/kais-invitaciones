"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronDown, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addLivePhotoComment,
  addLivePhotoReaction,
} from "@/app/actions/live-photo-interactions";
import { PhotoUploadForm } from "@/components/live-album/photo-upload-form";
import {
  LIVE_PHOTO_REACTION_EMOJIS,
  type LivePhotoComment,
  type LivePhotoReactionCount,
} from "@/lib/live-photo-interactions";
import type { LivePhoto } from "@/lib/types";

type PublicLiveAlbumProps = {
  eventId: string;
  eventSlug: string;
  title: string;
  dateLabel: string;
  eventType: string;
  accentColor: string;
  photos: LivePhoto[];
  commentsByPhotoId: Record<string, LivePhotoComment[]>;
  reactionsByPhotoId: Record<string, LivePhotoReactionCount>;
  canUploadPhotos?: boolean;
};

const AUTHOR_STORAGE_KEY = "kais_live_album_author";
const SESSION_STORAGE_KEY = "kais_live_album_session";

export function PublicLiveAlbum({
  eventId,
  eventSlug,
  title,
  dateLabel,
  eventType,
  accentColor,
  photos,
  commentsByPhotoId: initialComments,
  reactionsByPhotoId: initialReactions,
  canUploadPhotos = true,
}: PublicLiveAlbumProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<LivePhoto | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [commentsByPhotoId, setCommentsByPhotoId] = useState(initialComments);
  const [reactionsByPhotoId, setReactionsByPhotoId] = useState(initialReactions);

  const accent = accentColor?.trim() || "#d4af37";

  useEffect(() => {
    setAuthorName(window.localStorage.getItem(AUTHOR_STORAGE_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (!selectedPhoto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPhoto]);

  const featuredPhotos = useMemo(() => photos.filter((photo) => photo.featured), [photos]);
  const regularPhotos = useMemo(() => photos.filter((photo) => !photo.featured), [photos]);

  return (
    <div className="min-h-screen bg-[#12090b] text-stone-50">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#12090b]/86 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href={`/evento/${eventSlug}`}
            className="min-w-0 text-[0.65rem] font-black tracking-[0.24em] text-stone-200/75 transition hover:text-white"
          >
            KAIS INVITACIONES
          </Link>
          <button
            type="button"
            onClick={() => canUploadPhotos && setShowUploader((value) => !value)}
            disabled={!canUploadPhotos}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-amber-100 bg-amber-300 px-5 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-black shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/10 disabled:text-white/55 disabled:shadow-none disabled:hover:translate-y-0"
          >
            <Camera className="h-4 w-4" />
            Subir foto
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 sm:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="mb-3 text-[0.66rem] font-black uppercase tracking-[0.32em]"
                style={{ color: accent }}
              >
                Álbum del evento
              </p>
              <h1 className="font-display text-4xl font-light leading-tight text-white sm:text-5xl md:text-6xl">
                {title}
              </h1>
              <p className="mt-4 text-sm text-stone-300">
                {dateLabel} · <span className="capitalize">{eventType}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-300">
              {photos.length} {photos.length === 1 ? "foto compartida" : "fotos compartidas"}
            </div>
          </div>
        </section>

        {!canUploadPhotos ? (
          <section className="mb-8 rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-center text-sm font-semibold text-amber-50 shadow-lg shadow-black/20">
            La subida de fotos estará disponible el día del evento.
          </section>
        ) : null}

        {showUploader ? (
          <section className="mb-10 rounded-[1.75rem] border border-white/10 bg-stone-50 p-4 text-stone-950 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-stone-950">Subí tu foto</h2>
                <p className="mt-1 text-sm text-stone-500">
                  La foto aparecerá en el álbum cuando KAIS la apruebe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploader(false)}
                className="rounded-full border border-stone-200 p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label="Cerrar subida"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PhotoUploadForm eventId={eventId} eventSlug={eventSlug} accentColor={accent} />
          </section>
        ) : null}

        {photos.length === 0 ? (
          <section className="flex min-h-[42vh] flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/15 bg-white/[0.035] px-6 py-16 text-center">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: `${accent}22` }}
            >
              <Camera className="h-9 w-9" style={{ color: accent }} />
            </div>
            <h2 className="font-display text-3xl text-white">Todavía no hay fotos.</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-300">
              Sé el primero en subir una y compartir este recuerdo con todos.
            </p>
            <button
              type="button"
              onClick={() => canUploadPhotos && setShowUploader(true)}
              disabled={!canUploadPhotos}
              className="mt-7 min-h-11 rounded-full border border-amber-100 bg-amber-300 px-7 py-3 text-sm font-black uppercase tracking-[0.16em] text-black shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/10 disabled:text-white/55 disabled:shadow-none disabled:hover:translate-y-0"
            >
              Subir foto
            </button>
          </section>
        ) : (
          <div className="space-y-12">
            {featuredPhotos.length > 0 ? (
              <AlbumGrid
                title="Destacadas"
                photos={featuredPhotos}
                accent={accent}
                large
                onSelect={setSelectedPhoto}
              />
            ) : null}
            <AlbumGrid
              title={featuredPhotos.length > 0 ? "Todas las fotos" : "Momentos compartidos"}
              photos={regularPhotos.length > 0 ? regularPhotos : featuredPhotos}
              accent={accent}
              onSelect={setSelectedPhoto}
            />
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => canUploadPhotos && setShowUploader(true)}
        disabled={!canUploadPhotos}
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-amber-100 bg-amber-300 text-black shadow-2xl shadow-black/40 transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0 disabled:hidden md:hidden"
        aria-label="Subir foto"
      >
        <Camera className="h-6 w-6" />
      </button>

      {selectedPhoto ? (
        <PhotoLightbox
          photo={selectedPhoto}
          eventId={eventId}
          accent={accent}
          authorName={authorName}
          onAuthorNameChange={(name) => {
            setAuthorName(name);
            window.localStorage.setItem(AUTHOR_STORAGE_KEY, name);
          }}
          comments={commentsByPhotoId[selectedPhoto.id] ?? []}
          reactions={reactionsByPhotoId[selectedPhoto.id] ?? createEmptyReactionCount()}
          onClose={() => setSelectedPhoto(null)}
          onCommentAdded={(comment) => {
            setCommentsByPhotoId((current) => ({
              ...current,
              [comment.photo_id]: [...(current[comment.photo_id] ?? []), comment],
            }));
          }}
          onReactionUpdated={(photoId, counts) => {
            setReactionsByPhotoId((current) => ({ ...current, [photoId]: counts }));
          }}
        />
      ) : null}
    </div>
  );
}

function AlbumGrid({
  title,
  photos,
  accent,
  large = false,
  onSelect,
}: {
  title: string;
  photos: LivePhoto[];
  accent: string;
  large?: boolean;
  onSelect: (photo: LivePhoto) => void;
}) {
  if (photos.length === 0) return null;

  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.22em] text-stone-300">
          {title}
        </h2>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className={`grid gap-3 ${large ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onSelect(photo)}
            className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] text-left shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-white/25"
          >
            <span className={`relative block w-full overflow-hidden bg-black ${large ? "aspect-[4/3]" : "aspect-square"}`}>
              <Image
                src={photo.image_url}
                alt={photo.guest_name ?? "Foto del evento"}
                fill
                draggable={false}
                onContextMenu={(event) => event.preventDefault()}
                className="select-none object-cover transition duration-700 [-webkit-user-drag:none] group-hover:scale-105"
                sizes="(max-width: 768px) 50dvw, (max-width: 1024px) 33dvw, 25dvw"
              />
              <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              {(photo.guest_name || photo.guest_message) && (
                <span className="absolute inset-x-0 bottom-0 block p-4">
                  {photo.guest_name ? (
                    <span className="block truncate text-sm font-bold text-white">{photo.guest_name}</span>
                  ) : null}
                  {photo.guest_message ? (
                    <span className="mt-1 line-clamp-2 block text-xs text-white/75">
                      {photo.guest_message}
                    </span>
                  ) : null}
                </span>
              )}
              <span
                className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black opacity-0 shadow-lg transition group-hover:opacity-100"
                style={{ background: accent }}
              >
                Ver
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PhotoLightbox({
  photo,
  eventId,
  accent,
  authorName,
  comments,
  reactions,
  onAuthorNameChange,
  onClose,
  onCommentAdded,
  onReactionUpdated,
}: {
  photo: LivePhoto;
  eventId: string;
  accent: string;
  authorName: string;
  comments: LivePhotoComment[];
  reactions: LivePhotoReactionCount;
  onAuthorNameChange: (name: string) => void;
  onClose: () => void;
  onCommentAdded: (comment: LivePhotoComment) => void;
  onReactionUpdated: (photoId: string, counts: LivePhotoReactionCount) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleReaction = (emoji: string) => {
    const sessionId = getAnonymousSessionId();
    startTransition(async () => {
      const result = await addLivePhotoReaction({
        eventId,
        photoId: photo.id,
        emoji,
        anonymousSessionId: sessionId,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.counts) onReactionUpdated(photo.id, result.counts);
      setError("");
    });
  };

  const handleComment = () => {
    if (!authorName.trim() || !commentText.trim() || commentText.trim().length > 300) {
      setError("El comentario no es válido.");
      return;
    }

    startTransition(async () => {
      const result = await addLivePhotoComment({
        eventId,
        photoId: photo.id,
        authorName,
        commentText,
      });

      if (result.error || !result.comment) {
        setError(result.error ?? "No se pudo publicar el comentario.");
        return;
      }

      onCommentAdded(result.comment);
      setCommentText("");
      setCommentsOpen(true);
      setError("");
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white md:grid md:grid-cols-[minmax(0,1fr)_380px]">
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          aria-label="Cerrar foto"
        >
          <X className="h-5 w-5" />
        </button>
        <Image
          src={photo.image_url}
          alt={photo.guest_name ?? "Foto del evento"}
          fill
          draggable={false}
          priority
          onContextMenu={(event) => event.preventDefault()}
          className="select-none object-contain [-webkit-user-drag:none]"
          sizes="100dvw"
        />
      </div>

      <aside className="max-h-[46vh] overflow-y-auto border-t border-white/10 bg-[#140b0d] p-4 md:max-h-none md:border-l md:border-t-0 md:p-5">
        <div className="mb-4">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>
            Foto del álbum
          </p>
          {photo.guest_name ? <h3 className="mt-2 text-lg font-bold">{photo.guest_name}</h3> : null}
          {photo.guest_message ? (
            <p className="mt-2 text-sm leading-6 text-stone-300">{photo.guest_message}</p>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {LIVE_PHOTO_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReaction(emoji)}
              disabled={isPending}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold transition hover:bg-white/[0.12]"
            >
              <span className="mr-1.5">{emoji}</span>
              <span className="text-white/70">{reactions[emoji] ?? 0}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCommentsOpen((value) => !value)}
          className="mb-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-bold"
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Comentarios ({comments.length})
          </span>
          <ChevronDown className={`h-4 w-4 transition ${commentsOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`${commentsOpen ? "block" : "hidden md:block"}`}>
          <div className="mb-4 space-y-3">
            {comments.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-sm text-stone-400">
                Sé el primero en comentar esta foto.
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-sm font-bold text-white">{comment.author_name}</p>
                  <p className="mt-1 text-sm leading-6 text-stone-300">{comment.comment_text}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={authorName}
              onChange={(event) => onAuthorNameChange(event.target.value)}
              maxLength={80}
              placeholder="Tu nombre"
              className="min-h-12 w-full rounded-2xl border border-white/30 bg-white/[0.14] px-4 py-3 text-sm font-semibold text-white shadow-inner shadow-black/20 outline-none placeholder:text-stone-300 transition focus:border-amber-200 focus:bg-white/[0.18] focus:ring-2 focus:ring-amber-200/40"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={300}
                placeholder="Escribe un comentario..."
                className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/30 bg-white/[0.14] px-4 py-3 text-sm font-semibold text-white shadow-inner shadow-black/20 outline-none placeholder:text-stone-300 transition focus:border-amber-200 focus:bg-white/[0.18] focus:ring-2 focus:ring-amber-200/40"
              />
              <button
                type="button"
                onClick={handleComment}
                disabled={isPending || !authorName.trim() || !commentText.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-100 bg-amber-300 text-black shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-amber-200 active:scale-95 disabled:cursor-not-allowed disabled:border-amber-100/30 disabled:bg-amber-300/40 disabled:text-black/40 disabled:shadow-none"
                aria-label="Enviar comentario"
              >
                <Send className="h-5 w-5 text-current" strokeWidth={2.5} />
              </button>
            </div>
            {error ? <p className="text-sm font-semibold text-red-200">{error}</p> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function getAnonymousSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

function createEmptyReactionCount(): LivePhotoReactionCount {
  return { "❤️": 0, "😂": 0, "😍": 0, "👏": 0, "🥹": 0, "🎉": 0 };
}
