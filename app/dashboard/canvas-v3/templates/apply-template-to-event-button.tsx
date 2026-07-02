"use client";

import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApplyCanvasV3TemplateToEventButton({
  formId,
  templateName,
}: {
  formId: string;
  templateName: string;
}) {
  return (
    <Button
      type="submit"
      form={formId}
      size="sm"
      variant="secondary"
      onClick={(event) => {
        const ok = window.confirm(
          `Esto reemplazará el canvas_design V3 del evento con la plantilla "${templateName}" hidratada con sus datos reales. ¿Continuar?`
        );
        if (!ok) event.preventDefault();
      }}
    >
      <Wand2 className="h-4 w-4" />
      Aplicar
    </Button>
  );
}
