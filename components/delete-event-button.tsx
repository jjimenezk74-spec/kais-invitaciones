"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteEventButtonProps = {
  action: () => void;
};

export function DeleteEventButton({ action }: DeleteEventButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm("Esta acción no se puede deshacer. ¿Seguro que deseas eliminar este evento?");
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <Button variant="danger" className="w-full sm:w-fit">
        <Trash2 className="h-4 w-4" />
        Eliminar evento
      </Button>
    </form>
  );
}
