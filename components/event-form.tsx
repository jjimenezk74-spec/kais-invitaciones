import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import type { Event, Profile } from "@/lib/types";

type EventFormProps = {
  action: (formData: FormData) => Promise<void> | void;
  event?: Event;
  clients?: Profile[];
  showOwner?: boolean;
};

const eventTypes = ["boda", "cumpleaños", "quinceaños", "bautizo", "baby shower", "corporativo", "graduación", "otro"];
const statuses = ["borrador", "publicado", "inactivo"];

export function EventForm({ action, event, clients = [], showOwner = false }: EventFormProps) {
  return (
    <form action={action} className="grid gap-5">
      {showOwner ? (
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

      <Button className="w-full sm:w-fit">
        <Save className="h-4 w-4" />
        Guardar evento
      </Button>
    </form>
  );
}
