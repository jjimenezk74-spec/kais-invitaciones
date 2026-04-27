"use client";

import { Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { EventLivePreview } from "@/components/event-live-preview";
import { createClientSupabaseBrowser } from "@/lib/supabase/browser";
import type { Client, Event, InvitationTemplate, Profile } from "@/lib/types";

type EventFormProps = {
  action: (formData: FormData) => Promise<void> | void;
  event?: Event;
  clients?: Profile[];
  businessClients?: Client[];
  templates?: InvitationTemplate[];
  showOwner?: boolean;
};

type PreviewState = {
  templateId: string;
  title: string;
  hostNames: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  address: string;
  mainMessage: string;
  musicUrl: string;
  heroImageUrl: string;
};

const eventTypes = ["boda", "cumpleaños", "quinceaños", "bautizo", "baby shower", "corporativo", "graduación", "otro"];
const statuses = ["borrador", "publicado", "inactivo"];
const guestModes = [
  ["publico", "Publico"],
  ["lista_invitados", "Lista de invitados"]
];
const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_SIZE = 20 * 1024 * 1024;
const ALLOWED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg"];

export function EventForm({ action, event, clients = [], businessClients = [], templates = [], showOwner = false }: EventFormProps) {
  const shouldShowOwnerSelect = showOwner && clients.length > 0;
  const defaultTemplateId = event?.template_id ?? templates.find((template) => template.slug === "rosas-rojas-15")?.id ?? templates[0]?.id ?? "";
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageObjectUrl, setPreviewImageObjectUrl] = useState("");
  const [preview, setPreview] = useState<PreviewState>({
    templateId: defaultTemplateId,
    title: event?.title ?? "",
    hostNames: event?.hosts_names ?? "",
    eventType: event?.event_type ?? "boda",
    eventDate: event?.event_date ?? "",
    eventTime: event?.event_time ?? "",
    address: event?.address ?? "",
    mainMessage: event?.main_message ?? "",
    musicUrl: event?.music_url ?? "",
    heroImageUrl: event?.mobile_cover_image_url ?? event?.cover_image_url ?? ""
  });
  const submitAfterUploadRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewImageObjectUrl) URL.revokeObjectURL(previewImageObjectUrl);
    };
  }, [previewImageObjectUrl]);

  return (
    <form
      action={action}
      className="grid gap-5"
      onChange={(changeEvent) => updatePreviewFromForm(changeEvent.currentTarget, setPreview, setPreviewImageObjectUrl, true)}
      onInput={(inputEvent) => updatePreviewFromForm(inputEvent.currentTarget, setPreview, setPreviewImageObjectUrl, false)}
      onSubmit={async (submitEvent) => {
        if (submitAfterUploadRef.current) {
          submitAfterUploadRef.current = false;
          return;
        }

        const form = submitEvent.currentTarget;
        const error = validateUploads(form);
        if (error) {
          submitEvent.preventDefault();
          setUploadError(error);
          window.requestAnimationFrame(() => {
            document.getElementById("event-form-upload-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }

        if (hasPendingUploads(form)) {
          submitEvent.preventDefault();
          setUploadError("");
          setIsUploading(true);

          try {
            await uploadFilesToSupabase(form, setUploadStatus);
            clearFileInput(form, "cover_image_file");
            clearFileInput(form, "mobile_cover_image_file");
            clearFileInput(form, "music_file");
            submitAfterUploadRef.current = true;
            form.requestSubmit();
          } catch (uploadFailure) {
            setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "No se pudieron subir los archivos. Intenta nuevamente.");
          } finally {
            setIsUploading(false);
            setUploadStatus("");
          }
          return;
        }

        setUploadError("");
      }}
    >
      {uploadError ? (
        <div id="event-form-upload-error" className="rounded-md border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {uploadError}
        </div>
      ) : null}
      {uploadStatus ? (
        <div className="rounded-md border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {uploadStatus}
        </div>
      ) : null}
      {shouldShowOwnerSelect ? (
        <Field label="Cliente">
          <Select name="owner_id" defaultValue={event?.owner_id}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name || client.email}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {showOwner && clients.length === 0 ? (
        <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          No hay clientes internos. El evento quedará asignado a KAIS.
        </div>
      ) : null}

      <Field label="Cliente contratante">
        {businessClients.length > 0 ? (
          <Select name="client_id" defaultValue={event?.client_id ?? ""}>
            <option value="">KAIS / sin cliente asociado</option>
            {businessClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        ) : (
          <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            No hay clientes registrados. El evento quedará asignado a KAIS.
          </div>
        )}
      </Field>

      {templates.length > 0 ? (
        <Field label="Plantilla de invitacion">
          <div className="grid gap-3 md:grid-cols-4">
            {templates.map((template) => (
              <label key={template.id} className="cursor-pointer rounded-lg border bg-background p-3 transition hover:border-accent">
                <input
                  name="template_id"
                  type="radio"
                  value={template.id}
                  defaultChecked={event?.template_id === template.id || (!event?.template_id && template.slug === "rosas-rojas-15")}
                  className="sr-only peer"
                />
                <div
                  className="aspect-[4/3] rounded-md border border-white/20 bg-gradient-to-br from-neutral-950 via-red-950 to-rose-800 shadow-soft peer-checked:ring-2 peer-checked:ring-accent"
                  style={{ background: templatePreviewBackground(template.slug, template.config.primary, template.config.secondary) }}
                />
                <p className="mt-3 text-sm font-semibold">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.category}</p>
              </label>
            ))}
          </div>
        </Field>
      ) : null}

      <EventLivePreview
        templateId={preview.templateId}
        templateSlug={templates.find((template) => template.id === preview.templateId)?.slug}
        title={preview.title}
        hostNames={preview.hostNames}
        eventType={preview.eventType}
        eventDate={preview.eventDate}
        eventTime={preview.eventTime}
        address={preview.address}
        mainMessage={preview.mainMessage}
        musicUrl={preview.musicUrl}
        heroImageUrl={previewImageObjectUrl || preview.heroImageUrl}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Título">
          <Input name="title" defaultValue={event?.title} placeholder="Boda de Ana y Luis" required />
        </Field>
        <Field label="Tipo de evento">
          <Select name="event_type" defaultValue={event?.event_type ?? "boda"}>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Nombres de anfitriones">
        <Input name="hosts_names" defaultValue={event?.hosts_names} placeholder="Ana & Luis" required />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Fecha">
          <Input name="event_date" type="date" defaultValue={event?.event_date} required />
        </Field>
        <Field label="Hora">
          <Input name="event_time" type="time" defaultValue={event?.event_time} required />
        </Field>
      </div>

      <Field label="Dirección">
        <Input name="address" defaultValue={event?.address} placeholder="Salón, ciudad, país" required />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Google Maps">
          <Input name="google_maps_link" defaultValue={event?.google_maps_link ?? ""} placeholder="https://maps.google.com/..." />
        </Field>
        <Field label="Código de vestimenta">
          <Input name="dress_code" defaultValue={event?.dress_code ?? ""} placeholder="Elegante sport" />
        </Field>
      </div>

      <Field label="Mensaje principal">
        <Textarea name="main_message" defaultValue={event?.main_message ?? ""} placeholder="Una frase especial para tus invitados" />
      </Field>

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="URL portada">
          <Input name="cover_image_url" defaultValue={event?.cover_image_url ?? ""} placeholder="https://..." />
        </Field>
        <Field label="Foto de portada" hint="JPG/PNG/WEBP máximo 5MB. Si pesa más, comprime la imagen antes de subirla.">
          <Input name="cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field label="Portada móvil" hint="JPG/PNG/WEBP máximo 5MB. Usa una imagen vertical y comprimida para mejor carga móvil.">
          <Input name="mobile_cover_image_url" defaultValue={event?.mobile_cover_image_url ?? ""} placeholder="https://..." />
          <Input name="mobile_cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field
          label="Música opcional"
          hint="MP3/WAV/OGG máximo 10MB. Si pesa más, usa un enlace o comprime el audio."
        >
          <Input name="music_url" defaultValue={event?.music_url ?? ""} placeholder="https://..." />
          <Input name="music_file" type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" />
        </Field>
        <Field label="Color tema">
          <Input name="theme_color" type="color" defaultValue={event?.theme_color ?? "#111827"} />
        </Field>
      </div>

      <Field label="Estado">
        <Select name="status" defaultValue={event?.status ?? "borrador"}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Modo de RSVP">
        <Select name="guest_mode" defaultValue={event?.guest_mode ?? "publico"}>
          {guestModes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Button className="w-full sm:w-fit">
        <Save className="h-4 w-4" />
        {isUploading ? "Subiendo archivos..." : "Guardar evento"}
      </Button>
    </form>
  );
}

function validateUploads(form: HTMLFormElement) {
  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  const musicFile = getFile(form, "music_file");
  const files = [coverFile, mobileCoverFile, musicFile].filter(Boolean) as File[];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const coverError = validateFile(coverFile, "La portada desktop", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (coverError) return coverError;

  const mobileCoverError = validateFile(mobileCoverFile, "La portada móvil", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (mobileCoverError) return mobileCoverError;

  const musicError = validateFile(musicFile, "La música", MAX_AUDIO_FILE_SIZE, ALLOWED_AUDIO_EXTENSIONS);
  if (musicError) return musicError;

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
    return "Los archivos seleccionados no deben superar 20MB en total. Comprime imágenes/audio o sube menos archivos a la vez.";
  }

  return "";
}

function getFile(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement && input.files?.[0] ? input.files[0] : null;
}

function hasPendingUploads(form: HTMLFormElement) {
  return Boolean(getFile(form, "cover_image_file") || getFile(form, "mobile_cover_image_file") || getFile(form, "music_file"));
}

function updatePreviewFromForm(
  form: HTMLFormElement,
  setPreview: Dispatch<SetStateAction<PreviewState>>,
  setPreviewImageObjectUrl: Dispatch<SetStateAction<string>>,
  includeFilePreview: boolean
) {
  const nextHeroImageUrl = getInputValue(form, "mobile_cover_image_url") || getInputValue(form, "cover_image_url");

  setPreview({
    templateId: getCheckedValue(form, "template_id"),
    title: getInputValue(form, "title"),
    hostNames: getInputValue(form, "hosts_names"),
    eventType: getInputValue(form, "event_type"),
    eventDate: getInputValue(form, "event_date"),
    eventTime: getInputValue(form, "event_time"),
    address: getInputValue(form, "address"),
    mainMessage: getInputValue(form, "main_message"),
    musicUrl: getInputValue(form, "music_url"),
    heroImageUrl: nextHeroImageUrl
  });

  if (includeFilePreview) {
    const imageFile = getFile(form, "mobile_cover_image_file") ?? getFile(form, "cover_image_file");
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setPreviewImageObjectUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return objectUrl;
      });
    }
  }
}

function getInputValue(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) {
    return input.value;
  }
  return "";
}

function getCheckedValue(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  if (input instanceof RadioNodeList) {
    return String(input.value ?? "");
  }
  if (input instanceof HTMLInputElement) {
    return input.value;
  }
  return "";
}

async function uploadFilesToSupabase(form: HTMLFormElement, setStatus: (status: string) => void) {
  const { client: supabase, error: envError } = createClientSupabaseBrowser();

  if (!supabase) {
    throw new Error(envError ?? "No se pudo inicializar Supabase para subir archivos.");
  }
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente antes de subir archivos.");
  }

  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  const musicFile = getFile(form, "music_file");

  if (coverFile) {
    setStatus("Subiendo portada desktop a Supabase Storage...");
    const publicUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: coverFile,
      path: `covers/direct/${user.id}/${crypto.randomUUID()}-${sanitizeFileName(coverFile.name)}`,
      contentType: coverFile.type || getImageContentType(coverFile.name)
    });
    setInputValue(form, "cover_image_url", publicUrl);
  }

  if (mobileCoverFile) {
    setStatus("Subiendo portada móvil a Supabase Storage...");
    const publicUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: mobileCoverFile,
      path: `covers/direct/${user.id}/mobile/${crypto.randomUUID()}-${sanitizeFileName(mobileCoverFile.name)}`,
      contentType: mobileCoverFile.type || getImageContentType(mobileCoverFile.name)
    });
    setInputValue(form, "mobile_cover_image_url", publicUrl);
  }

  if (musicFile) {
    setStatus("Subiendo música a Supabase Storage...");
    const extension = getExtension(musicFile.name);
    const publicUrl = await uploadPublicFile({
      bucket: "event-audio",
      file: musicFile,
      path: `${user.id}/${crypto.randomUUID()}${extension}`,
      contentType: musicFile.type || getAudioContentType(extension)
    });
    setInputValue(form, "music_url", publicUrl);
  }
}

