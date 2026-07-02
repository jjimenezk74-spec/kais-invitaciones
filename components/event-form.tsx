"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { updateEventCoverOnly } from "@/app/actions/events";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { eventHasFeature } from "@/lib/event-features";
import type { Client, Event, EventCategory, InvitationTheme, Profile } from "@/lib/types";

type EventFormProps = {
  action: string | ((formData: FormData) => Promise<void> | void);
  event?: Event;
  clients?: Profile[];
  businessClients?: Client[];
  categories?: EventCategory[];
  themes?: InvitationTheme[];
  showOwner?: boolean;
};

const eventTypes = [
  ["boda", "Boda"],
  ["quinceaños", "Quinceaños"],
  ["graduación", "Graduación"],
  ["bautizo", "Bautizo"],
  ["baby shower", "Baby shower"],
  ["cumpleaños infantil", "Cumpleaños infantil"],
  ["cumpleaños", "Cumpleaños adulto/general"],
  ["corporativo", "Corporativo"],
  ["otro", "Otro"],
] as const;

const statuses = ["borrador", "publicado", "inactivo"] as const;
const guestModes = [
  ["publico", "Público"],
  ["lista_invitados", "Lista de invitados"],
] as const;

const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_SIZE = 20 * 1024 * 1024;
const ALLOWED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const baseWizardSteps = [
  { id: "datos", label: "Datos" },
  { id: "detalles", label: "Detalles" },
  { id: "mensajes", label: "Mensajes" },
  { id: "multimedia", label: "Multimedia" },
  { id: "rsvp", label: "RSVP" },
] as const;

type WizardStepId = (typeof baseWizardSteps)[number]["id"];
type WizardStep = { id: WizardStepId; label: string };
type EventKind =
  | "wedding"
  | "quinceanios"
  | "graduation"
  | "baptism"
  | "baby_shower"
  | "kids_birthday"
  | "birthday"
  | "corporate"
  | "other";

