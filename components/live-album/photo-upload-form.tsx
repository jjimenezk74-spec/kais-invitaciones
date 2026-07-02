"use client";

import Image from "next/image";
import { Camera, CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type UploadState = "idle" | "uploading" | "success" | "error";

type PhotoUploadFormProps = {
  eventId: string;
  eventSlug: string;
  accentColor?: string;
};

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export function PhotoUploadForm({ eventId, accentColor = "#d4af37" }: PhotoUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const safeAccent = accentColor?.trim() || "#d4af37";

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const validationError = validatePhotoFile(selected);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setErrorMsg("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;
    const validationError = validatePhotoFile(dropped);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setErrorMsg("");
    setFile(dropped);
    setPreview(URL.createObjectURL(dropped));
  }, []);

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setErrorMsg("Selecciona una foto primero.");
      return;
    }

    setUploadState("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("guest_name", guestName.trim());
      formData.set("guest_message", guestMessage.trim());

      const response = await fetch(`/api/live-photos/${eventId}`, {
        method: "POST",
        body: formData
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Error al guardar foto.");
      }

      setUploadState("success");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Error inesperado. Intenta de nuevo.");
      setUploadState("error");
    }
  };

  if (uploadState === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `${safeAccent}20` }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: safeAccent }} />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">Foto enviada</p>
          <p className="mt-2 text-sm text-muted-foreground">Tu foto fue enviada y sera visible al ser aprobada.</p>
        </div>
        <button
          onClick={() => {
            setUploadState("idle");
            clearFile();
            setGuestName("");
            setGuestMessage("");
            setErrorMsg("");
          }}
          className="mt-2 rounded-xl border border-border px-6 py-2.5 text-sm font-semibold transition hover:bg-muted"
        >
          Subir otra foto
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Seleccionar foto"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
        className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
        style={{ borderColor: preview ? safeAccent : "#d1d5db" }}
      >
        {preview ? (
          <>
            <Image src={preview} alt="Preview" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-black/20" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearFile();
              }}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
              aria-label="Quitar foto"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="relative z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">Toca para cambiar</span>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${safeAccent}18` }}>
              <Camera className="h-7 w-7" style={{ color: safeAccent }} />
            </div>
            <p className="text-sm font-semibold text-foreground">Toca para seleccionar una foto</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · max. 10 MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tu nombre <span className="font-normal normal-case tracking-normal">(opcional)</span>
          <input
            type="text"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="Como te llamas?"
            maxLength={80}
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-normal normal-case tracking-normal outline-none transition focus:border-foreground/40"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mensaje <span className="font-normal normal-case tracking-normal">(opcional)</span>
          <textarea
            value={guestMessage}
            onChange={(event) => setGuestMessage(event.target.value)}
            placeholder="Un mensaje para los festejados..."
            maxLength={280}
            rows={3}
            className="resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm font-normal normal-case tracking-normal outline-none transition focus:border-foreground/40"
          />
        </label>
      </div>

      {errorMsg ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMsg}</p> : null}

      <button
        type="submit"
        disabled={uploadState === "uploading"}
        className="kais-upload-btn"
        data-has-file={file ? "true" : "false"}
        style={{ "--kais-upload-accent": safeAccent } as React.CSSProperties}
      >
        {uploadState === "uploading" ? (
          <>
            <Loader2 style={{ width: "1.25rem", height: "1.25rem" }} className="animate-spin" />
            Enviando foto...
          </>
        ) : (
          <>
            <UploadCloud style={{ width: "1.25rem", height: "1.25rem" }} />
            {file ? "Enviar foto" : "Selecciona una foto primero"}
          </>
        )}
      </button>
    </form>
  );
}

function validatePhotoFile(file: File) {
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const hasValidType = !file.type || ALLOWED_PHOTO_TYPES.includes(file.type);
  const hasValidExtension = ALLOWED_PHOTO_EXTENSIONS.includes(extension);

  if (!hasValidType || !hasValidExtension) return "Solo se permiten fotos JPG, PNG o WEBP.";
  if (file.size > MAX_PHOTO_SIZE) return "La imagen no puede superar 10 MB.";
  return "";
}
