"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type BackButtonProps = {
  label?: string;
  from?: string;
};

export function BackButton({ label = "Volver", from = "" }: BackButtonProps) {
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const validFrom = from === "dashboard" || from === "panel";

    let validReferrer = false;
    try {
      if (document.referrer) {
        const referrer = new URL(document.referrer);
        validReferrer =
          referrer.origin === window.location.origin &&
          (referrer.pathname.startsWith("/dashboard") || referrer.pathname.startsWith("/panel-evento"));
      }
    } catch {
      validReferrer = false;
    }

    setCanGoBack(validFrom || validReferrer);
  }, [from]);

  if (!canGoBack) return null;

  return (
    <Button type="button" variant="outline" className="border-white/40 bg-black/35 text-white backdrop-blur hover:bg-black/50" onClick={() => window.history.back()}>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
