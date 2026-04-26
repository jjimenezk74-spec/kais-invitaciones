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

export function EventMusicPlayer({ url }: { url: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(20);
  const [message, setMessage] = useState("");
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const source = useMemo(() => getMusicSource(url), [url]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || source.kind !== "audio") {
      return;
    }

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
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function toggleMuted() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
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
    <div className="rounded-lg border border-white/25 bg-white/15 p-4 text-white shadow-soft backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Musica del evento</p>
          <p className="truncate text-xs text-white/75">
            {source.kind === "audio" ? "Audio listo para reproducir" : source.host ?? "Enlace de cancion"}
          </p>
        </div>
      </div>

      {source.kind === "audio" ? (
        <div className="mt-4 grid gap-4">
          <audio
            ref={audioRef}
            src={source.url}
            preload="metadata"
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onEnded={() => setIsPlaying(false)}
          />

          {needsInteraction ? (
            <Button type="button" variant="secondary" onClick={play} className="w-full sm:w-fit">
              <Play className="h-4 w-4" />
              Tocar musica
            </Button>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={togglePlayback}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pausar" : "Reproducir"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={toggleMuted}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
            </Button>
          </div>

          <div className="grid gap-2">
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
        <div className="mt-4">
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
        <div className="mt-4 flex gap-3 rounded-md border border-white/20 bg-white/10 p-3 text-sm text-white/85">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{source.message}</p>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs leading-5 text-white/80">{message}</p> : null}
    </div>
  );
}

function getMusicSource(value: string | null): MusicSource {
  const rawUrl = value?.trim();

  if (!rawUrl) {
    return {
      kind: "invalid",
      url: "",
      message: "No se configuro una cancion para este evento."
    };
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
    return {
      kind: "audio",
      url: rawUrl,
      host
    };
  }

  if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("spotify.com")) {
    return {
      kind: "external",
      url: rawUrl,
      host
    };
  }

  return {
    kind: "unsupported",
    url: rawUrl,
    host,
    message: "Este enlace de musica no se puede reproducir directamente. Usa un archivo .mp3, .wav u .ogg, o un enlace de YouTube/Spotify para abrirlo aparte."
  };
}
