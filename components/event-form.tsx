import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import type { Client, Event, InvitationTemplate, Profile } from "@/lib/types";

type EventFormProps = {
  action: (formData: FormData) => Promise<void> | void;
  event?: Event;
  clients?: Profile[];
  businessClients?: Client[];
  templates?: InvitationTemplate[];
  showOwner?: boolean;
};

const eventTypes = ["boda", "cumpleaños", "quinceaños", "bautizo", "baby shower", "corporativo", "graduación", "otro"];
const statuses = ["borrador", "publicado", "inactivo"];
const guestModes = [
  ["publico", "Publico"],
  ["lista_invitados", "Lista de invitados"]
];

export function EventForm({ action, event, clients = [], businessClients = [], templates = [], showOwner = false }: EventFormProps) {
  const shouldShowOwnerSelect = showOwner && clients.length > 0;

  return (
    <form action={action} className="grid gap-5">
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
        <Field label="Foto de portada" hint="Sube la foto principal que aparecerá en la invitación.">
          <Input name="cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field label="Portada móvil" hint="Opcional. Imagen vertical optimizada para WhatsApp y celulares.">
          <Input name="mobile_cover_image_url" defaultValue={event?.mobile_cover_image_url ?? ""} placeholder="https://..." />
          <Input name="mobile_cover_image_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field
          label="Música opcional"
          hint="Puedes pegar un enlace o subir un archivo .mp3, .wav u .ogg. Si subes archivo, se usará ese audio."
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
        Guardar evento
      </Button>
    </form>
  );
}

function templatePreviewBackground(slug: string, primary?: string, secondary?: string) {
  if (slug === "rosas-rojas-15") {
    return "radial-gradient(circle at 15% 15%, #7f1d1d 0 12%, transparent 13%), linear-gradient(135deg, #170607, #5f0f14 58%, #d4af37)";
  }

  return `linear-gradient(135deg, ${primary ?? "#111827"}, ${secondary ?? "#e5e7eb"})`;
}
