"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ label = "Volver" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.history.back()}>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
