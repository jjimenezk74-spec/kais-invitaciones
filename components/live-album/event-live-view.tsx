"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePhoto } from "@/lib/types";

type LiveComment = {
  id: string;
  photo_id: string;
  event_id: string;
  author_name: string;
  comment_text: string;
  created_at: string;
};

type LiveReaction = {
  id: string;
  photo_id: string;
  event_id: string;
  emoji: string;
  created_at: string;
};

type FloatingReaction = LiveReaction & {
  bubbleId: string;
  left: number;
  size: number;
  delay: number;
};

type EventLiveViewProps = {
  eventId: string;
  eventName: string;
  initialPhotos: LivePhoto[];
  initialComments: LiveComment[];
  initialReactions: LiveReaction[];
  initialReactionSummary: Record<string, number>;
  uploadUrl: string;
  qrDataUrl: string;
};

const SLIDE_DURATION = 6500;
const POLL_INTERVAL = 2500;
const MAX_FLOATING_REACTIONS = 5;
const COMMENT_VISIBLE_DURATION = 7200;

export function EventLiveView({
  eventId,
  eventName,
  initialPhotos,
  initialComments,
  initialReactions,
  initialReactionSummary,
  uploadUrl,
  qrDataUrl,
}: EventLiveViewProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [reactionSummary, setReactionSummary] = useState(initialReactionSummary);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [visibleComment, setVisibleComment] = useState<LiveComment | null>(initialComments[0] ?? null);
  const [commentVisible, setCommentVisible] = useState(Boolean(initialComments[0]));
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const seenReactionIds = useRef(new Set(initialReactions.map((reaction) => reaction.id)));
  const seenCommentIds = useRef(new Set(initialComments.map((comment) => comment.id)));

  const currentPhoto = photos.length > 0 ? photos[index % photos.length] : null;

  const pollLiveData = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-album/${eventId}`, { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as {
        photos: LivePhoto[];
        comments: LiveComment[];
        reactions: LiveReaction[];
        reactionSummary?: Record<string, number>;
      };

      setPhotos(data.photos);
      setReactionSummary(data.reactionSummary ?? {});

      const newComment = data.comments.find((comment) => !seenCommentIds.current.has(comment.id));
      for (const comment of data.comments) {
        seenCommentIds.current.add(comment.id);
      }

      if (newComment) {
        setVisibleComment(newComment);
        setCommentVisible(true);
      }

      const newReactions = data.reactions
        .filter((reaction) => !seenReactionIds.current.has(reaction.id))
        .slice(0, 4);

      for (const reaction of newReactions) {
        seenReactionIds.current.add(reaction.id);
      }

      if (newReactions.length > 0) {
        setFloatingReactions((current) =>
          [
            ...current,
            ...newReactions.map((reaction) => ({
              ...reaction,
              bubbleId: `${reaction.id}-${Date.now()}`,
              left: 68 + Math.random() * 22,
              size: 48 + Math.random() * 24,
              delay: Math.random() * 0.25,
            })),
          ].slice(-MAX_FLOATING_REACTIONS),
        );
      }
    } catch {
      // Keep the live screen calm even if polling misses a beat.
    }
  }, [eventId]);

  useEffect(() => {
    const interval = setInterval(pollLiveData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollLiveData]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timeout = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((value) => (photos.length > 0 ? (value + 1) % photos.length : 0));
        setVisible(true);
      }, 700);
    }, SLIDE_DURATION);
    return () => clearTimeout(timeout);
  }, [index, photos.length]);

  useEffect(() => {
    if (floatingReactions.length === 0) return;
    const timeout = setTimeout(() => {
      setFloatingReactions((current) => current.slice(1));
    }, 5200);
    return () => clearTimeout(timeout);
  }, [floatingReactions]);

  useEffect(() => {
    if (!visibleComment || !commentVisible) return;
    const timeout = setTimeout(() => setCommentVisible(false), COMMENT_VISIBLE_DURATION);
    return () => clearTimeout(timeout);
  }, [visibleComment, commentVisible]);

  useEffect(() => {
    const previousCursor = document.body.style.cursor;
    document.documentElement.classList.add("kais-live-screen-active");
    document.body.style.cursor = "none";
    return () => {
      document.documentElement.classList.remove("kais-live-screen-active");
      document.body.style.cursor = previousCursor;
    };
  }, []);

  const totalReactions = Object.values(reactionSummary).reduce((total, count) => total + count, 0);
  const reactionSummaryEntries = Object.entries(reactionSummary).filter(([, count]) => count > 0);

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-black text-white">
      {currentPhoto ? (
        <>
          <div
            className="absolute inset-0 z-0 scale-[1.08] bg-cover bg-center blur-3xl transition-opacity duration-700"
            style={{
              backgroundImage: `url(${currentPhoto.image_url})`,
              filter: "blur(24px) brightness(0.58) saturate(1.08)",
              opacity: visible ? 0.5 : 0,
            }}
          />
          <div className="absolute inset-0 z-[1] bg-black/18" />
          <div
            className="absolute inset-0 z-[3] flex items-center justify-center px-4 py-8 transition-opacity duration-700 md:px-12 md:py-10 lg:px-16"
            style={{ opacity: visible ? 1 : 0 }}
          >
            <div className="relative h-[min(84vh,calc(100vh-5rem))] w-[min(90vw,1320px)]">
              <img
                src={currentPhoto.image_url}
                alt={currentPhoto.guest_name ?? "Foto del evento"}
                draggable={false}
                className="h-full w-full select-none rounded-[1.35rem] object-contain drop-shadow-[0_28px_70px_rgba(0,0,0,0.62)] [-webkit-user-drag:none] md:rounded-[1.75rem]"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(120,27,48,0.45),rgba(0,0,0,1)_62%)]" />
      )}

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-black/42 via-black/6 to-black/22" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-black/78 via-black/24 to-transparent" />

      <section className="absolute left-5 top-5 z-10 max-w-[18rem] rounded-3xl border border-white/10 bg-black/24 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-md md:left-8 md:top-7 md:max-w-[22rem] md:px-5 md:py-4">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-white/48 md:text-[0.68rem]">
          KAIS Live Album
        </p>
        <h1 className="mt-2 line-clamp-2 font-display text-3xl font-light leading-[0.95] drop-shadow-2xl md:text-4xl lg:text-5xl">
          {eventName}
        </h1>
        <p className="mt-2 truncate text-xs font-semibold text-white/62 md:text-sm">
          Fotos y mensajes en vivo
        </p>
      </section>

      {visibleComment ? (
        <section className="absolute bottom-10 left-8 z-10 w-[min(32rem,calc(100vw-4rem))] md:left-12">
          <article
            key={visibleComment.id}
            className={`max-w-[520px] rounded-3xl border border-white/15 bg-black/44 px-6 py-4 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-700 ${
              commentVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <p className="text-lg font-black text-white">{visibleComment.author_name}</p>
            <p className="mt-1 line-clamp-2 text-2xl font-semibold leading-tight text-white/86">
              {visibleComment.comment_text}
            </p>
          </article>
        </section>
      ) : null}

      <section className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {floatingReactions.map((reaction) => (
          <span
            key={reaction.bubbleId}
            className="kais-live-reaction-bubble absolute bottom-8 flex items-center justify-center rounded-full bg-black/34 shadow-2xl shadow-black/30 backdrop-blur-md"
            style={{
              left: `${reaction.left}%`,
              width: `${reaction.size}px`,
              height: `${reaction.size}px`,
              animationDelay: `${reaction.delay}s`,
              fontSize: `${reaction.size * 0.52}px`,
            }}
          >
            {reaction.emoji}
          </span>
        ))}
      </section>

      <div className="absolute bottom-5 right-5 z-10 flex max-w-[calc(100vw-2.5rem)] flex-col items-end gap-3 md:bottom-8 md:right-8">
        <div className="rounded-2xl border border-white/12 bg-white p-1.5 text-center shadow-2xl shadow-black/35 md:p-2">
          <img
            src={qrDataUrl}
            alt="QR para subir fotos"
            className="h-16 w-16 select-none rounded-lg md:h-24 md:w-24"
            draggable={false}
          />
          <p className="mt-1 max-w-16 text-[0.48rem] font-black uppercase leading-tight tracking-[0.1em] text-slate-900 md:max-w-24 md:text-[0.58rem] md:tracking-[0.12em]">
            Escaneá para subir fotos
          </p>
          <span className="sr-only">{uploadUrl}</span>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <div className="rounded-full border border-white/10 bg-black/34 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl">
            {photos.length} fotos · {totalReactions} reacciones
          </div>
          {reactionSummaryEntries.length > 0 ? (
            <div className="flex max-w-[min(24rem,calc(100vw-2.5rem))] flex-wrap justify-end gap-1.5 rounded-full border border-white/10 bg-black/34 px-3 py-2 text-sm font-black text-white/82 backdrop-blur-xl">
              {reactionSummaryEntries.map(([emoji, count]) => (
                <span key={emoji} className="inline-flex items-center gap-1">
                  <span>{emoji}</span>
                  <span>{count}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
