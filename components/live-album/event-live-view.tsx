"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
};

const SLIDE_DURATION = 6500;
const POLL_INTERVAL = 2500;
const MAX_FLOATING_REACTIONS = 5;

export function EventLiveView({
  eventId,
  eventName,
  initialPhotos,
  initialComments,
  initialReactions,
}: EventLiveViewProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [comments, setComments] = useState(initialComments);
  const [reactions, setReactions] = useState(initialReactions);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const seenReactionIds = useRef(new Set(initialReactions.map((reaction) => reaction.id)));

  const currentPhoto = photos.length > 0 ? photos[index % photos.length] : null;
  const recentComments = useMemo(() => comments.slice(0, 4), [comments]);

  const pollLiveData = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-album/${eventId}`, { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as {
        photos: LivePhoto[];
        comments: LiveComment[];
        reactions: LiveReaction[];
      };

      setPhotos(data.photos);
      setComments(data.comments);
      setReactions(data.reactions);

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
    document.documentElement.classList.add("kais-live-screen-active");
    return () => document.documentElement.classList.remove("kais-live-screen-active");
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black text-white">
      {currentPhoto ? (
        <>
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-75 blur-3xl transition-opacity duration-700"
            style={{
              backgroundImage: `url(${currentPhoto.image_url})`,
              filter: "blur(36px) brightness(0.48) saturate(1.1)",
              opacity: visible ? 0.82 : 0,
            }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: visible ? 1 : 0 }}
          >
            <Image
              src={currentPhoto.image_url}
              alt={currentPhoto.guest_name ?? "Foto del evento"}
              fill
              priority
              draggable={false}
              className="select-none object-cover [-webkit-user-drag:none]"
              sizes="100dvw"
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,27,48,0.45),rgba(0,0,0,1)_62%)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/35" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

      <section className="absolute left-8 top-8 z-10 md:left-12 md:top-10">
        <p className="text-xs font-black uppercase tracking-[0.34em] text-white/45">
          KAIS Live Album
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-light leading-none drop-shadow-2xl md:text-7xl">
          {eventName}
        </h1>
        <p className="mt-4 text-lg font-medium text-white/70">
          Fotos, reacciones y comentarios en vivo
        </p>
      </section>

      <section className="absolute bottom-10 left-8 z-10 flex w-[min(42rem,calc(100vw-4rem))] flex-col gap-4 md:left-12">
        {recentComments.length > 0 ? (
          recentComments.map((comment, commentIndex) => (
            <article
              key={comment.id}
              className="kais-live-comment-card max-w-xl rounded-3xl border border-white/15 bg-black/42 px-6 py-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
              style={{ animationDelay: `${commentIndex * 0.12}s` }}
            >
              <p className="text-lg font-black text-white">{comment.author_name}</p>
              <p className="mt-1 line-clamp-2 text-2xl font-semibold leading-tight text-white/86">
                {comment.comment_text}
              </p>
            </article>
          ))
        ) : (
          <div className="max-w-lg rounded-3xl border border-white/10 bg-black/28 px-6 py-4 text-xl font-semibold text-white/55 backdrop-blur-xl">
            Esperando comentarios del álbum...
          </div>
        )}
      </section>

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

      <div className="absolute bottom-8 right-10 z-10 rounded-full border border-white/10 bg-black/30 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/65 backdrop-blur-xl">
        {photos.length} fotos · {reactions.length} reacciones
      </div>
    </main>
  );
}
