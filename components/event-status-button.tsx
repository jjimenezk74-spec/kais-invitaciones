"use client";

import { useState } from "react";
import { Globe, GlobeLock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventStatus } from "@/lib/types";

type Props = {
  eventId: string;
  nextStatus: EventStatus;
  isDraft: boolean;
  draftLabel?: string;
  publishedLabel?: string;
};

type StatusResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
};

export function EventStatusButton({
  eventId,
  nextStatus,
  isDraft,
  draftLabel = "Publicar",
  publishedLabel = "A borrador",
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus() {
    if (isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/dashboard/events/${eventId}/status`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-kais-fetch-action": "1",
        },
        body: JSON.stringify({ status: nextStatus }),
        redirect: "follow",
      });

      const contentType = response.headers.get("content-type") ?? "";
      const result = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as StatusResponse | null)
        : null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? `No se pudo cambiar el estado (${response.status}).`);
      }

      window.location.assign(result.redirectTo ?? `/dashboard/eventos/${eventId}?saved=status`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado.");
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        size="sm"
        variant={isDraft ? "default" : "outline"}
        disabled={isSaving}
        onClick={updateStatus}
      >
        {isDraft ? <Globe className="h-4 w-4" /> : <GlobeLock className="h-4 w-4" />}
        {isSaving ? "Guardando..." : isDraft ? draftLabel : publishedLabel}
      </Button>
      {error ? <p className="max-w-64 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
