"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePhoto } from "@/lib/types";

const SLIDE_DURATION = 6000;   // ms per slide
const POLL_INTERVAL  = 12000;  // ms between server polls

type LiveSlideshowProps = {
  initialPhotos: LivePhoto[];
  eventId: string;
  qrDataUrl: string;
  uploadUrl: string;
  hostsNames: string;
};

export function LiveSlideshow({
  initialPhotos,
  eventId,
  qrDataUrl,
  uploadUrl,
  hostsNames,
}: LiveSlideshowProps) {
  const [photos, setPhotos]     = useState<LivePhoto[]>(initialPhotos);
  const [index, setIndex]       = useState(0);
  const [visible, setVisible]   = useState(true);  // for crossfade
  const [showQr, setShowQr]     = useState(true);  // QR panel
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll for new approved photos ─────────────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-photos/${eventId}`);
      if (!res.ok) return;
      const fresh = (await res.json()) as LivePhoto[];
      setPhotos((prev) => {
        if (fresh.length !== prev.length) return fresh;
        return prev;
      });
    } catch {
      // silent — keep showing current photos
    }
  }, [eventId]);

  useEffect(() => {
    pollRef.current = setInterval(fetchPhotos, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPhotos]);

  // ── Slideshow timer ───────────────────────────────────────────────────────
  const advance = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setIndex((i) => (photos.length > 0 ? (i + 1) % photos.length : 0));
      setVisible(true);
    }, 600);
  }, [photos.length]);

  useEffect(() => {
    if (photos.length <= 1) return;
    timerRef.current = setTimeout(advance, SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, photos.length, advance]);

  // ── Current photo ─────────────────────────────────────────────────────────
  const photo = photos.length > 0 ? photos[index % photos.length] : null;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!photo) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-black">
        <p className="text-white/30 text-2xl font-semibold">Esperando fotos aprobadas…</p>
        <QrPanel qrDataUrl={qrDataUrl} uploadUrl={uploadUrl} />
      </div>
    );
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      onClick={() => setShowQr((v) => !v)}
    >
      {/* Background blur layer */}
      <div
        className="absolute inset-0 scale-110"
        style={{
          backgroundImage: `url(${photo.image_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(32px) brightness(0.35)",
          transition: "opacity 0.6s ease",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Main photo */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transition: "opacity 0.6s ease", opacity: visible ? 1 : 0 }}
      >
        <div className="relative max-h-[82vh] max-w-[88vw]">
          <Image
            src={photo.image_url}
            alt={photo.guest_name ?? "Foto"}
            width={1200}
            height={900}
            className="max-h-[82vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
            priority
            unoptimized
          />
        </div>
      </div>

      {/* Caption */}
      {(photo.guest_name || photo.guest_message) && (
        <div
          className="absolute bottom-0 left-0 right-0 px-8 pb-8 pt-24"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)",
            transition: "opacity 0.6s ease",
            opacity: visible ? 1 : 0,
          }}
        >
          <div className="mx-auto max-w-2xl text-center">
            {photo.guest_name && (
              <p className="text-lg font-semibold text-white/90 drop-shadow">
                {photo.guest_name}
              </p>
            )}
            {photo.guest_message && (
              <p className="mt-1 text-sm text-white/70 drop-shadow">
                &ldquo;{photo.guest_message}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top bar: event name + counter */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-8 py-6">
        <p className="text-sm font-bold tracking-[0.18em] text-white/50 uppercase">
          {hostsNames}
        </p>
        {photos.length > 1 && (
          <p className="text-xs font-semibold text-white/30">
            {(index % photos.length) + 1} / {photos.length}
          </p>
        )}
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 20 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === index % photos.length ? "1.5rem" : "0.375rem",
                background: i === index % photos.length ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      )}

      {/* QR panel */}
      {showQr && <QrPanel qrDataUrl={qrDataUrl} uploadUrl={uploadUrl} />}
    </div>
  );
}

// ── QR overlay panel ──────────────────────────────────────────────────────────

function QrPanel({ qrDataUrl, uploadUrl }: { qrDataUrl: string; uploadUrl: string }) {
  return (
    <div className="absolute bottom-8 right-8 flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR subir foto" width={120} height={120} className="rounded-lg" />
      <p className="text-center text-[0.6rem] font-semibold uppercase tracking-widest text-white/70">
        Escanea para
        <br />
        subir tu foto
      </p>
    </div>
  );
}
