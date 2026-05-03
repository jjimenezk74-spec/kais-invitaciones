"use client";

import { useState, useTransition } from "react";
import { updateEventPackage } from "@/app/actions/events";
import { Select } from "@/components/ui/select";
import type { EventPackageKey } from "@/lib/types";

const packageOptions: Array<{ value: EventPackageKey; label: string }> = [
  { value: "essential", label: "Essential" },
  { value: "premium", label: "Premium" },
  { value: "experience", label: "Experience" },
  { value: "luxury", label: "Luxury" },
];

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
    </div>
  );
}
