"use client";

import { AlertCircle, ExternalLink, Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type MusicKind = "audio" | "external" | "unsupported" | "invalid";

type MusicSource = {
  kind: MusicKind;
  url: string;
  host?: string;
  message?: string;
};

export function EventMusicPlayer({ url, compact = false }: { url: string | null; compact?: boolean }) {
  const playerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(20);
  const [message, setMessage] = useState("");
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const source = useMemo(() => getMusicSource(url), [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || source.kind !== "audio") return;
    const audioElement = audio;
    audioElement.volume = 0.2;
    audioElement.muted = false;
    async function tryAutoplay() {
      try {
        await audioElement.play();
        setIsPlaying(true);
        setNeedsInteraction(false);
        setMessage("");
      } catch {
        setIsPlaying(false);
        setNeedsInteraction(true);
        setMessage("Toca el boton para iniciar la musica del evento.");
      }
    }
    tryAutoplay();
  }, [source.kind, source.url]);

  useEffect(() => {
    if (!compact || !isMobilePanelOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!playerRef.current?.contains(event.target as Node)) {
        setIsMobilePanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [compact, isMobilePanelOpen]);

  if (!url) return null;

  async function play() {
    const audio = audioRef.current;
    setMessage("");
    try {
      if (audio) {
        audio.volume = volume / 100;
        audio.muted = isMuted;
      }
      await audio?.play();
      setIsPlaying(true);
      setNeedsInteraction(false);
    } catch {
      setIsPlaying(false);
      setNeedsInteraction(true);
      setMessage("Toca el boton para iniciar la musica del evento.");
    }
  }

  function pause() {
    audioRef.current?.pause();
    setIsPlaying(false);
    setMessage("");
  }

  function togglePlayback() {
    if (isPlaying) pause();
    else play();
  }

  function toggleCompactPlayback() {
    togglePlayback();
    setIsMobilePanelOpen((open) => !open);
  }

  function toggleMuted() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) audioRef.current.muted = nextMuted;
  }

  function changeVolume(value: string) {
    const nextVolume = Number(value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume / 100;
      audioRef.current.muted = nextVolume === 0;
    }
  }

  return (
    <div
      ref={playerRef}
      className={
        compact
          ? "relative lg:rounded-2xl lg:border lg:border-[#d4af37]/30 lg:bg-black/55 lg:p-2.5 lg:text-[#f5ecd9] lg:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] lg:backdrop-blur-xl"
          : "rounded-lg border border-white/25 bg-white/15 p-4 text-white shadow-soft backdrop-blur"
      }
    >
      <div className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}>
        {compact ? (
          <button
            type="button"
            onClick={toggleCompactPlayback}
            aria-label={isPlaying ? "Pausar musica" : "Reproducir musica"}
            aria-expanded={isMobilePanelOpen}
            className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full lg:h-8 lg:w-8 ${isPlaying ? "kais-disc is-playing" : "kais-disc"}`}
          >
            {isPlaying ? <Pause className="h-4 w-4 lg:h-3.5 lg:w-3.5" /> : <Play className="h-4 w-4 lg:h-3.5 lg:w-3.5" />}
          </button>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15">
            <Music2 className="h-5 w-5" />
          </div>
        )}
        {compact ? (
          <p className="hidden text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[#d4af37] lg:block">
            {isPlaying ? "Sonando" : "Musica"}
          </p>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold">Musica del evento</p>
            <p className="truncate text-xs text-white/75">
              {source.kind === "audio" ? "Audio listo para reproducir" : source.host ?? "Enlace de cancion"}
            </p>
          </div>
        )}
      </div>

      {compact && source.kind === "audio" ? (
        <div
          className={`absolute right-0 top-[calc(100%+0.65rem)] w-[min(15rem,calc(100vw-2rem))] rounded-2xl border border-[#d4af37]/30 bg-[#100607]/92 p-3 text-[#f5ecd9] shadow-[0_22px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl transition lg:hidden ${
            isMobilePanelOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[#d4af37]">Musica</p>
            <span className="text-xs font-semibold text-[#f5ecd9]/70">{volume}%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? "Pausar musica" : "Reproducir musica"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-[#170607] shadow-[0_10px_24px_rgba(212,175,55,0.22)]"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar musica"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/25 bg-white/10 text-[#f5ecd9]"
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => changeVolume(event.target.value)}
              className="h-2 min-w-0 flex-1 cursor-pointer accent-[#d4af37]"
              aria-label="Volumen de la musica"
            />
          </div>
        </div>
      ) : null}

      {source.kind === "audio" ? (
        <div className={compact ? "hidden lg:mt-3 lg:flex lg:flex-col lg:gap-3 xl:flex-row xl:items-center" : "mt-4 grid gap-4"}>
          <audio
            ref={audioRef}
            src={source.url}
            preload="metadata"
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onEnded={() => setIsPlaying(false)}
          />
          {!compact && needsInteraction ? (
            <Button type="button" variant="secondary" onClick={play} className={compact ? "w-full xl:w-fit" : "w-full sm:w-fit"}>
              <Play className="h-4 w-4" />
              Tocar musica
            </Button>
          ) : null}
          <div className={compact ? "flex gap-2" : "flex flex-col gap-3 sm:flex-row"}>
            <Button
              type="button"
              variant="secondary"
              onClick={togglePlayback}
              className={compact ? "px-3" : undefined}
              aria-label={isPlaying ? "Pausar musica" : "Reproducir musica"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {compact ? null : isPlaying ? "Pausar" : "Reproducir"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={`border-white/30 bg-white/10 text-white hover:bg-white/20 ${compact ? "px-3" : ""}`}
              onClick={toggleMuted}
              aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar musica"}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {compact ? null : isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
            </Button>
          </div>
          <div className={compact ? "grid min-w-0 flex-1 gap-1.5" : "grid gap-2"}>
            <div className="flex items-center justify-between text-xs font-semibold text-white/80">
              <span>Volumen</span>
              <span>{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => changeVolume(event.target.value)}
              className="h-2 w-full cursor-pointer accent-white"
              aria-label="Volumen de la musica"
            />
          </div>
        </div>
      ) : null}

      {source.kind === "external" ? (
        <div className={compact ? "hidden lg:mt-4 lg:block" : "mt-4"}>
          <Button type="button" variant="secondary" asChild>
            <a href={source.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir cancion
            </a>
          </Button>
          <p className="mt-3 text-xs leading-5 text-white/75">
            Este enlace parece ser de YouTube o Spotify. Por restricciones de esas plataformas, se abre en una nueva pestana.
          </p>
        </div>
      ) : null}

      {source.kind === "unsupported" || source.kind === "invalid" ? (
        <div className={compact ? "hidden lg:mt-4 lg:flex lg:gap-3 lg:rounded-md lg:border lg:border-white/20 lg:bg-white/10 lg:p-3 lg:text-sm lg:text-white/85" : "mt-4 flex gap-3 rounded-md border border-white/20 bg-white/10 p-3 text-sm text-white/85"}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{source.message}</p>
        </div>
      ) : null}

      {message ? (
        <p className={compact ? "mt-3 hidden text-xs leading-5 text-white/80 lg:block" : "mt-3 text-xs leading-5 text-white/80"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

function getMusicSource(value: string | null): MusicSource {
  const rawUrl = value?.trim();
  if (!rawUrl) {
    return { kind: "invalid", url: "", message: "No se configuro una cancion para este evento." };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      kind: "invalid",
      url: rawUrl,
      message: "El enlace de musica no es una URL valida. Usa un enlace https directo a .mp3, .wav u .ogg, o un enlace de YouTube/Spotify."
    };
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const pathname = parsed.pathname.toLowerCase();
  if (pathname.endsWith(".mp3") || pathname.endsWith(".wav") || pathname.endsWith(".ogg")) {
    return { kind: "audio", url: rawUrl, host };
  }
  if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("spotify.com")) {
    return { kind: "external", url: rawUrl, host };
  }
  return {
    kind: "unsupported",
    url: rawUrl,
    host,
    message: "Este enlace de musica no se puede reproducir directamente. Usa un archivo .mp3, .wav u .ogg, o un enlace de YouTube/Spotify para abrirlo aparte."
  };
}
