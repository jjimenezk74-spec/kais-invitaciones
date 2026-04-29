/**
 * GuestSection -- deferred async Server Component
 * Carga: event_guests (admin client)
 * Renderiza: Lista de invitados -- diseno premium
 */
import { Users, ExternalLink, MessageCircle, BellRing, ShieldOff, ShieldCheck, Trash2, Upload } from "lucide-react";
import { createEventGuest, deleteEventGuest, toggleEventGuestBlocked } from "@/app/actions/events";
import { GuestAddForm } from "@/components/guest-add-form";
import { GuestSearchInput } from "@/components/guest-search-input";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventGuest } from "@/lib/types";
import {
  buildGuestReminderMessage,
  buildGuestWhatsAppMessage,
  buildWhatsAppUrl,
  guestEventUrl,
} from "@/lib/utils";

function GuestStatusBadge({ status }: { status: EventGuest["status"] }) {
  const map: Record<EventGuest["status"], { label: string; cls: string }> = {
    pendiente:  { label: "Pendiente",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    confirmado: { label: "Confirmado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    no_asiste:  { label: "No asiste",  cls: "bg-red-50 text-red-700 border-red-200" },
    bloqueado:  { label: "Bloqueado",  cls: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const s = map[status] ?? map.pendiente;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function EmptyGuests({ guestMode }: { guestMode: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Sin invitados cargados</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {guestMode === "lista_invitados"
            ? "Este evento valida confirmaciones contra la lista. Agrega invitados para que reciban enlaces personales."
            : "Los invitados pueden confirmar desde el enlace publico. Puedes agregar invitados con enlace personal igualmente."}
        </p>
      </div>
    </div>
  );
}

export async function GuestSection({ event }: { event: Event }) {
  const sectionLabel = perfStart(`guest-section-${event.id}`);
  const admin = createAdminClient();
  const { data: guestsData } = await timed(
    "dashboard-event-guests-list",
    admin
      .from("event_guests")
      .select("id,event_id,guest_name,phone,email,token,max_companions,status,rsvp_id,last_opened_at,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
  );
  perfEnd(sectionLabel);

  const guests = (guestsData ?? []) as EventGuest[];
  const addAction = createEventGuest.bind(null, event.id);

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Lista de invitados
            </CardTitle>
            {event.guest_mode === "lista_invitados" && (
              <p className="mt-1 text-sm text-muted-foreground">
                Este evento valida confirmaciones contra la lista cargada.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <GuestAddForm action={addAction} />
            <Button variant="outline" disabled title="Proxima funcionalidad">
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 pt-5">
        {guests.length > 0 && <GuestSearchInput />}
        {guests.length === 0 ? (
          <EmptyGuests guestMode={event.guest_mode} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-4">Invitado</th>
                  <th className="pr-4">Estado</th>
                  <th className="pr-4 text-center">Cupo</th>
                  <th className="pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => {
                  const link     = guestEventUrl(event.slug, guest.token);
                  const whatsapp = buildWhatsAppUrl(
                    guest.phone,
                    buildGuestWhatsAppMessage(guest.guest_name, event.title, link),
                  );
                  const reminder = buildWhatsAppUrl(
                    guest.phone,
                    buildGuestReminderMessage(guest.guest_name, event.title, link),
                  );
                  return (
                    <tr
                      key={guest.id}
                      className="border-b last:border-0 align-middle transition-colors hover:bg-muted/30"
                      data-guest-row=""
                      data-guest-name={guest.guest_name.toLowerCase()}
                      data-guest-phone={guest.phone}
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-foreground">{guest.guest_name}</p>
                        <p className="text-xs text-muted-foreground">{guest.phone}</p>
                        {guest.email && (
                          <p className="text-xs text-muted-foreground">{guest.email}</p>
                        )}
                      </td>
                      <td className="pr-4">
                        <GuestStatusBadge status={guest.status} />
                      </td>
                      <td className="pr-4 text-center">
                        <p className="font-semibold">{guest.max_companions + 1} personas</p>
                        <p className="text-xs text-muted-foreground">
                          {guest.max_companions <= 0
                            ? "Invitacion individual"
                            : `Titular + ${guest.max_companions} acompanante${guest.max_companions === 1 ? "" : "s"}`}
                        </p>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <CopyLinkButton value={link} label="Copiar" copiedLabel="Copiado" />
                          <Button size="sm" variant="outline" asChild>
                            <a href={whatsapp} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={reminder} target="_blank" rel="noreferrer">
                              <BellRing className="h-3.5 w-3.5" />
                              Recordar
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={link} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <form
                            action={toggleEventGuestBlocked.bind(
                              null,
                              guest.id,
                              event.id,
                              guest.status !== "bloqueado",
                            )}
                          >
                            <Button size="sm" variant="outline" title={guest.status === "bloqueado" ? "Desbloquear" : "Bloquear"}>
                              {guest.status === "bloqueado"
                                ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                : <ShieldOff className="h-3.5 w-3.5 text-amber-600" />}
                            </Button>
                          </form>
                          <form action={deleteEventGuest.bind(null, guest.id, event.id)}>
                            <Button size="sm" variant="danger" title="Eliminar invitado">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {guests.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {guests.length} invitado{guests.length !== 1 ? "s" : ""} en total
            {" · "}
            {guests.filter((g) => g.status === "confirmado").length} confirmados
          </p>
        )}
      </CardContent>
    </Card>
  );
}
