"use client";

import Image from "next/image";
import { Camera, CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { insertLivePhoto } from "@/app/actions/insert-live-photo";
import { createClient } from "@/lib/supabase/browser";

type UploadState = "idle" | "uploading" | "success" | "error";

type PhotoUploadFormProps = {
  eventId: string;
  eventSlug: string;
  accentColor?: string;
};

export function PhotoUploadForm({ eventId, accentColor = "#d4af37" }: PhotoUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [file, setFile]             = useState<File | null>(null);
  const [guestName, setGuestName]   = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [uploadState, setUploadState]   = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg]     = useState("");

  const safeAccent = accentColor?.trim() || "#d4af37";

  // ── file selection ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) { setErrorMsg("La imagen no puede superar 10 MB."); return; }
    if (!selected.type.startsWith("image/")) { setErrorMsg("Solo se permiten archivos de imagen."); return; }
    setErrorMsg("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    const synthetic = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileChange(synthetic);
  }, [handleFileChange]);

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setErrorMsg("Selecciona una foto primero."); return; }

    setUploadState("uploading");
    setErrorMsg("");

    try {
      // ── Step 1: init browser Supabase client ──────────────────────────────
      console.log("[LiveAlbum] Step 1: initializing browser Supabase client");
      console.log("[LiveAlbum] eventId:", eventId);
      console.log("[LiveAlbum] file:", file.name, file.size, file.type);

      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const storagePath = `${eventId}/${crypto.randomUUID()}.${ext}`;
      console.log("[LiveAlbum] storagePath:", storagePath);

      // ── Step 2: upload to Storage ─────────────────────────────────────────
      console.log("[LiveAlbum] Step 2: uploading to storage bucket live-photos...");
      const { error: storageError } = await supabase.storage
        .from("live-photos")
        .upload(storagePath, file, { cacheControl: "3600", upsert: false });

      if (storageError) {
        console.error("[LiveAlbum] Storage upload FAILED:", storageError.message, storageError);
        throw new Error(`Error al subir imagen: ${storageError.message}`);
      }
      console.log("[LiveAlbum] Storage upload OK");

      const { data: urlData } = supabase.storage
        .from("live-photos")
        .getPublicUrl(storagePath);
      console.log("[LiveAlbum] publicUrl:", urlData.publicUrl);

      // ── Step 3: call Server Action to insert DB record ────────────────────
      console.log("[LiveAlbum] Step 3: calling insertLivePhoto Server Action...");
      const result = await insertLivePhoto({
        event_id:      eventId,
        image_url:     urlData.publicUrl,
        storage_path:  storagePath,
        guest_name:    guestName.trim() || null,
        guest_message: guestMessage.trim() || null,
      });
      console.log("[LiveAlbum] Server Action result:", result);

      if (result.error) {
        console.error("[LiveAlbum] Server Action returned error:", result.error);
        await supabase.storage.from("live-photos").remove([storagePath]);
        throw new Error(`Error al guardar foto: ${result.error}`);
      }

      console.log("[LiveAlbum] SUCCESS — photo saved");
      setUploadState("success");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado. Intenta de nuevo.";
      console.error("[LiveAlbum] CATCH:", msg, err);
      setErrorMsg(msg);
      setUploadState("error");
    }
  };

  // ── success screen ─────────────────────────────────────────────────────────
  if (uploadState === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: `${safeAccent}20` }}
        >
          <CheckCircle2 className="h-10 w-10" style={{ color: safeAccent }} />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">¡Foto enviada!</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu foto fue enviada y será visible al ser aprobada.
          </p>
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

  // ── main form ──────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Drop zone / preview */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Seleccionar foto"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
        style={{ borderColor: preview ? safeAccent : "#d1d5db" }}
      >
        {preview ? (
          <>
            <Image src={preview} alt="Preview" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-black/20" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
              aria-label="Quitar foto"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="relative z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
              Toca para cambiar
            </span>
          </>
        ) : (
          <>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: `${safeAccent}18` }}
            >
              <Camera className="h-7 w-7" style={{ color: safeAccent }} />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Toca para seleccionar una foto
            </p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · máx. 10 MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {/* Name + message */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tu nombre{" "}
            <span className="font-normal normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="¿Cómo te llamas?"
            maxLength={80}
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mensaje{" "}
            <span className="font-normal normal-case tracking-normal">(opcional)</span>
          </label>
          <textarea
            value={guestMessage}
            onChange={(e) => setGuestMessage(e.target.value)}
            placeholder="Un mensaje para los festejados…"
            maxLength={280}
            rows={3}
            className="resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/40"
          />
        </div>
      </div>

      {/* Error message — always shows the real error text */}
      {errorMsg ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      ) : null}

      {/* Submit — .kais-upload-btn is defined in globals.css with !important */}
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
            Enviando foto…
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
