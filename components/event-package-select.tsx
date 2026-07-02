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
  music: "Musica",
  rsvp: "Confirmacion RSVP",
  external_rsvp_whatsapp: "RSVP por WhatsApp",
  external_photo_album: "Album externo",
  guest_list: "Lista de invitados",
  live_album: "Album en vivo",
  album_comments: "Comentarios",
  album_reactions: "Reacciones",
  photo_upload: "Subida de fotos",
  photo_qr: "QR de fotos",
  gallery: "Galeria",
  custom_themes: "Temas personalizados",
  free_decorations: "Decoracion libre",
  client_access: "Acceso cliente",
  analytics: "Metricas",
  csv_export: "CSV",
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
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start">
        <div className="grid gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
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
            <p className="text-[11px] font-semibold text-muted-foreground">{message}</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {PACKAGE_FEATURES[value].map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-[#eadfd2] bg-white/75 px-2.5 py-1 text-[11px] font-semibold leading-none text-[#3b1721]"
            >
              {featureLabels[feature]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}