"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteEventButton() {
  return (
    <Button
      type="submit"
      variant="danger"
      className="w-full sm:w-fit"
      onClick={(event) => {
        const confirmed = window.confirm("Esta accion no se puede deshacer. Seguro que deseas eliminar este evento?");
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
      Eliminar evento
    </Button>
  );
}
