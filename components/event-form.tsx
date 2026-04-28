"use client";

import { Save } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { DEFAULT_INVITATION_DESIGN_CONFIG, normalizeInvitationDesignConfig } from "@/lib/invitation-design";
import { applyThemeToDesignConfig } from "@/lib/invitation-themes";
import { getThemePreview } from "@/lib/theme-preview";
import { createClientSupabaseBrowser } from "@/lib/supabase/browser";
import type { Client, Event, EventCategory, InvitationTemplate, InvitationTheme, Profile } from "@/lib/types";

type EventFormProps = {
  action: (formData: FormData) => Promise<void> | void;
  event?: Event;
  clients?: Profile[];
  businessClients?: Client[];
  templates?: InvitationTemplate[];
  categories?: EventCategory[];
  themes?: InvitationTheme[];
  showOwner?: boolean;
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

export function EventForm({ action, event, clients = [], businessClients = [], templates = [], categories = [], themes = [], showOwner = false }: EventFormProps) {
  const shouldShowOwnerSelect = showOwner && clients.length > 0;
  const designConfig = normalizeInvitationDesignConfig({ designConfig: event?.design_config ?? undefined });
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(event?.category_id ?? null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(event?.theme_id ?? null);
  const submitAfterUploadRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const activeCategories = categories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const activeThemes = themes.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const filteredThemes = selectedCategoryId
    ? activeThemes.filter((t) => t.category_id === selectedCategoryId)
    : activeThemes;

  function handleThemeSelect(theme: InvitationTheme) {
    setSelectedThemeId(theme.id);
    const form = formRef.current;
    if (!form) return;
    const config = applyThemeToDesignConfig(theme);
    if (config.fontPreset) setInputValue(form, "design_font_preset", config.fontPreset);
    if (config.backgroundVariant) setInputValue(form, "design_background_variant", config.backgroundVariant);
    if (config.animationPreset) setInputValue(form, "design_animation_preset", config.animationPreset);
    if (config.decorationLevel) setInputValue(form, "design_decoration_level", config.decorationLevel);
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-5"
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

      {/* ── Hidden fields for category + theme ───────────────────────────────── */}
      <input type="hidden" name="category_id" value={selectedCategoryId ?? ""} />
      <input type="hidden" name="theme_id" value={selectedThemeId ?? ""} />

      {/* ── Category + Theme selector ─────────────────────────────────────────── */}
      {(activeCategories.length > 0 || activeThemes.length > 0) ? (
        <div className="rounded-xl border bg-background p-5">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Tema de invitación</p>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Elige la atmósfera visual de tu invitación. Cada tema preselecciona fuente, fondo y animación.
          </p>

          {/* Category filter pills */}
          {activeCategories.length > 0 ? (
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-all ${
                  !selectedCategoryId
                    ? "border-accent bg-accent text-accent-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {activeCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-all ${
                    selectedCategoryId === cat.id
                      ? "border-accent bg-accent text-accent-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          ) : null}

          {/* Theme grid */}
          {filteredThemes.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">

              {/* "None" card */}
              <button
                type="button"
                onClick={() => setSelectedThemeId(null)}
                className={`group overflow-hidden rounded-xl border-2 text-left transition-all focus:outline-none ${
                  !selectedThemeId
                    ? "border-accent shadow-md"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <div className="relative flex aspect-[4/3] items-center justify-center bg-muted/30">
                  <span className="text-2xl text-muted-foreground/30 select-none">∅</span>
                  {!selectedThemeId && (
                    <div className="absolute top-2 left-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                      <svg viewBox="0 0 8 8" className="h-2.5 w-2.5 text-accent-foreground" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="1,4 3,6 7,2" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">Sin tema</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">Diseño personalizado</p>
                </div>
              </button>

              {filteredThemes.map((theme) => {
                const preview = getThemePreview(theme.slug);
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleThemeSelect(theme)}
                    className={`group overflow-hidden rounded-xl border-2 text-left transition-all focus:outline-none ${
                      isSelected
                        ? "border-accent shadow-lg"
                        : "border-border hover:border-accent/40 hover:shadow-md"
                    }`}
                    style={isSelected ? { boxShadow: `0 4px 20px ${preview.accentColor}33` } : undefined}
                  >
                    {/* ── Preview area ── */}
                    <div
                      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
                      style={{ background: preview.gradient }}
                    >
                      {/* Shimmer overlay */}
                      {preview.shimmer ? (
                        <div className="absolute inset-0 pointer-events-none" style={{ background: preview.shimmer }} />
                      ) : null}

                      {/* Focal icon */}
                      <span
                        className="relative z-10 select-none text-5xl drop-shadow-xl transition-transform duration-300 group-hover:scale-110"
                        style={{ filter: `drop-shadow(0 0 8px ${preview.accentColor}88)` }}
                      >
                        {preview.icon}
                      </span>

                      {/* Horizontal accent lines at bottom */}
                      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5">
                        <div className="h-px w-10 opacity-70" style={{ background: preview.accentColor }} />
                        <div className="h-px w-5 opacity-40" style={{ background: preview.accentColor }} />
                      </div>

                      {/* Premium badge */}
                      {theme.is_premium ? (
                        <div
                          className="absolute top-2 right-2 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                          style={{
                            background: `${preview.accentColor}22`,
                            color: preview.accentColor,
                            border: `1px solid ${preview.accentColor}55`,
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          PREMIUM
                        </div>
                      ) : null}

                      {/* Selected checkmark */}
                      {isSelected ? (
                        <div className="absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow">
                          <svg viewBox="0 0 8 8" className="h-3 w-3 text-accent-foreground" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polyline points="1,4 3,6 7,2" />
                          </svg>
                        </div>
                      ) : null}
                    </div>

                    {/* ── Info area ── */}
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-bold leading-tight">{theme.name}</p>
                      {theme.description ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                          {theme.description}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay temas disponibles para esta categoría.</p>
          )}
        </div>
      ) : null}

      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Diseño de invitación</p>
            <p className="mt-1 text-sm text-muted-foreground">Personaliza la apariencia premium de la invitacion.</p>
          </div>
          <Button type="button" variant="outline" className="w-full border-accent/40 sm:w-fit" onClick={(e) => restoreDefaultDesign(e.currentTarget.form)}>
            Restaurar diseño original
          </Button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Fuente">
            <Select name="design_font_preset" defaultValue={designConfig.fontPreset}>
              <option value="default">Default</option>
              <option value="romantic-script">Romantic Script</option>
              <option value="luxury-serif">Luxury Serif</option>
              <option value="royal-classic">Royal Classic</option>
              <option value="modern-chic">Modern Chic</option>
            </Select>
          </Field>
          <Field label="Fondo">
            <Select name="design_background_variant" defaultValue={designConfig.backgroundVariant}>
              <option value="default">Default</option>
              <option value="dark-roses">Dark Roses</option>
              <option value="satin-red">Satin Red</option>
              <option value="gold-glow">Gold Glow</option>
              <option value="romantic-floral">Romantic Floral</option>
            </Select>
          </Field>
          <Field label="Animación">
            <Select name="design_animation_preset" defaultValue={designConfig.animationPreset}>
              <option value="none">Ninguna</option>
              <option value="soft-petals">Soft Petals</option>
              <option value="gold-sparkles">Gold Sparkles</option>
              <option value="elegant-glow">Elegant Glow</option>
            </Select>
          </Field>
          <Field label="Detalles decorativos">
            <Select name="design_decoration_level" defaultValue={designConfig.decorationLevel}>
              <option value="minimal">Minimal</option>
              <option value="medium">Medium</option>
              <option value="premium">Premium</option>
            </Select>
          </Field>
        </div>
      </div>

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

function restoreDefaultDesign(form: HTMLFormElement | null) {
  if (!form) return;
  setInputValue(form, "design_font_preset", DEFAULT_INVITATION_DESIGN_CONFIG.fontPreset);
  setInputValue(form, "design_background_variant", DEFAULT_INVITATION_DESIGN_CONFIG.backgroundVariant);
  setInputValue(form, "design_animation_preset", DEFAULT_INVITATION_DESIGN_CONFIG.animationPreset);
  setInputValue(form, "design_decoration_level", DEFAULT_INVITATION_DESIGN_CONFIG.decorationLevel);
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
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    el.value = value;
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
    return `${label} supera el maximo permitido de ${formatBytes(maxSize)}. Comprime el archivo antes de subirlo.`;
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
