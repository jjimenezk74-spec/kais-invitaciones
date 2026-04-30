"use client";

import { Check, Copy, MonitorPlay } from "lucide-react";
import { useState } from "react";

type LiveScreenActionsProps = {
  livePath: string;
  liveUrl: string;
};

export function LiveScreenActions({ livePath, liveUrl }: LiveScreenActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLiveUrl() {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => window.open(livePath, "_blank")}
        title="Abrir pantalla en vivo para TV"
        aria-label="Abrir pantalla en vivo para TV"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted"
      >
        <MonitorPlay className="h-3.5 w-3.5" />
        Pantalla en vivo
      </button>
      <button
        type="button"
        onClick={copyLiveUrl}
        title="Copiar enlace pantalla"
        aria-label="Copiar enlace pantalla"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado" : "Copiar enlace pantalla"}
      </button>
    </>
  );
}
