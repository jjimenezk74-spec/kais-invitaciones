"use client";

import { Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRemainingSentence, getRemainingToEvent } from "@/lib/event-time";

type PhotoUploadAvailabilityProps = {
  date: string;
  time?: string | null;
  uploadHref: string;
  confirmed?: boolean;
  attending?: boolean | null;
  variant?: "luxe" | "plain";
};

export function PhotoUploadAvailability({
  date,
  time,
  uploadHref,
  confirmed = false,
  attending = null,
  variant = "luxe"
}: PhotoUploadAvailabilityProps) {
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemainingToEvent> | null>(null);

  useEffect(() => {
    function update() {
      setRemaining(getRemainingToEvent(date, time));
    }

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [date, time]);

  const isAvailable = Boolean(remaining && remaining.totalMs <= 0);
  const remainingText = remaining ? formatRemainingSentence(remaining) : "-- dias, -- horas, -- minutos y -- segundos";

  if (confirmed && attending === false) {
    return (
      <div className={cardClass(variant)}>
        <p className={titleClass(variant)}>Gracias por tu respuesta.</p>
      </div>
    );
  }

  return (
    <div className={cardClass(variant)}>
      {confirmed && attending === true ? (
        <div className="grid gap-1">
          <p className={titleClass(variant)}>¡Gracias por confirmar tu presencia!</p>
          <p className={textClass(variant)}>Te esperamos con mucha alegria.</p>
        </div>
      ) : null}

      {isAvailable ? (
        <a href={uploadHref} className={buttonClass(variant)}>
          <Camera className="h-3.5 w-3.5" />
          Subir fotos al album
        </a>
      ) : (
        <div className="grid gap-3">
          <p className={titleClass(variant)}>Aun no esta disponible la subida de fotos</p>
          <p className={textClass(variant)}>
            Faltan {remainingText} para poder subir fotos al album.
          </p>
        </div>
      )}
    </div>
  );
}

function cardClass(variant: "luxe" | "plain") {
  return variant === "plain"
    ? "grid gap-5 rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
    : "kais-glass grid gap-5 rounded-[1.4rem] p-5 text-center";
}

function titleClass(variant: "luxe" | "plain") {
  return variant === "plain"
    ? "font-display text-xl font-semibold text-foreground"
    : "font-display text-xl italic text-[#f5ecd9]";
}

function textClass(variant: "luxe" | "plain") {
  return variant === "plain"
    ? "text-sm leading-6 text-muted-foreground"
    : "text-sm leading-6 text-[#f5ecd9]/70";
}

function buttonClass(variant: "luxe" | "plain") {
  return variant === "plain"
    ? "inline-flex items-center justify-center gap-2 rounded-xl bg-[#6f1029] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#581023]"
    : "kais-cta justify-center";
}
