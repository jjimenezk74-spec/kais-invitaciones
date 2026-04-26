"use client";

import { Download } from "lucide-react";
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
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button variant="outline" disabled={!png} onClick={() => download(png, `${filename}.png`)}>
        <Download className="h-4 w-4" />
        QR PNG
      </Button>
      <Button variant="outline" disabled={!svg} onClick={() => download(svg, `${filename}.svg`)}>
        <Download className="h-4 w-4" />
        QR SVG
      </Button>
    </div>
  );
}

function download(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}
