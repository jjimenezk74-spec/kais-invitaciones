"use client";

import { Check, Copy, Download, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type PhotoUploadQrCardProps = {
  url: string;
  filename: string;
  variant?: "dashboard" | "public";
  shareMessage?: string;
};

export function PhotoUploadQrCard({ url, filename, variant = "dashboard", shareMessage }: PhotoUploadQrCardProps) {
  const [png, setPng] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const isPublic = variant === "public";

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      color: {
        dark: isPublic ? "#1b070b" : "#111827",
        light: "#fffaf2"
      }
    }).then(setPng);
  }, [isPublic, url]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(shareMessage ?? url);
      setCopiedMessage(true);
      window.setTimeout(() => setCopiedMessage(false), 1800);
    } catch {
      setCopiedMessage(false);
    }
  }

  const preview = (
    <div
      className={[
        "mx-auto flex aspect-square w-40 items-center justify-center rounded-2xl border p-3 shadow-sm sm:w-44",
        isPublic
          ? "border-[#d4af37]/30 bg-[#fffaf2]"
          : "border-[#eadfd2] bg-[#fffaf2]"
      ].join(" ")}
    >
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png} alt="QR para subir fotos" className="h-full w-full rounded-xl" />
      ) : (
        <QrCode className={isPublic ? "h-12 w-12 text-[#d4af37]" : "h-12 w-12 text-muted-foreground"} />
      )}
    </div>
  );

  if (isPublic) {
    return (
      <div className="kais-glass mx-auto grid max-w-sm gap-5 rounded-[1.6rem] p-6 text-center sm:p-8">
        {preview}
        <div>
          <p className="kais-eyebrow">QR del album</p>
          <p className="mt-3 break-all text-xs leading-5 text-[#f5ecd9]/55">{url}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!png}
            onClick={() => download(png, `${filename}.png`)}
            className="kais-cta justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            PNG
          </button>
          <button
            type="button"
            onClick={copyUrl}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d4af37]/30 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[#f5ecd9] transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-background p-4 md:grid-cols-[auto_1fr] md:items-center">
      {preview}
      <div className="grid gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Enlace publico para subir fotos</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">{url}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" disabled={!png} onClick={() => download(png, `${filename}.png`)}>
            <Download className="h-4 w-4" />
            Descargar PNG
          </Button>
          <Button variant="outline" onClick={copyUrl}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
          {shareMessage ? (
            <>
              <Button variant="outline" onClick={copyMessage}>
                {copiedMessage ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedMessage ? "Mensaje copiado" : "Copiar mensaje"}
              </Button>
              <Button variant="outline" asChild>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function download(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}
