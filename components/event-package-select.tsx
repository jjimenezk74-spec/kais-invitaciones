"use client";

import { useState, useTransition } from "react";
import { updateEventPackage } from "@/app/actions/events";
import { Select } from "@/components/ui/select";
import { PACKAGE_FEATURES, type EventFeatureKey } from "@/lib/event-features";
import type { EventPackageKey } from "@/lib/types";

const packageOptions: Array<{ value: EventPackageKey; label: string }> = [
  { value: "essential", label: "Essential" },
  { value: "premium", label: "Premium" },
  { value: "experience", label: "Experience" },
  { value: "luxury", label: "Luxury" },
];

const featureLabels: Record<EventFeatureKey, string> = {
  countdown: "Cuenta regresiva",
  music: "Música",
  rsvp: "Confirmación RSVP",
  external_rsvp_whatsapp: "RSVP por WhatsApp",
  guest_list: "Lista de invitados",
  live_album: "Álbum en vivo",
  album_comments: "Comentarios en álbum",
  album_reactions: "Reacciones en álbum",
  photo_upload: "Subida de fotos",
  photo_qr: "QR de fotos",
  gallery: "Galería",
  custom_themes: "Temas personalizados",
  free_decorations: "Decoración libre",
  client_access: "Acceso cliente",
  analytics: "Métricas",
  csv_export: "Exportación CSV",
};

export function EventPackageSelect({
  eventId,
  defaultValue,
}: {
  eventId: string;
  defaultValue: EventPackageKey;
}) {
  const [value, setValue] = useState<EventPackageKey>(defaultValue);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleChange(nextValue: string) {
    const packageKey = nextValue as EventPackageKey;
    setValue(packageKey);
    setMessage("");

    startTransition(async () => {
      const result = await updateEventPackage(eventId, packageKey);

      if (!result.ok) {
        setValue(defaultValue);
        setMessage(result.error ?? "No se pudo actualizar el paquete.");
        return;
      }

      setMessage("Paquete actualizado.");
      window.setTimeout(() => setMessage(""), 2500);
    });
  }

  return (
    <div className="grid gap-2">
      <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Paquete contratado
      </label>
      <Select value={value} onChange={(event) => handleChange(event.target.value)} disabled={isPending}>
        {packageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {message ? (
        <p className="text-xs font-semibold text-muted-foreground">{message}</p>
      ) : null}
      <div className="rounded-lg border border-[#eadfd2] bg-white/70 p-3">
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Incluye
        </p>
        <ul className="grid gap-1 text-xs font-medium text-[#3b1721]">
          {PACKAGE_FEATURES[value].map((feature) => (
            <li key={feature}>• {featureLabels[feature]}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
