"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteEventForm({ endpoint }: { endpoint: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteEvent() {
    const confirmed = window.confirm("Esta acción no se puede deshacer. ¿Seguro que deseas eliminar este evento?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "x-kais-fetch-action": "1",
        },
        redirect: "follow",
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          redirectTo?: string;
        } | null;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error ?? `No se pudo eliminar el evento (${response.status}).`);
        }

        window.location.assign(result.redirectTo ?? "/dashboard");
        return;
      }

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      if (!response.ok) {
        throw new Error(`No se pudo eliminar el evento (${response.status}).`);
      }

      window.location.assign("/dashboard");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el evento.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid gap-3">
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      <Button type="button" variant="danger" className="w-full sm:w-fit" disabled={isDeleting} onClick={deleteEvent}>
        <Trash2 className="h-4 w-4" />
        {isDeleting ? "Eliminando..." : "Eliminar evento"}
      </Button>
    </div>
  );
}
