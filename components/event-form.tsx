"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateEventCoverOnly, updateEventMusicOnly } from "@/app/actions/events";
import { eventHasFeature } from "@/lib/event-features";
import { createClientSupabaseBrowser } from "@/lib/supabase/browser";
import type { Client, Event, EventCategory, InvitationTheme, Profile, VisualDecoration, VisualDecorationDevice, VisualDecorationFitMode, VisualDecorationSection } from "@/lib/types";

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
const decorationEffects = [
  ["none", "Sin efecto"],
  ["glow", "Glow"],
  ["soft_shadow", "Sombra suave"],
  ["float", "Flotar"],
  ["pulse", "Pulso"]
] as const;
const wizardSteps = [
  { id: "datos",      label: "Datos" },
  { id: "contenido",  label: "Contenido" },
  { id: "multimedia", label: "Multimedia" },
  { id: "rsvp",       label: "RSVP" },
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
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [coverToast, setCoverToast] = useState("");
  const [isSavingMusic, setIsSavingMusic] = useState(false);
  const [musicToast, setMusicToast] = useState("");
  const [activeStep, setActiveStep] = useState<WizardStepId>("datos");
  const [draftToast, setDraftToast] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>(event?.event_type ?? "boda");
  const finalSubmitIntentRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const activeStepIndex = wizardSteps.findIndex((step) => step.id === activeStep);
  const isLastStep = activeStepIndex === wizardSteps.length - 1;
  const isEditing = Boolean(event?.id);
  const shouldShowExternalPhotoAlbum = eventHasFeature(event, "external_photo_album");
  const normalizedEventType = normalizeEventType(selectedEventType);
  const showQuinceaniosFields = ["quinceanios", "quinceanos", "quinceanera", "15 anos"].includes(normalizedEventType);
  const showGraduationFields = ["graduacion", "graduation"].includes(normalizedEventType);

  function goToStep(step: WizardStepId) {
    setActiveStep(step);
    window.requestAnimationFrame(() => {
      document.getElementById("event-form-wizard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goNext() {
    const clampedIndex = Math.min(Math.max(activeStepIndex, 0) + 1, wizardSteps.length - 1);
    const nextStep = wizardSteps[clampedIndex];
    if (nextStep) goToStep(nextStep.id);
  }

  function goBack() {
    const clampedIndex = Math.max(Math.min(activeStepIndex, wizardSteps.length - 1) - 1, 0);
    const previousStep = wizardSteps[clampedIndex];
    if (previousStep) goToStep(previousStep.id);
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

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
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

      {/* Preserve small functional fields so saves don't accidentally clear them */}
      <input type="hidden" name="template_id"  value={event?.template_id ?? ""} />
      <input type="hidden" name="theme_color"  value={event?.theme_color ?? "#111827"} />
      <input type="hidden" name="category_id"  value={event?.category_id ?? ""} />
      <input type="hidden" name="theme_id"     value={event?.theme_id ?? ""} />
      {/* visual_decorations intentionally excluded — managed by V3 canvas, not this wizard */}

      <div id="event-form-wizard" className="rounded-3xl border border-[#eadfd2] bg-[#fffaf3] p-3 shadow-[0_22px_60px_rgba(74,23,36,0.07)]">
        <WizardStepNav activeStep={activeStep} onSelect={goToStep} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid gap-6">
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
                <Select name="event_type" value={selectedEventType} onChange={(changeEvent) => setSelectedEventType(changeEvent.target.value)}>
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

          <div className={showQuinceaniosFields ? "grid" : "hidden"}>
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

          <div className={showGraduationFields ? "grid" : "hidden"}>
          <FormSection title="Datos de graduacion" description="Informacion opcional para invitaciones de graduacion.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Nombre del graduado">
                <Input name="graduate_name" defaultValue={event?.graduate_name ?? ""} placeholder="Sofia Martinez" />
              </Field>
              <Field label="Tipo de graduacion">
                <Select name="graduation_type" defaultValue={event?.graduation_type ?? ""}>
                  <option value="">Seleccionar tipo</option>
                  <option value="high_school">Secundaria</option>
                  <option value="university">Universitaria</option>
                  <option value="technical">Tecnica</option>
                  <option value="kindergarten">Jardin / Kinder</option>
                  <option value="primary">Primaria</option>
                  <option value="postgraduate">Postgrado</option>
                  <option value="course">Curso</option>
                  <option value="general">General</option>
                </Select>
              </Field>
              <Field label="Institucion">
                <Input name="institution_name" defaultValue={event?.institution_name ?? ""} placeholder="Universidad / colegio" />
              </Field>
              <Field label="Carrera / programa">
                <Input name="academic_program" defaultValue={event?.academic_program ?? ""} placeholder="Arquitectura" />
              </Field>
              <Field label="Titulo obtenido">
                <Input name="degree_title" defaultValue={event?.degree_title ?? ""} placeholder="Licenciada en..." />
              </Field>
              <Field label="Promocion">
                <Input name="promotion_name" defaultValue={event?.promotion_name ?? ""} placeholder="Promocion 2026" />
              </Field>
              <Field label="Lugar del acto academico">
                <Input name="academic_ceremony_place" defaultValue={event?.academic_ceremony_place ?? ""} placeholder="Auditorio principal" />
              </Field>
              <Field label="Hora del acto academico">
                <Input name="academic_ceremony_time" type="time" defaultValue={event?.academic_ceremony_time ?? ""} />
              </Field>
              <Field label="Lugar de recepcion">
                <Input name="reception_place" defaultValue={event?.reception_place ?? ""} placeholder="Salon / residencia / club" />
              </Field>
              <Field label="Hora de recepcion">
                <Input name="reception_time" type="time" defaultValue={event?.reception_time ?? ""} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Mensaje del graduado">
                  <Textarea name="graduate_message" defaultValue={event?.graduate_message ?? ""} placeholder="Un mensaje especial para compartir este logro" />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Mensaje familiar">
                  <Textarea name="family_message" defaultValue={event?.family_message ?? ""} placeholder="Un mensaje de la familia" />
                </Field>
              </div>
            </div>
          </FormSection>
          </div>
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

        <EventSummaryPanel
          activeStep={activeStep}
          event={event}
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
  event
}: {
  activeStep: WizardStepId;
  event?: Event;
}) {
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

function formatParaguayWhatsappLocal(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("595")) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);

  return digits;
}

function normalizeEventType(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