export function EventForm({
  action,
  event,
  clients = [],
  businessClients = [],
  categories = [],
  themes = [],
  showOwner = false,
}: EventFormProps) {
  void categories;
  void themes;

  const shouldShowOwnerSelect = showOwner && clients.length > 0;
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [coverToast, setCoverToast] = useState("");
  const [activeStep, setActiveStep] = useState<WizardStepId>("datos");
  const [draftToast, setDraftToast] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>(event?.event_type ?? "boda");
  const finalSubmitIntentRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const eventKind = useMemo(() => getEventKind(selectedEventType), [selectedEventType]);
  const shouldShowExternalPhotoAlbum = eventHasFeature(event, "external_photo_album");
  const activeWizardSteps = getWizardSteps();
  const activeStepIndex = Math.max(activeWizardSteps.findIndex((step) => step.id === activeStep), 0);
  const isLastStep = activeStepIndex === activeWizardSteps.length - 1;
  const isEditing = Boolean(event?.id);

  useEffect(() => {
    if (!activeWizardSteps.some((step) => step.id === activeStep)) {
      setActiveStep("datos");
    }
  }, [activeStep, activeWizardSteps]);

  function goToStep(step: WizardStepId) {
    if (activeWizardSteps.some((wizardStep) => wizardStep.id === step)) {
      setActiveStep(step);
    }
  }

  function goNext() {
    const clampedIndex = Math.min(Math.max(activeStepIndex, 0) + 1, activeWizardSteps.length - 1);
    const nextStep = activeWizardSteps[clampedIndex];
    if (nextStep) goToStep(nextStep.id);
  }

  function goBack() {
    const clampedIndex = Math.max(Math.min(activeStepIndex, activeWizardSteps.length - 1) - 1, 0);
    const previousStep = activeWizardSteps[clampedIndex];
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

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    const form = submitEvent.currentTarget;

    if (!finalSubmitIntentRef.current) {
      submitEvent.preventDefault();
      setUploadError("");
      return;
    }

    const error = validateCoverUploads(form);
    if (error) {
      submitEvent.preventDefault();
      finalSubmitIntentRef.current = false;
      setUploadError(error);
      return;
    }

    setUploadError("");
    setIsFinalSubmitting(true);

    if (typeof action !== "string") return;

    submitEvent.preventDefault();

    try {
      const response = await fetch(action, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "x-kais-fetch-action": "1",
        },
        redirect: "follow",
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          redirectTo?: string;
        } | null;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error ?? `No se pudo guardar el evento (${response.status}).`);
        }

        window.location.assign(result.redirectTo ?? "/dashboard");
        return;
      }

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      if (!response.ok) {
        throw new Error(`No se pudo guardar el evento (${response.status}).`);
      }

      window.location.assign("/dashboard");
    } catch (submitError) {
      setUploadError(submitError instanceof Error ? submitError.message : "No se pudo guardar el evento.");
      setIsFinalSubmitting(false);
      finalSubmitIntentRef.current = false;
    }
  }

  async function handleSaveCoverOnly() {
    const form = formRef.current;
    if (!form || !event?.id) return;

    const error = validateCoverUploads(form);
    if (error) {
      setUploadError(error);
      return;
    }

    setIsSavingCover(true);
    setUploadError("");
    setCoverToast("");

    try {
      const coverPayload = await uploadCoverFilesToCloudflare(form, setUploadStatus);
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

  return (
    <form
      ref={formRef}
      action={typeof action === "string" ? undefined : action}
      method="post"
      encType="multipart/form-data"
      noValidate
      className="grid min-h-0 gap-2 [&_input]:h-9 [&_select]:h-9 [&_textarea]:min-h-[4.25rem]"
      onSubmit={handleSubmit}
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
      <input type="hidden" name="category_id" value={event?.category_id ?? ""} />
      <input type="hidden" name="theme_id" value={event?.theme_id ?? ""} />
      <input type="hidden" name="cover_image_url" defaultValue={event?.cover_image_url ?? ""} />
      <input type="hidden" name="mobile_cover_image_url" defaultValue={event?.mobile_cover_image_url ?? ""} />
      <input type="hidden" name="music_url" defaultValue={event?.music_url ?? ""} />

      <div id="event-form-wizard" className="grid gap-2 rounded-2xl border border-[#eadfd2] bg-[#fffaf3] p-2 shadow-[0_16px_48px_-42px_rgba(74,23,36,0.65)] xl:grid-cols-[auto_minmax(360px,1fr)] xl:items-center">
        <WizardStepNav steps={activeWizardSteps} activeStep={activeStep} onSelect={goToStep} />
        <EventSummaryPanel activeStep={activeStep} event={event} selectedEventType={selectedEventType} />
      </div>

      <div className={activeStep === "datos" ? "grid gap-2" : "hidden"}>
        <FormSection title="Datos principales" description="Primero define el tipo de evento; el resto del formulario se ajusta a esa invitación.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Tipo de evento">
              <Select name="event_type" value={selectedEventType} onChange={(changeEvent) => setSelectedEventType(changeEvent.target.value)}>
                {eventTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

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
                <div className="flex h-9 items-center rounded-md border border-[#eadfd2] bg-[#fbf7f0] px-3 text-sm text-muted-foreground">
                  KAIS / sin cliente asociado
                </div>
              )}
            </Field>

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

            <Field label="Estado">
              <Select name="status" defaultValue={event?.status ?? "borrador"}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={getTitleLabel(eventKind)}>
              <Input name="title" defaultValue={event?.title} placeholder={getTitlePlaceholder(eventKind)} />
            </Field>

            <Field label={getHostsLabel(eventKind)}>
              <Input name="hosts_names" defaultValue={event?.hosts_names} placeholder={getHostsPlaceholder(eventKind)} />
            </Field>

            <Field label="Fecha">
              <Input name="event_date" type="date" defaultValue={event?.event_date} />
            </Field>

            <Field label="Hora">
              <Input name="event_time" type="time" defaultValue={event?.event_time} />
            </Field>

            <Field label="Enlace corto" hint="Solo minúsculas, números y guiones. Ejemplo: maria15">
              <Input name="slug" defaultValue={event?.slug ?? ""} placeholder="maria15" pattern="[a-z0-9-]+" />
            </Field>

            <Field label="WhatsApp RSVP" hint="Solo número local. Se guarda con prefijo 595.">
              <div className="flex h-9 overflow-hidden rounded-md border border-[#e8d8c3] bg-white shadow-sm focus-within:border-[#7f1d35] focus-within:ring-2 focus-within:ring-[#7f1d35]/15">
                <span className="inline-flex items-center border-r border-[#eadbcc] bg-[#f8f1e8] px-3 text-sm font-bold text-[#7f1d35]">
                  +595
                </span>
                <Input
                  name="whatsapp_phone"
                  defaultValue={formatParaguayWhatsappLocal(event?.whatsapp_phone)}
                  placeholder="981123456"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  className="h-full border-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </Field>

            <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_0.9fr] xl:col-span-2">
              <Field label={getAddressLabel(eventKind)}>
                <Input name="address" defaultValue={event?.address} placeholder={getAddressPlaceholder(eventKind)} />
              </Field>
              <Field label="Google Maps">
                <Input name="google_maps_link" defaultValue={event?.google_maps_link ?? ""} placeholder="https://maps.google.com/..." />
              </Field>
            </div>
          </div>

        </FormSection>
      </div>

      <div className={activeStep === "detalles" ? "grid gap-2" : "hidden"}>
        <FormSection title="Detalles del evento" description="Campos propios del tipo de evento y pistas visuales para KAIS Studio.">
          <EventSpecificFields event={event} kind={eventKind} />

          <div className="grid gap-3 md:grid-cols-3">
            <Field label={eventKind === "corporate" ? "Protocolo" : "Tenida"}>
              <Input name="dress_code" defaultValue={event?.dress_code ?? ""} placeholder={getDressPlaceholder(eventKind)} />
            </Field>
            <Field label="Gama de colores">
              <Input name="color_palette" defaultValue={event?.color_palette ?? ""} placeholder={getColorPlaceholder(eventKind)} />
            </Field>
            <Field label="Temática">
              <Input name="theme" defaultValue={event?.theme ?? ""} placeholder={getThemePlaceholder(eventKind)} />
            </Field>
          </div>
        </FormSection>
      </div>

      <div className={activeStep === "mensajes" ? "grid gap-2" : "hidden"}>
        <FormSection title="Mensajes" description="Solo textos emocionales o institucionales; los datos del evento ya se cargan en Datos.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label={getMainMessageLabel(eventKind)}>
                <Textarea name="main_message" defaultValue={event?.main_message ?? ""} placeholder={getMainMessagePlaceholder(eventKind)} />
              </Field>
            </div>

            <div className={eventKind === "quinceanios" ? "contents" : "hidden"}>
              <Field label="Mensaje de la quinceañera">
                <Textarea name="quince_message" defaultValue={event?.quince_message ?? ""} placeholder="Un mensaje personal para compartir esta noche." />
              </Field>
              <Field label="Mensaje de los padres">
                <Textarea name="parents_message" defaultValue={event?.parents_message ?? ""} placeholder="Un mensaje breve de la familia." />
              </Field>
            </div>

            <div className={eventKind === "graduation" ? "contents" : "hidden"}>
              <Field label="Mensaje del graduado">
                <Textarea name="graduate_message" defaultValue={event?.graduate_message ?? ""} placeholder="Un mensaje especial para compartir este logro." />
              </Field>
              <Field label="Mensaje familiar">
                <Textarea name="family_message" defaultValue={event?.family_message ?? ""} placeholder="Un mensaje de la familia." />
              </Field>
            </div>
          </div>
        </FormSection>
      </div>

      <div className={activeStep === "multimedia" ? "grid gap-2" : "hidden"}>
        <FormSection title="Multimedia" description="Solo carga de fotos. No usamos URLs manuales de imagen en este flujo.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Foto de portada" hint="JPG/PNG/WEBP máximo 5MB. Si pesa más, comprime la imagen antes de subirla.">
              <Input name="cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
            </Field>
            <Field label="Portada móvil" hint="JPG/PNG/WEBP máximo 5MB. Usa una imagen vertical y comprimida para mejor carga móvil.">
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
            {shouldShowExternalPhotoAlbum ? (
              <div className="md:col-span-2">
                <Field label="Álbum externo de fotos" hint="Para paquete Essential. Pega el enlace compartido de Google Fotos.">
                  <Input
                    name="external_photo_album_url"
                    type="url"
                    defaultValue={event?.external_photo_album_url ?? ""}
                    placeholder="https://photos.app.goo.gl/..."
                  />
                </Field>
              </div>
            ) : (
              <input type="hidden" name="external_photo_album_url" defaultValue={event?.external_photo_album_url ?? ""} />
            )}
          </div>
        </FormSection>
      </div>

      <div className={activeStep === "rsvp" ? "grid gap-2" : "hidden"}>
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

function EventSpecificFields({ event, kind }: { event?: Event; kind: EventKind }) {
  return (
    <>
      <div className={kind === "quinceanios" ? "grid gap-3 rounded-xl border border-[#eadfd2] bg-[#fffaf7] p-3 md:grid-cols-2 xl:grid-cols-4" : "hidden"}>
        <SectionIntro title="Datos de quinceaños" description="Nombre, familia y misa para construir una invitación de 15 años." />
        <Field label="Nombre de la quinceañera">
          <Input name="quinceanera_name" defaultValue={event?.quinceanera_name ?? ""} placeholder="Paloma" />
        </Field>
        <Field label="Nombre de los padres">
          <Input name="parents_names" defaultValue={event?.parents_names ?? ""} placeholder="Jorge & Patricia" />
        </Field>
        <Field label="Lugar de la misa">
          <Input name="church_name" defaultValue={event?.church_name ?? ""} placeholder="Parroquia / iglesia" />
        </Field>
        <Field label="Hora de la misa">
          <Input name="church_time" type="time" defaultValue={event?.church_time ?? ""} />
        </Field>
      </div>

      <div className={kind === "graduation" ? "grid gap-3 rounded-xl border border-[#eadfd2] bg-[#fffaf7] p-3 md:grid-cols-2 xl:grid-cols-4" : "hidden"}>
        <SectionIntro title="Datos de graduación" description="Información académica, acto y recepción." />
        <Field label="Nombre del graduado">
          <Input name="graduate_name" defaultValue={event?.graduate_name ?? ""} placeholder="Sofía Martínez" />
        </Field>
        <Field label="Tipo de graduación">
          <Select name="graduation_type" defaultValue={event?.graduation_type ?? ""}>
            <option value="">Seleccionar tipo</option>
            <option value="high_school">Secundaria</option>
            <option value="university">Universitaria</option>
            <option value="technical">Técnica</option>
            <option value="kindergarten">Jardín / Kinder</option>
            <option value="primary">Primaria</option>
            <option value="postgraduate">Postgrado</option>
            <option value="course">Curso</option>
            <option value="general">General</option>
          </Select>
        </Field>
        <Field label="Institución">
          <Input name="institution_name" defaultValue={event?.institution_name ?? ""} placeholder="Universidad / colegio" />
        </Field>
        <Field label="Carrera / programa">
          <Input name="academic_program" defaultValue={event?.academic_program ?? ""} placeholder="Arquitectura" />
        </Field>
        <Field label="Título obtenido">
          <Input name="degree_title" defaultValue={event?.degree_title ?? ""} placeholder="Licenciada en..." />
        </Field>
        <Field label="Promoción">
          <Input name="promotion_name" defaultValue={event?.promotion_name ?? ""} placeholder="Promoción 2026" />
        </Field>
        <Field label="Lugar del acto académico">
          <Input name="academic_ceremony_place" defaultValue={event?.academic_ceremony_place ?? ""} placeholder="Auditorio principal" />
        </Field>
        <Field label="Hora del acto académico">
          <Input name="academic_ceremony_time" type="time" defaultValue={event?.academic_ceremony_time ?? ""} />
        </Field>
        <Field label="Lugar de recepción">
          <Input name="reception_place" defaultValue={event?.reception_place ?? ""} placeholder="Salón / residencia / club" />
        </Field>
        <Field label="Hora de recepción">
          <Input name="reception_time" type="time" defaultValue={event?.reception_time ?? ""} />
        </Field>
      </div>

      {kind !== "quinceanios" && kind !== "graduation" ? <HiddenSpecificFields event={event} /> : null}
      {kind === "quinceanios" ? <HiddenGraduationFields event={event} /> : null}
      {kind === "graduation" ? <HiddenQuinceaniosFields event={event} /> : null}
    </>
  );
}

function HiddenSpecificFields({ event }: { event?: Event }) {
  return (
    <>
      <HiddenQuinceaniosFields event={event} />
      <HiddenGraduationFields event={event} />
    </>
  );
}

function HiddenQuinceaniosFields({ event }: { event?: Event }) {
  return (
    <div className="hidden">
      <input name="quinceanera_name" defaultValue={event?.quinceanera_name ?? ""} />
      <input name="parents_names" defaultValue={event?.parents_names ?? ""} />
      <input name="church_name" defaultValue={event?.church_name ?? ""} />
      <input name="church_time" defaultValue={event?.church_time ?? ""} />
      <textarea name="quince_message" defaultValue={event?.quince_message ?? ""} />
      <textarea name="parents_message" defaultValue={event?.parents_message ?? ""} />
    </div>
  );
}

function HiddenGraduationFields({ event }: { event?: Event }) {
  return (
    <div className="hidden">
      <input name="graduate_name" defaultValue={event?.graduate_name ?? ""} />
      <input name="graduation_type" defaultValue={event?.graduation_type ?? ""} />
      <input name="institution_name" defaultValue={event?.institution_name ?? ""} />
      <input name="academic_program" defaultValue={event?.academic_program ?? ""} />
      <input name="degree_title" defaultValue={event?.degree_title ?? ""} />
      <input name="promotion_name" defaultValue={event?.promotion_name ?? ""} />
      <input name="academic_ceremony_place" defaultValue={event?.academic_ceremony_place ?? ""} />
      <input name="academic_ceremony_time" defaultValue={event?.academic_ceremony_time ?? ""} />
      <input name="reception_place" defaultValue={event?.reception_place ?? ""} />
      <input name="reception_time" defaultValue={event?.reception_time ?? ""} />
      <textarea name="family_message" defaultValue={event?.family_message ?? ""} />
      <textarea name="graduate_message" defaultValue={event?.graduate_message ?? ""} />
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="md:col-span-2 xl:col-span-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function WizardStepNav({
  steps,
  activeStep,
  onSelect,
}: {
  steps: WizardStep[];
  activeStep: WizardStepId;
  onSelect: (step: WizardStepId) => void;
}) {
  return (
    <nav className="flex min-w-0 flex-wrap gap-2 overflow-visible p-1" aria-label="Pasos para crear evento">
      {steps.map((step, index) => {
        const isActive = step.id === activeStep;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={`flex min-w-fit items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold transition 2xl:px-3 2xl:text-sm ${
              isActive
                ? "bg-[#5b1728] text-white shadow-[0_14px_34px_rgba(91,23,40,0.22)]"
                : "bg-white text-[#6f5a62] hover:bg-[#f7efe7] hover:text-[#3b1721]"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
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
  selectedEventType,
}: {
  activeStep: WizardStepId;
  event?: Event;
  selectedEventType: string;
}) {
  const stepLabel = getWizardSteps().find((step) => step.id === activeStep)?.label ?? "Evento";
  const eventTypeLabel = getEventTypeLabel(selectedEventType || event?.event_type || "");

  return (
    <div className="hidden min-w-0 items-center xl:flex">
      <div className="grid w-full min-w-0 gap-2 rounded-xl border border-[#eadfd2] bg-[#3b1721] px-3 py-2 text-white shadow-[0_16px_42px_rgba(74,23,36,0.14)] 2xl:grid-cols-[minmax(170px,0.75fr)_minmax(0,1fr)] 2xl:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Resumen</p>
          <h3 className="mt-1 truncate font-display text-base leading-tight 2xl:text-lg">
            {event?.hosts_names || event?.title || "Nueva invitación"}
          </h3>
          <p className="truncate text-xs leading-4 text-white/68">
            Paso <span className="font-semibold text-white">{stepLabel}</span>.
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-4 gap-1.5 text-xs">
          <SummaryRow label="Estado" value={event?.status ?? "borrador"} />
          <SummaryRow label="Tipo" value={eventTypeLabel} />
          <SummaryRow label="Fecha" value={event?.event_date ?? "Pendiente"} />
          <SummaryRow label="Enlace" value={event?.slug ? `/e/${event.slug}` : "Al guardar"} />
        </div>
      </div>
    </div>
  );
}

function getWizardSteps(): WizardStep[] {
  return [...baseWizardSteps];
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-lg border border-white/10 bg-white/6 px-2 py-1.5">
      <span className="text-[10px] leading-none text-white/46">{label}</span>
      <span className="truncate text-xs font-semibold leading-tight text-white">{value}</span>
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
  onFinalSubmit,
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
    <div className="z-20 border-t border-[#eadfd2] bg-[#fffaf3]/95 px-3 py-1.5 backdrop-blur md:rounded-2xl md:border">
      {draftToast ? (
        <p className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          {draftToast}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" className="h-9 border-[#d8c7b5]" disabled={activeStepIndex === 0} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isEditing ? (
            <Button type="button" variant="ghost" className="text-[#6d1f32] hover:bg-[#f7efe7]" onClick={onSaveDraft}>
              Guardar borrador
            </Button>
          ) : null}
          {isEditing || isLastStep ? (
            <Button
              type="button"
              className="h-9 rounded-xl bg-[#5b1728] px-5 text-sm text-white shadow-[0_16px_32px_rgba(74,23,36,0.18)] hover:bg-[#48111f]"
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
            <Button type="button" className="h-9 rounded-xl bg-[#5b1728] px-6 text-white hover:bg-[#48111f]" onClick={onNext}>
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
    <section className="rounded-2xl border border-[#eadfd2] bg-white p-3 shadow-[0_18px_45px_rgba(74,23,36,0.06)]">
      <div className="mb-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function getEventKind(value?: string | null): EventKind {
  const normalized = normalizeEventType(value);
  if (["quinceanios", "quinceanos", "quinceanera", "15 anos"].includes(normalized)) return "quinceanios";
  if (["graduacion", "graduation"].includes(normalized)) return "graduation";
  if (["boda", "wedding"].includes(normalized)) return "wedding";
  if (["bautizo", "bautismo", "baptism"].includes(normalized)) return "baptism";
  if (["baby shower", "baby_shower"].includes(normalized)) return "baby_shower";
  if (normalized.includes("infantil")) return "kids_birthday";
  if (normalized.includes("cumple")) return "birthday";
  if (["corporativo", "corporate"].includes(normalized)) return "corporate";
  return "other";
}

function getEventTypeLabel(value: string) {
  const normalized = normalizeEventType(value);
  const match = eventTypes.find(([eventValue]) => normalizeEventType(eventValue) === normalized);
  return match?.[1] ?? (value || "Tipo pendiente");
}

function getTitleLabel(kind: EventKind) {
  if (kind === "graduation") return "Título de la invitación";
  if (kind === "corporate") return "Nombre del evento";
  if (kind === "kids_birthday" || kind === "birthday") return "Nombre del cumpleañero/a";
  if (kind === "baptism") return "Nombre del bautizado/a";
  return "Título";
}

function getTitlePlaceholder(kind: EventKind) {
  if (kind === "graduation") return "Graduación de Sofía";
  if (kind === "quinceanios") return "Mis 15";
  if (kind === "corporate") return "Cena anual KAIS";
  if (kind === "kids_birthday") return "Cumple de Mateo";
  if (kind === "birthday") return "Cumple de Jorge";
  if (kind === "baptism") return "Bautismo de Emma";
  if (kind === "baby_shower") return "Baby shower de Emma";
  return "Boda de Ana y Luis";
}

function getHostsLabel(kind: EventKind) {
  if (kind === "graduation") return "Familia / anfitriones";
  if (kind === "corporate") return "Empresa anfitriona";
  if (kind === "baptism") return "Padres / anfitriones";
  if (kind === "baby_shower") return "Padres / anfitriones";
  return "Nombres de anfitriones";
}

function getHostsPlaceholder(kind: EventKind) {
  if (kind === "corporate") return "KAIS Invitaciones";
  if (kind === "graduation") return "Familia Martínez";
  if (kind === "quinceanios") return "Kenia";
  if (kind === "baptism") return "Sus padres";
  return "Ana & Luis";
}

function getAddressLabel(kind: EventKind) {
  if (kind === "graduation") return "Lugar principal";
  if (kind === "corporate") return "Sede";
  return "Dirección";
}

function getAddressPlaceholder(kind: EventKind) {
  if (kind === "corporate") return "Hotel, salón o sede corporativa";
  if (kind === "graduation") return "Auditorio, salón o ciudad";
  return "Salón, ciudad, país";
}

function getDressPlaceholder(kind: EventKind) {
  if (kind === "corporate") return "Formal / business casual";
  if (kind === "kids_birthday") return "Cómodo / temático";
  if (kind === "baby_shower") return "Pastel / elegante";
  return "Elegante";
}

function getColorPlaceholder(kind: EventKind) {
  if (kind === "graduation") return "Azul noche, dorado y negro";
  if (kind === "quinceanios") return "Rosa, dorado y crema";
  if (kind === "kids_birthday") return "Pastel, celeste y amarillo";
  if (kind === "corporate") return "Grafito, blanco y dorado";
  return "Dorado, blanco y verde";
}

function getThemePlaceholder(kind: EventKind) {
  if (kind === "graduation") return "Académico / elegante / nocturno";
  if (kind === "quinceanios") return "Rosas / romántico / moderno";
  if (kind === "kids_birthday") return "Animado / infantil / mágico";
  if (kind === "corporate") return "Gala / lanzamiento / conferencia";
  return "Clásico / moderno / natural";
}

function getMainMessageLabel(kind: EventKind) {
  if (kind === "corporate") return "Mensaje institucional";
  return "Mensaje principal";
}

function getMainMessagePlaceholder(kind: EventKind) {
  if (kind === "graduation") return "Acompáñanos a celebrar años de esfuerzo y nuevos comienzos.";
  if (kind === "quinceanios") return "Deseo compartir esta noche especial con las personas que más quiero.";
  if (kind === "corporate") return "Te invitamos a compartir este encuentro especial.";
  if (kind === "kids_birthday") return "Ven a celebrar una tarde llena de alegría.";
  return "Una frase especial para tus invitados.";
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

function validateCoverUploads(form: HTMLFormElement) {
  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  const totalSize = [coverFile, mobileCoverFile].filter(Boolean).reduce((sum, file) => sum + (file?.size ?? 0), 0);

  const coverError = validateFile(coverFile, "La portada principal", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (coverError) return coverError;

  const mobileCoverError = validateFile(mobileCoverFile, "La portada móvil", MAX_COVER_FILE_SIZE, ALLOWED_COVER_EXTENSIONS);
  if (mobileCoverError) return mobileCoverError;

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE) {
    return "Las portadas seleccionadas no deben superar 20MB en total.";
  }

  return "";
}

function getFile(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement && input.files?.[0] ? input.files[0] : null;
}

async function uploadCoverFilesToCloudflare(form: HTMLFormElement, setStatus: (status: string) => void) {
  const coverFile = getFile(form, "cover_image_file");
  const mobileCoverFile = getFile(form, "mobile_cover_image_file");
  let coverImageUrl = getInputValue(form, "cover_image_url");
  let mobileCoverImageUrl = getInputValue(form, "mobile_cover_image_url");

  if (!coverFile && !mobileCoverFile) {
    return { coverImageUrl, mobileCoverImageUrl };
  }

  if (coverFile) {
    setStatus("Subiendo portada principal a Cloudflare R2...");
    coverImageUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: coverFile,
      path: `covers/direct/desktop/${crypto.randomUUID()}-${sanitizeFileName(coverFile.name)}`,
      contentType: coverFile.type || getImageContentType(coverFile.name),
    });
    setInputValue(form, "cover_image_url", coverImageUrl);
  }

  if (mobileCoverFile) {
    setStatus("Subiendo portada móvil a Cloudflare R2...");
    mobileCoverImageUrl = await uploadPublicFile({
      bucket: "event-photos",
      file: mobileCoverFile,
      path: `covers/direct/mobile/${crypto.randomUUID()}-${sanitizeFileName(mobileCoverFile.name)}`,
      contentType: mobileCoverFile.type || getImageContentType(mobileCoverFile.name),
    });
    setInputValue(form, "mobile_cover_image_url", mobileCoverImageUrl);
  }

  return { coverImageUrl, mobileCoverImageUrl };
}

async function uploadPublicFile({
  bucket,
  file,
  path,
  contentType,
}: {
  bucket: "event-photos";
  file: File;
  path: string;
  contentType: string;
}) {
  const formData = new FormData();
  formData.set("bucket", bucket);
  formData.set("path", path);
  formData.set("contentType", contentType);
  formData.set("file", file);

  const response = await fetch("/api/cloudflare/upload", {
    method: "POST",
    body: formData,
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; url?: string; error?: string } | null;

  if (!response.ok || !result?.ok || !result.url) {
    throw new Error(result?.error ?? `No se pudo subir ${file.name}.`);
  }

  return result.url;
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
