"use client";

import { Download, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type QrDownloadProps = {
  value: string;
  filename: string;
};

export function QrDownload({ value, filename }: QrDownloadProps) {
  const [png, setPng] = useState("");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    QRCode.toDataURL(value, { width: 1024, margin: 2, color: { dark: "#111827", light: "#ffffff" } }).then(setPng);
    QRCode.toString(value, { type: "svg", margin: 2, color: { dark: "#111827", light: "#ffffff" } }).then((code) =>
      setSvg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(code)}`)
    );
  }, [value]);

  return (
    <div className="grid gap-2">
      <div className="mx-auto flex aspect-square w-24 items-center justify-center rounded-2xl border border-[#eadfd2] bg-[#fffaf2] p-2 shadow-sm">
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={png} alt="QR" className="h-full w-full rounded-xl" />
        ) : (
          <QrCode className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" disabled={!png} onClick={() => download(png, `${filename}.png`)}>
          <Download className="h-4 w-4" />
          PNG
        </Button>
        <Button size="sm" variant="outline" disabled={!svg} onClick={() => download(svg, `${filename}.svg`)}>
          <Download className="h-4 w-4" />
          SVG
        </Button>
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