async function uploadPublicFile({
  bucket,
  file,
  path,
  contentType
}: {
  bucket: "event-photos" | "event-audio";
  file: File;
  path: string;
  contentType: string;
}) {
  const { client: supabase, error: envError } = createClientSupabaseBrowser();

  if (!supabase) {
    throw new Error(envError ?? "No se pudo inicializar Supabase para subir archivos.");
  }
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    contentType,
    upsert: false
  });

  if (error) {
    throw new Error(`No se pudo subir ${file.name}. Detalle: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function setInputValue(form: HTMLFormElement, name: string, value: string) {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement) {
    input.value = value;
  }
}

function clearFileInput(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement) {
    input.value = "";
  }
}

function validateFile(file: File | null, label: string, maxSize: number, allowedExtensions: string[]) {
  if (!file) return "";

  const extension = getExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    return `${label} debe tener formato ${allowedExtensions.join(", ")}.`;
  }

  if (file.size > maxSize) {
    return `${label} supera el máximo permitido de ${formatBytes(maxSize)}. Comprime el archivo antes de subirlo.`;
  }

  return "";
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getExtension(fileName: string) {
  return fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

function getImageContentType(fileName: string) {
  const extension = getExtension(fileName);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  return "image/webp";
}

function getAudioContentType(extension: string) {
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  return "audio/ogg";
}

function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

function templatePreviewBackground(slug: string, primary?: string, secondary?: string) {
  if (slug === "rosas-rojas-15") {
    return "radial-gradient(circle at 15% 15%, #7f1d1d 0 12%, transparent 13%), linear-gradient(135deg, #170607, #5f0f14 58%, #d4af37)";
  }

  return `linear-gradient(135deg, ${primary ?? "#111827"}, ${secondary ?? "#e5e7eb"})`;
}
