"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveVisualDecorationsOnly, updateEventCoverOnly, updateEventMusicOnly, updateEventThemeOnly } from "@/app/actions/events";
import { DEFAULT_INVITATION_DESIGN_CONFIG, normalizeInvitationDesignConfig } from "@/lib/invitation-design";
import { applyThemeToDesignConfig } from "@/lib/invitation-themes";
import { eventHasFeature } from "@/lib/event-features";
import { getThemePreview } from "@/lib/theme-preview";
import { createClientSupabaseBrowser } from "@/lib/supabase/browser";
import type { Client, Event, EventCategory, InvitationDesignConfig, InvitationTheme, Profile, VisualDecoration, VisualDecorationDevice, VisualDecorationFitMode, VisualDecorationSection } from "@/lib/types";

type EventFormProps = {
  action: (formData: FormData) => Promise<void> | void;
  event?: Event;
  clients?: Profile[];
  businessClients?: Client[];
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
const ALLOWED_DECORATION_EXTENSIONS = [".png", ".webp"];
const MAX_DECORATION_FILE_SIZE = 5 * 1024 * 1024;
const visualDecorationSections: Array<[VisualDecorationSection, string]> = [
  ["hero", "Hero"],
  ["info", "Informacion"],
  ["rsvp", "RSVP"],
  ["gallery", "Galeria"],
  ["footer", "Footer"]
];
const visualDecorationDevices: Array<[VisualDecorationDevice, string]> = [
  ["desktop", "Desktop"],
  ["mobile", "Mobile"]
];
const decorationEffects = [
  ["none", "Sin efecto"],
  ["glow", "Glow"],
  ["soft_shadow", "Sombra suave"],
  ["float", "Flotar"],
  ["pulse", "Pulso"]
] as const;
const glowColorOptions = [
  ["#f4d27a", "Dorado"],
  ["#ffffff", "Blanco"],
  ["#f7a8c8", "Rosa"],
  ["#8fc7ff", "Azul"],
  ["#b18cff", "Violeta"],
  ["#ff6b6b", "Rojo"],
  ["#78d98b", "Verde"],
  ["custom", "Personalizado"]
] as const;

const wizardSteps = [
  { id: "datos", label: "Datos" },
  { id: "diseno", label: "Diseño" },
  { id: "contenido", label: "Contenido" },
  { id: "multimedia", label: "Multimedia" },
  { id: "rsvp", label: "RSVP" },
  { id: "avanzado", label: "Avanzado" }
] as const;

type WizardStepId = (typeof wizardSteps)[number]["id"];

export function EventForm({
  action,
  event,
  clients = [],
  businessClients = [],
  categories = [],
  themes = [],
  showOwner = false
}: EventFormProps) {
  const shouldShowOwnerSelect = showOwner && clients.length > 0;
  const designConfig = normalizeInvitationDesignConfig({ designConfig: event?.design_config ?? undefined });
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeToast, setThemeToast] = useState("");
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [coverToast, setCoverToast] = useState("");
  const [isSavingMusic, setIsSavingMusic] = useState(false);
  const [musicToast, setMusicToast] = useState("");
  const [isSavingVisualDecorations, setIsSavingVisualDecorations] = useState(false);
  const [visualDecorationToast, setVisualDecorationToast] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(event?.category_id ?? null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(event?.theme_id ?? null);
  const [visualDecorations, setVisualDecorations] = useState<VisualDecoration[]>(() => normalizeVisualDecorationState(event?.visual_decorations));
  const [activeDecorationDevice, setActiveDecorationDevice] = useState<VisualDecorationDevice>("desktop");
  const [activeStep, setActiveStep] = useState<WizardStepId>("datos");
  const [draftToast, setDraftToast] = useState("");
  const finalSubmitIntentRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const activeCategories = categories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const activeThemes = themes.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const filteredThemes = selectedCategoryId
    ? activeThemes.filter((t) => t.category_id === selectedCategoryId)
    : activeThemes;
  const activeDeviceDecorations = visualDecorations.filter((decoration) => decoration.device === activeDecorationDevice);
  const activeStepIndex = wizardSteps.findIndex((step) => step.id === activeStep);
  const isLastStep = activeStepIndex === wizardSteps.length - 1;
  const isEditing = Boolean(event?.id);
  const shouldShowExternalPhotoAlbum = eventHasFeature(event, "external_photo_album");
  const currentTheme = activeThemes.find((theme) => theme.id === selectedThemeId);

  function goToStep(step: WizardStepId) {
    setActiveStep(step);
    window.requestAnimationFrame(() => {
      document.getElementById("event-form-wizard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goNext() {
    const nextStep = wizardSteps[Math.min(activeStepIndex + 1, wizardSteps.length - 1)];
    goToStep(nextStep.id);
  }

  function goBack() {
    const previousStep = wizardSteps[Math.max(activeStepIndex - 1, 0)];
    goToStep(previousStep.id);
  }

  function saveDraft() {
    const form = formRef.current;
    if (!form) return;
    setInputValue(form, "status", "borrador");
    setDraftToast("Borrador preparado.");
    window.setTimeout(() => setDraftToast(""), 3200);
  }

  function requestFinalSubmit() {
    finalSubmitIntentRef.current = true;
    formRef.current?.requestSubmit();
  }

  function handleThemeSelect(theme: InvitationTheme) {
    setSelectedThemeId(theme.id);
    const form = formRef.current;
    if (!form) return;

    const config = applyThemeToDesignConfig(theme);
    if (config.fontPreset) setInputValue(form, "design_font_preset", config.fontPreset);
    if (config.backgroundVariant) setInputValue(form, "design_background_variant", config.backgroundVariant);
    if (config.animationPreset) setInputValue(form, "design_animation_preset", config.animationPreset);
    if (config.decorationLevel) setInputValue(form, "design_decoration_level", config.decorationLevel);
    if (config.decorationPreset) setInputValue(form, "design_decoration_preset", config.decorationPreset);
  }

  function addVisualDecoration(device: VisualDecorationDevice) {
    setVisualDecorations((current) => [
      ...current,
      {
        id: createDecorationId(),
        url: "",
        section: "info",
        device,
        x: 6,
        y: 12,
        width: device === "mobile" ? 110 : 220,
        height: null,
        opacity: 0.85,
        rotate: 0,
        effect: "none",
        glowColor: "#f4d27a",
        glowStrength: "medium",
        fitMode: "manual" as const
      }
    ]);
    setActiveDecorationDevice(device);
  }

  function updateVisualDecoration(id: string, patch: Partial<VisualDecoration>) {
    setVisualDecorations((current) => current.map((decoration) => decoration.id === id ? { ...decoration, ...patch } : decoration));
  }

  function removeVisualDecoration(id: string) {
    setVisualDecorations((current) => current.filter((decoration) => decoration.id !== id));
  }

  async function handleApplyThemeOnly() {
    const form = formRef.current;
    if (!form) return;

    if (!event?.id) {
      return;
    }

    setIsSavingTheme(true);
    setUploadError("");
    setThemeToast("");

    try {
      const result = await updateEventThemeOnly(event.id, {
        categoryId: getInputValue(form, "category_id"),
        themeId: getInputValue(form, "theme_id"),
        designConfig: getDesignConfigStateFromForm(form)
      });

      if (!result.ok) {
        throw new Error(result.error ?? "No se pudo aplicar el tema.");
      }

      setThemeToast("Tema aplicado");
      window.setTimeout(() => setThemeToast(""), 3200);
    } catch (saveError) {
      setUploadError(saveError instanceof Error ? saveError.message : "No se pudo aplicar el tema.");
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function handleSaveCoverOnly() {
    const form = formRef.current;
    if (!form) return;

    if (!event?.id) {
      return;
    }

    const error = validateCoverUploads(form);
    if (error) {
      setUploadError(error);
      return;
    }

    setIsSavingCover(true);
    setUploadError("");
    setCoverToast("");

    try {
      const coverPayload = await uploadCoverFilesToSupabase(form, setUploadStatus);
      const result = await updateEventCoverOnly(event.id, coverPayload);

      if (!result.ok) {
        throw new Error(result.error ?? "No se pudo guardar la portada.");
      }

      clearFileInput(form, "cover_image_file");
      clearFileInput(form, "mobile_cover_image_file");
      setCoverToast("Portada actualizada");
      window.setTimeout(() => setCoverToast(""), 3200);
    } catch (saveError) {
      setUploadError(saveError instanceof Error ? saveError.message : "No se pudo guardar la portada.");
    } finally {
      setIsSavingCover(false);
      setUploadStatus("");
    }
  }

  async function handleSaveMusicOnly() {
    const form = formRef.current;
    if (!form) return;

    if (!event?.id) {
      return;
    }

    const error = validateMusicUpload(form);
    if (error) {
      setUploadError(error);
      return;
    }

    setIsSavingMusic(true);
    setUploadError("");
    setMusicToast("");

    try {
      const musicUrl = await uploadMusicFileToSupabase(form, setUploadStatus);
      const result = await updateEventMusicOnly(event.id, musicUrl);

      if (!result.ok) {
        throw new Error(result.error ?? "No se pudo guardar la musica.");
      }

      clearFileInput(form, "music_file");
      setMusicToast("Musica actualizada");
      window.setTimeout(() => setMusicToast(""), 3200);
    } catch (saveError) {
      setUploadError(saveError instanceof Error ? saveError.message : "No se pudo guardar la musica.");
    } finally {
      setIsSavingMusic(false);
      setUploadStatus("");
    }
  }

  async function handleSaveVisualDecorationsOnly() {
    const form = formRef.current;
    if (!form) return;

    if (!event?.id) {
      return;
    }

    const error = validateVisualDecorationUploads(form);
    if (error) {
      setUploadError(error);
      return;
    }

    setIsSavingVisualDecorations(true);
    setUploadError("");
    setVisualDecorationToast("");

    try {
      const nextDecorations = await uploadVisualDecorationFilesToSupabase(form, setUploadStatus);
      const result = await saveVisualDecorationsOnly(event.id, nextDecorations);

      if (!result.ok) {
        throw new Error(result.error ?? "No se pudo guardar la decoracion libre.");
      }

      const savedDecorations = result.visualDecorations ?? nextDecorations;
      setVisualDecorations(savedDecorations);
      setInputValue(form, "visual_decorations", JSON.stringify(savedDecorations));
      savedDecorations.forEach((decoration) => clearFileInput(form, getVisualDecorationFileInputName(decoration.id)));
      setVisualDecorationToast("Decoracion actualizada");
      window.setTimeout(() => setVisualDecorationToast(""), 3200);
    } catch (saveError) {
      setUploadError(saveError instanceof Error ? saveError.message : "No se pudo guardar la decoracion libre.");
    } finally {
      setIsSavingVisualDecorations(false);
      setUploadStatus("");
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-6"
      onSubmit={(submitEvent) => {
        if (!finalSubmitIntentRef.current) {
          submitEvent.preventDefault();
          setUploadError("");
          return;
        }

        setUploadError("");
        setIsFinalSubmitting(true);
      }}
    >
      {uploadError ? (
        <div id="event-form-upload-error" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {uploadError}
        </div>
      ) : null}
      {uploadStatus ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {uploadStatus}
        </div>
      ) : null}

      <input type="hidden" name="template_id" value={event?.template_id ?? ""} />
      <input type="hidden" name="theme_color" value={event?.theme_color ?? "#111827"} />
      <input type="hidden" name="category_id" value={selectedCategoryId ?? ""} />
      <input type="hidden" name="theme_id" value={selectedThemeId ?? ""} />
      <input type="hidden" name="visual_decorations" value={JSON.stringify(visualDecorations)} readOnly />

      <div id="event-form-wizard" className="rounded-3xl border border-[#eadfd2] bg-[#fffaf3] p-3 shadow-[0_22px_60px_rgba(74,23,36,0.07)]">
        <WizardStepNav activeStep={activeStep} onSelect={goToStep} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className={activeStep === "diseno" || activeStep === "avanzado" ? "hidden" : "grid gap-6"}>
          <div className={activeStep === "datos" ? "grid gap-6" : "hidden"}>
          <FormSection title="Datos principales" description="Información base para gestionar el evento.">
            <div className="grid gap-5 md:grid-cols-2">
              {shouldShowOwnerSelect ? (
                <Field label="Cliente interno">
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
                <div className="rounded-xl border border-[#eadfd2] bg-[#fbf7f0] p-4 text-sm text-muted-foreground md:col-span-2">
                  No hay clientes internos. El evento quedara asignado a KAIS.
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
                  <div className="rounded-xl border border-[#eadfd2] bg-[#fbf7f0] p-4 text-sm text-muted-foreground">
                    No hay clientes registrados. El evento quedara asignado a KAIS.
                  </div>
                )}
              </Field>

              <Field label="Titulo">
                <Input name="title" defaultValue={event?.title} placeholder="Boda de Ana y Luis" required />
              </Field>

              <Field label="Enlace corto" hint="Solo minusculas, numeros y guiones. Ejemplo: maria15">
                <Input name="slug" defaultValue={event?.slug ?? ""} placeholder="maria15" pattern="[a-z0-9-]+" />
              </Field>

              <Field label="Estado">
                <Select name="status" defaultValue={event?.status ?? "borrador"}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
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
          </FormSection>

          <FormSection title="Celebración" description="Fecha, lugar y datos prácticos para los invitados.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Nombres de anfitriones">
                <Input name="hosts_names" defaultValue={event?.hosts_names} placeholder="Ana & Luis" required />
              </Field>

              <Field label="Fecha">
                <Input name="event_date" type="date" defaultValue={event?.event_date} required />
              </Field>

              <Field label="Hora">
                <Input name="event_time" type="time" defaultValue={event?.event_time} required />
              </Field>

              <div className="md:col-span-2">
                <Field label="Direccion">
                  <Input name="address" defaultValue={event?.address} placeholder="Salon, ciudad, pais" required />
                </Field>
              </div>

              <Field label="Google Maps">
                <Input name="google_maps_link" defaultValue={event?.google_maps_link ?? ""} placeholder="https://maps.google.com/..." />
              </Field>
              <Field label="WhatsApp para RSVP" hint="Solo el numero local de Paraguay. Se guardara automaticamente con prefijo 595.">
                <div className="flex overflow-hidden rounded-xl border border-[#e8d8c3] bg-white shadow-sm focus-within:border-[#7f1d35] focus-within:ring-2 focus-within:ring-[#7f1d35]/15">
                  <span className="inline-flex items-center border-r border-[#eadbcc] bg-[#f8f1e8] px-4 text-sm font-bold text-[#7f1d35]">
                    +595
                  </span>
                  <Input
                    name="whatsapp_phone"
                    defaultValue={formatParaguayWhatsappLocal(event?.whatsapp_phone)}
                    placeholder="981123456"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </Field>
            </div>
          </FormSection>
          </div>

          <div className={activeStep === "contenido" ? "grid gap-6" : "hidden"}>
          <FormSection title="Contenido" description="Texto emocional y detalles para los invitados.">
            <div className="grid gap-5">
              <Field label="Mensaje principal">
                <Textarea name="main_message" defaultValue={event?.main_message ?? ""} placeholder="Una frase especial para tus invitados" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Datos de quinceanios" description="Informacion opcional para invitaciones de 15 anos.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Nombre de la quinceanera">
                <Input name="quinceanera_name" defaultValue={event?.quinceanera_name ?? ""} placeholder="Paloma" />
              </Field>
              <Field label="Nombre de los padres">
                <Input name="parents_names" defaultValue={event?.parents_names ?? ""} placeholder="Junto a sus padres..." />
              </Field>
              <Field label="Lugar de la misa">
                <Input name="church_name" defaultValue={event?.church_name ?? ""} placeholder="Parroquia / iglesia" />
              </Field>
              <Field label="Hora de la misa">
                <Input name="church_time" type="time" defaultValue={event?.church_time ?? ""} />
              </Field>
              <Field label="Tenida">
                <Input name="dress_code" defaultValue={event?.dress_code ?? ""} placeholder="Elegante" />
              </Field>
              <Field label="Gama de colores">
                <Input name="color_palette" defaultValue={event?.color_palette ?? ""} placeholder="Rojo, dorado y crema" />
              </Field>
              <Field label="Tematica">
                <Input name="theme" defaultValue={event?.theme ?? ""} placeholder="Rosas rojas / romantico" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Mensaje de la quinceanera">
                  <Textarea name="quince_message" defaultValue={event?.quince_message ?? ""} placeholder="Un mensaje especial para tus invitados" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Mensaje de los padres">
                  <Textarea name="parents_message" defaultValue={event?.parents_message ?? ""} placeholder="Un mensaje de la familia" />
                </Field>
              </div>
            </div>
          </FormSection>
          </div>

          <div className={activeStep === "multimedia" ? "grid gap-6" : "hidden"}>
          <FormSection title="Multimedia" description="Portadas y música del evento.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="URL portada">
                <Input name="cover_image_url" defaultValue={event?.cover_image_url ?? ""} placeholder="https://..." />
              </Field>
              <Field label="Foto de portada" hint="JPG/PNG/WEBP maximo 5MB. Si pesa mas, comprime la imagen antes de subirla.">
                <Input name="cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
              </Field>
              <Field label="Portada movil" hint="JPG/PNG/WEBP maximo 5MB. Usa una imagen vertical y comprimida para mejor carga movil.">
                <Input name="mobile_cover_image_url" defaultValue={event?.mobile_cover_image_url ?? ""} placeholder="https://..." />
                <Input name="mobile_cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
              </Field>
              {event?.id ? (
                <div className="flex flex-col gap-3 md:col-span-2 md:items-end">
                  <Button type="button" variant="outline" className="w-full border-accent/40 sm:w-fit" disabled={isSavingCover} onClick={handleSaveCoverOnly}>
                    {isSavingCover ? "Guardando..." : "Guardar portada"}
                  </Button>
                  {coverToast ? (
                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800 sm:w-fit">
                      {coverToast}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="md:col-span-2">
                <Field label="Musica opcional" hint="MP3/WAV/OGG maximo 10MB. Si pesa mas, usa un enlace o comprime el audio.">
                  <Input name="music_url" defaultValue={event?.music_url ?? ""} placeholder="https://..." />
                  <Input name="music_file" type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" />
                </Field>
              </div>
              {shouldShowExternalPhotoAlbum ? (
                <div className="md:col-span-2">
                  <Field label="Album externo de fotos" hint="Para paquete Essential. Pega el enlace compartido de Google Fotos.">
                    <Input
                      name="external_photo_album_url"
                      type="url"
                      defaultValue={event?.external_photo_album_url ?? ""}
                      placeholder="https://photos.app.goo.gl/..."
                    />
                  </Field>
                </div>
              ) : null}
              {event?.id ? (
                <div className="flex flex-col gap-3 md:col-span-2 md:items-end">
                  <Button type="button" variant="outline" className="w-full border-accent/40 sm:w-fit" disabled={isSavingMusic} onClick={handleSaveMusicOnly}>
                    {isSavingMusic ? "Guardando..." : "Guardar música"}
                  </Button>
                  {musicToast ? (
                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800 sm:w-fit">
                      {musicToast}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </FormSection>
          </div>

          <div className={activeStep === "rsvp" ? "grid gap-6" : "hidden"}>
          <FormSection title="RSVP" description="Modo de confirmación para invitados.">
            <Field label="Modo de RSVP">
              <Select name="guest_mode" defaultValue={event?.guest_mode ?? "publico"}>
                {guestModes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </FormSection>
          </div>

        </div>

        <div className={activeStep === "diseno" || activeStep === "avanzado" ? "grid gap-6 xl:col-span-2" : "hidden"}>
          <div className={activeStep === "diseno" ? "grid gap-6" : "hidden"}>
          {(activeCategories.length > 0 || activeThemes.length > 0) ? (
            <FormSection title="Tema visual" description="Sistema visual principal. Reemplaza la seleccion antigua de plantilla.">
              {activeCategories.length > 0 ? (
                <div className="mb-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-all ${
                      !selectedCategoryId
                        ? "border-accent bg-accent text-accent-foreground shadow-sm"
                        : "border-[#eadfd2] bg-white text-muted-foreground hover:border-accent/50 hover:text-foreground"
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
                          : "border-[#eadfd2] bg-white text-muted-foreground hover:border-accent/50 hover:text-foreground"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              ) : null}

              {filteredThemes.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedThemeId(null)}
                    className={`group overflow-hidden rounded-2xl border-2 bg-white text-left transition-all focus:outline-none ${
                      !selectedThemeId ? "border-accent shadow-lg" : "border-[#eadfd2] hover:border-accent/50 hover:shadow-md"
                    }`}
                  >
                    <div className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[#fffaf3] to-[#eadfd2]">
                      <span className="select-none text-3xl font-display text-muted-foreground/35">Original</span>
                      {!selectedThemeId ? <SelectedBadge /> : null}
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-bold">Sin tema</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Diseno personalizado</p>
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
                        className={`group overflow-hidden rounded-2xl border-2 bg-white text-left transition-all focus:outline-none ${
                          isSelected ? "border-accent shadow-lg" : "border-[#eadfd2] hover:border-accent/50 hover:shadow-md"
                        }`}
                        style={isSelected ? { boxShadow: `0 8px 30px ${preview.accentColor}30` } : undefined}
                      >
                        <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden" style={{ background: preview.gradient }}>
                          {preview.shimmer ? <div className="pointer-events-none absolute inset-0" style={{ background: preview.shimmer }} /> : null}
                          <span
                            className="relative z-10 select-none text-5xl drop-shadow-xl transition-transform duration-300 group-hover:scale-110"
                            style={{ filter: `drop-shadow(0 0 8px ${preview.accentColor}88)` }}
                          >
                            {preview.icon}
                          </span>
                          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5">
                            <div className="h-px w-10 opacity-70" style={{ background: preview.accentColor }} />
                            <div className="h-px w-5 opacity-40" style={{ background: preview.accentColor }} />
                          </div>
                          {theme.is_premium ? (
                            <div
                              className="absolute right-2 top-2 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
                              style={{
                                background: `${preview.accentColor}22`,
                                color: preview.accentColor,
                                border: `1px solid ${preview.accentColor}55`,
                                backdropFilter: "blur(4px)"
                              }}
                            >
                              Premium
                            </div>
                          ) : null}
                          {isSelected ? <SelectedBadge /> : null}
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm font-bold leading-tight">{theme.name}</p>
                          {theme.description ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{theme.description}</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay temas disponibles para esta categoria.</p>
              )}
              {event?.id ? (
                <div className="mt-5 flex flex-col items-stretch gap-3 sm:items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-accent/40 sm:w-fit"
                    disabled={isSavingTheme}
                    onClick={handleApplyThemeOnly}
                  >
                    {isSavingTheme ? "Guardando..." : "Aplicar tema"}
                  </Button>
                  {themeToast ? (
                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800 sm:w-fit">
                      {themeToast}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </FormSection>
          ) : null}
          </div>

          <div className={activeStep === "avanzado" ? "grid gap-6" : "hidden"}>
          <FormSection title="Decoracion libre" description="Ubica ornamentos manualmente dentro de una seccion de la invitacion.">
            <div className="mb-5 rounded-xl border border-[#eadfd2] bg-[#fbf7f0] px-4 py-3 text-xs leading-5 text-muted-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Configura posiciones independientes para desktop y mobile.</span>
                <div className="flex flex-wrap gap-2">
                  {visualDecorationDevices.map(([device, label]) => (
                    <button
                      key={device}
                      type="button"
                      onClick={() => setActiveDecorationDevice(device)}
                      className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                        activeDecorationDevice === device
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-[#d8c7b5] bg-white text-muted-foreground hover:border-accent/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="border-accent/40 sm:w-fit" onClick={() => addVisualDecoration("desktop")}>
                  Agregar decoracion desktop
                </Button>
                <Button type="button" variant="outline" className="border-accent/40 sm:w-fit" onClick={() => addVisualDecoration("mobile")}>
                  Agregar decoracion mobile
                </Button>
              </div>
            </div>

            {activeDeviceDecorations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8c7b5] bg-white/70 p-6 text-center text-sm text-muted-foreground">
                No hay decoraciones para {activeDecorationDevice === "desktop" ? "desktop" : "mobile"}.
              </div>
            ) : (
              <div className="grid gap-4">
                {activeDeviceDecorations.map((decoration, index) => (
                  <FreeDecorationEditor
                    key={decoration.id}
                    decoration={decoration}
                    index={index}
                    onChange={(patch) => updateVisualDecoration(decoration.id, patch)}
                    onRemove={() => removeVisualDecoration(decoration.id)}
                  />
                ))}
              </div>
            )}

            {event?.id ? (
              <>
                <div className="mt-5 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-accent/40 sm:w-fit"
                    disabled={isSavingVisualDecorations}
                    onClick={handleSaveVisualDecorationsOnly}
                  >
                    {isSavingVisualDecorations ? "Guardando..." : "Guardar decoración libre"}
                  </Button>
                </div>
                {visualDecorationToast ? (
                  <div className="mt-4 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800 sm:ml-auto sm:w-fit">
                    {visualDecorationToast}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-[#eadfd2] bg-white/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
                La decoración se guardará junto con la invitación.
              </div>
            )}
          </FormSection>

          <details className="group rounded-2xl border border-[#eadfd2] bg-white p-5 shadow-[0_18px_45px_rgba(74,23,36,0.06)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Personalizacion avanzada (opcional)</p>
                <p className="mt-1 text-sm text-muted-foreground">Fuente, fondo, animacion y decoracion fina.</p>
              </div>
              <span className="rounded-full border border-[#eadfd2] px-3 py-1 text-xs font-semibold text-muted-foreground transition group-open:bg-[#fbf7f0]">
                Abrir
              </span>
            </summary>
            <div className="mt-5 border-t border-[#eadfd2] pt-5">
              <div className="mb-4 flex justify-end">
                <Button type="button" variant="outline" className="w-full border-accent/40 sm:w-fit" onClick={(e) => restoreDefaultDesign(e.currentTarget.form)}>
                  Restaurar diseno original
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fuente">
                  <Select name="design_font_preset" defaultValue={designConfig.fontPreset}>
                    <option value="default">Original</option>
                    <option value="romantic-script">Romantica</option>
                    <option value="luxury-serif">Luxury Serif</option>
                    <option value="royal-classic">Royal Classic</option>
                    <option value="modern-chic">Moderna Chic</option>
                  </Select>
                </Field>
                <Field label="Fondo">
                  <Select name="design_background_variant" defaultValue={designConfig.backgroundVariant}>
                    <option value="default">Original</option>
                    <option value="dark-roses">Rosas oscuras</option>
                    <option value="satin-red">Rojo satinado</option>
                    <option value="gold-glow">Brillo dorado</option>
                    <option value="romantic-floral">Floral romantico</option>
                  </Select>
                </Field>
                <Field label="Animacion">
                  <Select name="design_animation_preset" defaultValue={designConfig.animationPreset}>
                    <option value="none">Sin animacion</option>
                    <option value="soft-petals">Petalos suaves</option>
                    <option value="gold-sparkles">Brillos dorados</option>
                    <option value="elegant-glow">Glow elegante</option>
                  </Select>
                </Field>
                <Field label="Detalles decorativos">
                  <Select name="design_decoration_level" defaultValue={designConfig.decorationLevel}>
                    <option value="minimal">Original</option>
                    <option value="medium">Medio</option>
                    <option value="premium">Premium</option>
                  </Select>
                </Field>
                <Field label="Preset decorativo">
                  <Select name="design_decoration_preset" defaultValue={designConfig.decorationPreset ?? "none"}>
                    <option value="none">Sin decoracion</option>
                    <option value="luxury-gold">Luxury Gold</option>
                    <option value="floral-romance">Floral Romance</option>
                    <option value="royal-classic">Royal Classic</option>
                    <option value="minimal-chic">Minimal Chic</option>
                    <option value="kids-fantasy">Kids Fantasy</option>
                  </Select>
                </Field>
              </div>
            </div>
          </details>
          </div>
        </div>

        <EventSummaryPanel
          activeStep={activeStep}
          event={event}
          currentThemeName={currentTheme?.name}
          isHidden={activeStep === "diseno" || activeStep === "avanzado"}
        />
      </div>

      <WizardActions
        activeStepIndex={activeStepIndex}
        isLastStep={isLastStep}
        isEditing={isEditing}
        isFinalSubmitting={isFinalSubmitting}
        draftToast={draftToast}
        onBack={goBack}
        onNext={goNext}
        onSaveDraft={saveDraft}
        onFinalSubmit={requestFinalSubmit}
      />
    </form>
  );
}

function WizardStepNav({
  activeStep,
  onSelect
}: {
  activeStep: WizardStepId;
  onSelect: (step: WizardStepId) => void;
}) {
  return (
    <nav className="flex gap-2 overflow-x-auto p-1" aria-label="Pasos para crear evento">
      {wizardSteps.map((step, index) => {
        const isActive = step.id === activeStep;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              isActive
                ? "bg-[#5b1728] text-white shadow-[0_14px_34px_rgba(91,23,40,0.22)]"
                : "bg-white text-[#6f5a62] hover:bg-[#f7efe7] hover:text-[#3b1721]"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                isActive ? "bg-white/18 text-white" : "bg-[#f3e8dc] text-[#6d1f32]"
              }`}
            >
              {index + 1}
            </span>
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}

function EventSummaryPanel({
  activeStep,
  event,
  currentThemeName,
  isHidden
}: {
  activeStep: WizardStepId;
  event?: Event;
  currentThemeName?: string;
  isHidden: boolean;
}) {
  if (isHidden) return null;

  const stepLabel = wizardSteps.find((step) => step.id === activeStep)?.label ?? "Evento";

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-6 overflow-hidden rounded-3xl border border-[#eadfd2] bg-[#3b1721] text-white shadow-[0_24px_70px_rgba(74,23,36,0.18)]">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.22),transparent_32%),linear-gradient(135deg,#3b1721,#16080d)] p-6">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d4af37]">Resumen</p>
          <h3 className="mt-4 font-display text-3xl leading-tight">
            {event?.hosts_names || event?.title || "Nueva invitación"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Estás configurando el paso <span className="font-semibold text-white">{stepLabel}</span>.
          </p>
        </div>
        <div className="grid gap-3 border-t border-white/10 p-5 text-sm">
          <SummaryRow label="Estado" value={event?.status ?? "borrador"} />
          <SummaryRow label="Fecha" value={event?.event_date ?? "Pendiente"} />
          <SummaryRow label="Tema" value={currentThemeName ?? "Original"} />
          <SummaryRow label="Enlace" value={event?.slug ? `/e/${event.slug}` : "Se genera al guardar"} />
        </div>
        <div className="border-t border-white/10 bg-white/5 p-5 text-xs leading-5 text-white/58">
          Tip: completa lo esencial y guarda como borrador. Podrás volver a editar diseño, multimedia y decoración.
        </div>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
      <span className="text-white/46">{label}</span>
      <span className="truncate text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function WizardActions({
  activeStepIndex,
  isLastStep,
  isEditing,
  isFinalSubmitting,
  draftToast,
  onBack,
  onNext,
  onSaveDraft,
  onFinalSubmit
}: {
  activeStepIndex: number;
  isLastStep: boolean;
  isEditing: boolean;
  isFinalSubmitting: boolean;
  draftToast: string;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onFinalSubmit: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-[#eadfd2] bg-[#fffaf3]/95 px-4 py-4 backdrop-blur md:static md:mx-0 md:rounded-3xl md:border md:px-5">
      {draftToast ? (
        <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          {draftToast}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" className="border-[#d8c7b5]" disabled={activeStepIndex === 0} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {isEditing ? (
            <Button type="button" variant="ghost" className="text-[#6d1f32] hover:bg-[#f7efe7]" onClick={onSaveDraft}>
              Guardar borrador
            </Button>
          ) : null}
          {isEditing || isLastStep ? (
            <Button
              type="button"
              className="rounded-xl bg-[#5b1728] px-6 py-6 text-base text-white shadow-[0_16px_32px_rgba(74,23,36,0.18)] hover:bg-[#48111f]"
              disabled={isFinalSubmitting}
              onClick={onFinalSubmit}
            >
              <Save className="h-4 w-4" />
              {isFinalSubmitting
                ? isEditing
                  ? "Guardando cambios..."
                  : "Creando invitación..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear invitación"}
            </Button>
          ) : (
            <Button type="button" className="rounded-xl bg-[#5b1728] px-6 text-white hover:bg-[#48111f]" onClick={onNext}>
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FreeDecorationEditor({
  decoration,
  index,
  onChange,
  onRemove
}: {
  decoration: VisualDecoration;
  index: number;
  onChange: (patch: Partial<VisualDecoration>) => void;
  onRemove: () => void;
}) {
  const selectedPresetColor = glowColorOptions.some(([value]) => value === decoration.glowColor)
    ? decoration.glowColor
    : "custom";

  return (
    <div className="rounded-2xl border border-[#eadfd2] bg-[#fffaf3] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-xl border border-[#eadfd2] bg-[linear-gradient(45deg,#f7efe4_25%,transparent_25%),linear-gradient(-45deg,#f7efe4_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f7efe4_75%),linear-gradient(-45deg,transparent_75%,#f7efe4_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-4 lg:w-40">
          {decoration.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={decoration.url}
              alt=""
              className="max-h-28 max-w-full object-contain"
              style={{ opacity: decoration.opacity, transform: `rotate(${decoration.rotate}deg)` }}
            />
          ) : (
            <span className="text-center text-xs text-muted-foreground">Preview PNG/WebP</span>
          )}
        </div>

        <div className="grid flex-1 gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#3b1721]">Decoracion libre {index + 1}</p>
                <span className="rounded-full border border-[#d4af37]/30 bg-white px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#6d1f32]">
                  {decoration.device}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">PNG/WebP transparente, máximo 5MB.</p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full border border-[#d4af37]/35 px-3 py-1 text-xs font-semibold text-[#6d1f32] transition hover:bg-white"
            >
              Eliminar
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Imagen PNG/WebP">
              <Input name={getVisualDecorationFileInputName(decoration.id)} type="file" accept="image/png,image/webp" />
              {decoration.url ? (
                <Input
                  className="mt-2"
                  value={decoration.url}
                  onChange={(event) => onChange({ url: event.currentTarget.value })}
                  placeholder="URL publica"
                />
              ) : null}
            </Field>

            <Field label="Seccion">
              <Select
                value={decoration.section}
                onChange={(event) => onChange({ section: event.currentTarget.value as VisualDecorationSection })}
              >
                {visualDecorationSections.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Ajuste de tamano">
              <Select
                value={decoration.fitMode ?? "manual"}
                onChange={(event) => onChange({ fitMode: event.currentTarget.value as VisualDecorationFitMode })}
              >
                <option value="manual">Tamano manual</option>
                <option value="section">Ajustar a seccion</option>
              </Select>
            </Field>

            {(decoration.fitMode ?? "manual") === "section" && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                La decoración cubrirá toda la sección automáticamente.
              </p>
            )}

            {(decoration.fitMode ?? "manual") === "manual" && (
              <>
                <RangeField label="Posicion X %" value={decoration.x} min={0} max={100} step={1} onChange={(x) => onChange({ x })} />
                <RangeField label="Posicion Y %" value={decoration.y} min={0} max={100} step={1} onChange={(y) => onChange({ y })} />
                <RangeField label="Ancho px" value={decoration.width} min={40} max={2000} step={10} onChange={(width) => onChange({ width })} />
                <RangeField
                  label={`Alto px${!decoration.height ? " (auto)" : ""}`}
                  value={decoration.height ?? decoration.width}
                  min={40}
                  max={2000}
                  step={10}
                  onChange={(height) => onChange({ height })}
                />
                {decoration.height != null && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => onChange({ height: null })}
                  >
                    Restablecer alto automatico
                  </button>
                )}
              </>
            )}
            <RangeField label="Opacidad" value={decoration.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onChange({ opacity })} />
            <RangeField label="Rotacion" value={decoration.rotate} min={-180} max={180} step={1} onChange={(rotate) => onChange({ rotate })} />
            <Field label="Efecto">
              <Select
                value={decoration.effect}
                onChange={(event) => onChange({ effect: event.currentTarget.value as VisualDecoration["effect"] })}
              >
                {decorationEffects.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Color glow">
              <Select
                value={selectedPresetColor}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  onChange({ glowColor: value === "custom" ? "#f4d27b" : value });
                }}
              >
                {glowColorOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {selectedPresetColor === "custom" ? (
                <Input
                  className="mt-2 h-11"
                  type="color"
                  value={decoration.glowColor}
                  onChange={(event) => onChange({ glowColor: event.currentTarget.value })}
                />
              ) : null}
            </Field>
            <Field label="Intensidad glow">
              <Select
                value={decoration.glowStrength}
                onChange={(event) => onChange({ glowStrength: event.currentTarget.value as VisualDecoration["glowStrength"] })}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </Select>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        <span className="font-mono text-[0.68rem] text-[#6d1f32]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="accent-[#6d1f32]"
      />
    </label>
  );
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#eadfd2] bg-white p-5 shadow-[0_18px_45px_rgba(74,23,36,0.06)]">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SelectedBadge() {
  return (
    <div className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow">
      <svg viewBox="0 0 8 8" className="h-3 w-3 text-accent-foreground" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="1,4 3,6 7,2" />
      </svg>
    </div>
  );
}

function formatParaguayWhatsappLocal(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("595")) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);

  return digits;
}

function validateUploads(form: HTMLFormElement) {
  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  const musicFile = getFile(form, "music_file");
  const freeDecorationFiles = getVisualDecorationFiles(form);
  const files = [
    coverFile,
    mobileCoverFile,
    musicFile,
    ...freeDecorationFiles.map((item) => item.file)
  ].filter(Boolean) as File[];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const coverError = validateFile(coverFile, "La portada desktop", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (coverError) return coverError;

  const mobileCoverError = validateFile(mobileCoverFile, "La portada movil", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (mobileCoverError) return mobileCoverError;

  const musicError = validateFile(musicFile, "La musica", MAX_AUDIO_FILE_SIZE, ALLOWED_AUDIO_EXTENSIONS);
  if (musicError) return musicError;

  for (const { file, label } of freeDecorationFiles) {
    const decorationError = validateFile(file, label, MAX_DECORATION_FILE_SIZE, ALLOWED_DECORATION_EXTENSIONS);
    if (decorationError) return decorationError;
  }

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
    return "Los archivos seleccionados no deben superar 20MB en total. Comprime imagenes/audio o sube menos archivos a la vez.";
  }

  return "";
}

function validateCoverUploads(form: HTMLFormElement) {
  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  const totalSize = [coverFile, mobileCoverFile].filter(Boolean).reduce((sum, file) => sum + (file?.size ?? 0), 0);

  const coverError = validateFile(coverFile, "La portada desktop", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (coverError) return coverError;

  const mobileCoverError = validateFile(mobileCoverFile, "La portada movil", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (mobileCoverError) return mobileCoverError;

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
    return "Las portadas seleccionadas no deben superar 20MB en total.";
  }

  return "";
}

function validateMusicUpload(form: HTMLFormElement) {
  return validateFile(getFile(form, "music_file"), "La musica", MAX_AUDIO_FILE_SIZE, ALLOWED_AUDIO_EXTENSIONS);
}

function validateVisualDecorationUploads(form: HTMLFormElement) {
  const freeDecorationFiles = getVisualDecorationFiles(form);
  const totalSize = freeDecorationFiles.reduce((sum, item) => sum + item.file.size, 0);

  for (const { file, label } of freeDecorationFiles) {
    const decorationError = validateFile(file, label, MAX_DECORATION_FILE_SIZE, ALLOWED_DECORATION_EXTENSIONS);
    if (decorationError) return decorationError;
  }

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
    return "Las decoraciones seleccionadas no deben superar 20MB en total.";
  }

  return "";
}

function getFile(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement && input.files?.[0] ? input.files[0] : null;
}

function hasPendingUploads(form: HTMLFormElement) {
  return Boolean(
    getFile(form, "cover_image_file") ||
    getFile(form, "mobile_cover_image_file") ||
    getFile(form, "music_file") ||
    getVisualDecorationFiles(form).length > 0
  );
}

function restoreDefaultDesign(form: HTMLFormElement | null) {
  if (!form) return;
  setInputValue(form, "design_font_preset", DEFAULT_INVITATION_DESIGN_CONFIG.fontPreset);
  setInputValue(form, "design_background_variant", DEFAULT_INVITATION_DESIGN_CONFIG.backgroundVariant);
  setInputValue(form, "design_animation_preset", DEFAULT_INVITATION_DESIGN_CONFIG.animationPreset);
  setInputValue(form, "design_decoration_level", DEFAULT_INVITATION_DESIGN_CONFIG.decorationLevel);
  setInputValue(form, "design_decoration_preset", DEFAULT_INVITATION_DESIGN_CONFIG.decorationPreset);
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
    throw new Error("Tu sesion expiro. Inicia sesion nuevamente antes de subir archivos.");
  }

  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  const musicFile = getFile(form, "music_file");
  const freeDecorationFiles = getVisualDecorationFiles(form);

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
    setStatus("Subiendo portada movil a Supabase Storage...");
    const publicUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: mobileCoverFile,
      path: `covers/direct/${user.id}/mobile/${crypto.randomUUID()}-${sanitizeFileName(mobileCoverFile.name)}`,
      contentType: mobileCoverFile.type || getImageContentType(mobileCoverFile.name)
    });
    setInputValue(form, "mobile_cover_image_url", publicUrl);
  }

  if (musicFile) {
    setStatus("Subiendo musica a Supabase Storage...");
    const extension = getExtension(musicFile.name);
    const publicUrl = await uploadPublicFile({
      bucket: "event-audio",
      file: musicFile,
      path: `${user.id}/${crypto.randomUUID()}${extension}`,
      contentType: musicFile.type || getAudioContentType(extension)
    });
    setInputValue(form, "music_url", publicUrl);
  }

  if (freeDecorationFiles.length > 0) {
    const visualDecorations = getVisualDecorationStateFromForm(form);

    for (const { id, file, label } of freeDecorationFiles) {
      setStatus(`Subiendo decoracion libre: ${label}...`);
      const publicUrl = await uploadPublicFile({
        bucket: "event-photos",
        file,
        path: `decorations/free/${user.id}/${id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`,
        contentType: file.type || getDecorationContentType(file.name)
      });

      const target = visualDecorations.find((decoration) => decoration.id === id);
      if (target) target.url = publicUrl;
    }

    setInputValue(form, "visual_decorations", JSON.stringify(visualDecorations));
  }
}

async function uploadCoverFilesToSupabase(form: HTMLFormElement, setStatus: (status: string) => void) {
  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  let coverImageUrl = getInputValue(form, "cover_image_url");
  let mobileCoverImageUrl = getInputValue(form, "mobile_cover_image_url");

  if (!coverFile && !mobileCoverFile) {
    return { coverImageUrl, mobileCoverImageUrl };
  }

  const userId = await getCurrentUploadUserId();

  if (coverFile) {
    setStatus("Subiendo portada desktop a Supabase Storage...");
    coverImageUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: coverFile,
      path: `covers/direct/${userId}/${crypto.randomUUID()}-${sanitizeFileName(coverFile.name)}`,
      contentType: coverFile.type || getImageContentType(coverFile.name)
    });
    setInputValue(form, "cover_image_url", coverImageUrl);
  }

  if (mobileCoverFile) {
    setStatus("Subiendo portada movil a Supabase Storage...");
    mobileCoverImageUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: mobileCoverFile,
      path: `covers/direct/${userId}/mobile/${crypto.randomUUID()}-${sanitizeFileName(mobileCoverFile.name)}`,
      contentType: mobileCoverFile.type || getImageContentType(mobileCoverFile.name)
    });
    setInputValue(form, "mobile_cover_image_url", mobileCoverImageUrl);
  }

  return { coverImageUrl, mobileCoverImageUrl };
}

async function uploadMusicFileToSupabase(form: HTMLFormElement, setStatus: (status: string) => void) {
  const musicFile = getFile(form, "music_file");
  let musicUrl = getInputValue(form, "music_url");

  if (!musicFile) {
    return musicUrl;
  }

  const userId = await getCurrentUploadUserId();
  setStatus("Subiendo musica a Supabase Storage...");
  const extension = getExtension(musicFile.name);
  musicUrl = await uploadPublicFile({
    bucket: "event-audio",
    file: musicFile,
    path: `${userId}/${crypto.randomUUID()}${extension}`,
    contentType: musicFile.type || getAudioContentType(extension)
  });
  setInputValue(form, "music_url", musicUrl);
  return musicUrl;
}

async function uploadVisualDecorationFilesToSupabase(form: HTMLFormElement, setStatus: (status: string) => void) {
  const freeDecorationFiles = getVisualDecorationFiles(form);
  const visualDecorations = getVisualDecorationStateFromForm(form);

  if (freeDecorationFiles.length === 0) {
    return visualDecorations.filter((decoration) => decoration.url);
  }

  const userId = await getCurrentUploadUserId();

  for (const { id, file, label } of freeDecorationFiles) {
    setStatus(`Subiendo decoracion libre: ${label}...`);
    const publicUrl = await uploadPublicFile({
      bucket: "event-photos",
      file,
      path: `decorations/free/${userId}/${id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`,
      contentType: file.type || getDecorationContentType(file.name)
    });

    const target = visualDecorations.find((decoration) => decoration.id === id);
    if (target) target.url = publicUrl;
  }

  const updatedDecorations = visualDecorations.filter((decoration) => decoration.url);
  setInputValue(form, "visual_decorations", JSON.stringify(updatedDecorations));
  return updatedDecorations;
}

async function getCurrentUploadUserId() {
  const { client: supabase, error: envError } = createClientSupabaseBrowser();

  if (!supabase) {
    throw new Error(envError ?? "No se pudo inicializar Supabase para subir archivos.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Tu sesion expiro. Inicia sesion nuevamente antes de subir archivos.");
  }

  return user.id;
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

function getInputValue(form: HTMLFormElement, name: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim();
  }
  return "";
}

function getDesignConfigStateFromForm(form: HTMLFormElement): Partial<InvitationDesignConfig> {
  return normalizeInvitationDesignConfig({
    designConfig: {
      fontPreset: getInputValue(form, "design_font_preset"),
      backgroundVariant: getInputValue(form, "design_background_variant"),
      animationPreset: getInputValue(form, "design_animation_preset"),
      decorationLevel: getInputValue(form, "design_decoration_level"),
      decorationPreset: getInputValue(form, "design_decoration_preset")
    } as Partial<InvitationDesignConfig>
  });
}

function clearFileInput(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement) {
    input.value = "";
  }
}

function getVisualDecorationFiles(form: HTMLFormElement) {
  return getVisualDecorationStateFromForm(form).flatMap((decoration, index) => {
    const file = getFile(form, getVisualDecorationFileInputName(decoration.id));
    return file ? [{ id: decoration.id, label: `Decoracion libre ${index + 1}`, file }] : [];
  });
}

function getVisualDecorationStateFromForm(form: HTMLFormElement): VisualDecoration[] {
  const input = form.elements.namedItem("visual_decorations");
  const raw = input instanceof HTMLInputElement ? input.value : "[]";

  try {
    const parsed = JSON.parse(raw);
    return normalizeVisualDecorationState(parsed);
  } catch {
    return [];
  }
}

function normalizeVisualDecorationState(value: unknown): VisualDecoration[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const base = {
      id: normalizeString(record.id, `decor-${index + 1}`),
      url: normalizeString(record.url, ""),
      section: normalizeSection(record.section),
      x: clampNumber(record.x, 0, 100, 6),
      y: clampNumber(record.y, 0, 100, 12),
      opacity: clampNumber(record.opacity, 0, 1, 0.85),
      rotate: clampNumber(record.rotate, -180, 180, 0)
    };
    const effect = normalizeDecorationEffect(record.effect);
    const glowColor = normalizeGlowColor(record.glowColor);
    const glowStrength = normalizeGlowStrength(record.glowStrength);

    const fitMode: VisualDecorationFitMode = record.fitMode === "section" ? "section" : "manual";

    const height = record.height != null ? clampNumber(record.height, 40, 2000, 220) : null;

    if (record.device === "desktop" || record.device === "mobile") {
      const device = record.device;
      return [{
        ...base,
        device,
        width: clampNumber(record.width, 40, 2000, device === "mobile" ? 110 : 220),
        height,
        effect,
        glowColor,
        glowStrength,
        fitMode
      }];
    }

    const legacyDesktop = record.desktop !== false;
    const legacyMobile = record.mobile === true;
    const devices: VisualDecorationDevice[] = legacyMobile && !legacyDesktop
      ? ["mobile"]
      : legacyMobile && legacyDesktop
        ? ["desktop", "mobile"]
        : ["desktop"];

    return devices.map((device) => ({
      ...base,
      id: devices.length > 1 ? `${base.id}-${device}` : base.id,
      device,
      width: clampNumber(record.width, 40, 2000, device === "mobile" ? 110 : 220),
      height,
      effect,
      glowColor,
      glowStrength,
      fitMode
    }));
  });
}

function getVisualDecorationFileInputName(id: string) {
  return `visual_decoration_file_${id}`;
}

function createDecorationId() {
  return `decor-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
}

function normalizeSection(value: unknown): VisualDecorationSection {
  return visualDecorationSections.some(([section]) => section === value) ? value as VisualDecorationSection : "info";
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function normalizeDecorationEffect(value: unknown): VisualDecoration["effect"] {
  if (value === "golden_glow") return "glow";
  return decorationEffects.some(([effect]) => effect === value) ? value as VisualDecoration["effect"] : "none";
}

function normalizeGlowStrength(value: unknown): VisualDecoration["glowStrength"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeGlowColor(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#f4d27a";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
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

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function getImageContentType(fileName: string) {
  const extension = getExtension(fileName);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  return "image/webp";
}

function getDecorationContentType(fileName: string) {
  return getExtension(fileName) === ".png" ? "image/png" : "image/webp";
}

function getAudioContentType(extension: string) {
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  return "audio/ogg";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
