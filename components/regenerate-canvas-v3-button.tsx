"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RegenerateCanvasV3Button({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const ok = window.confirm(
          "Esto reemplazara el diseño actual con uno nuevo generado desde los datos del evento. ¿Continuar?"
        );
        if (!ok) event.preventDefault();
      }}
    >
      <Button type="submit" variant="outline" className="w-full sm:w-auto">
        <RefreshCw className="h-4 w-4" />
        Recrear diseño
      </Button>
    </form>
  );
}
