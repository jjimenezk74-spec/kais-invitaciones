"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteClientButtonProps = {
  action: () => void;
};

export function DeleteClientButton({ action }: DeleteClientButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm("Esta accion no se puede deshacer. ¿Seguro que deseas borrar este cliente?");
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <Button variant="danger" size="sm" className="w-full sm:w-fit">
        <Trash2 className="h-4 w-4" />
        Borrar
      </Button>
    </form>
  );
}
