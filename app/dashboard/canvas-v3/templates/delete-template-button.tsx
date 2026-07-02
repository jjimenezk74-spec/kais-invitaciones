"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteCanvasV3TemplateButtonProps = {
  action: () => void;
  templateName: string;
};

export function DeleteCanvasV3TemplateButton({
  action,
  templateName,
}: DeleteCanvasV3TemplateButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Esta accion eliminara la plantilla "${templateName}". ¿Continuar?`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <Button type="submit" size="sm" variant="danger">
        <Trash2 className="h-4 w-4" />
        Eliminar
      </Button>
    </form>
  );
}
