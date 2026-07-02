"use client";

import type { ReactNode } from "react";
import { Send } from "lucide-react";
import { RsvpWhatsAppRedirect } from "@/components/rsvp-whatsapp-redirect";
import { eventHasFeature } from "@/lib/event-features";
import type { Event, EventGuest, Rsvp } from "@/lib/types";

type PublicRsvpFormProps = {
  event: Event;
  isEditor?: boolean;
  isAdminPreview?: boolean;
  invitedGuest?: EventGuest | null;
  invitedGuestRsvp?: Rsvp | null;
  guestToken?: string | null;
  rsvpAction?: ((formData: FormData) => void | Promise<void>) | null;
  rsvpError?: string | null;
  rsvpStatus?: string | null;
  rsvpAttending?: string | null;
  shouldRedirectWhatsApp?: boolean;
  whatsappMessage?: string | null;
  shouldUseWhatsAppRsvp?: boolean;
};

export function PublicRsvpForm({
  event,
  isEditor = false,
  isAdminPreview = false,
  invitedGuest,
  invitedGuestRsvp,
  guestToken,
  rsvpAction,
  rsvpError,
  rsvpStatus,
  rsvpAttending,
  shouldRedirectWhatsApp = false,
  whatsappMessage,
  shouldUseWhatsAppRsvp = false,
}: PublicRsvpFormProps) {
  const isConfirmed = !isEditor && (Boolean(invitedGuestRsvp) || rsvpStatus === "ok");
  const confirmedAttending = invitedGuestRsvp
    ? invitedGuestRsvp.attending
    : rsvpStatus === "ok"
      ? rsvpAttending !== "no"
      : null;
  const formDisabled = isEditor || isConfirmed || isAdminPreview;
  const lockGuestName = Boolean(invitedGuest);
  const lockPhone = Boolean(invitedGuest?.phone);
  const lockEmail = Boolean(invitedGuest?.email);

  return (
    <div className="kais-glass relative rounded-[2rem] p-6 sm:p-9 md:p-11">
      {isAdminPreview && (
        <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-xs font-semibold text-amber-300">
          Vista previa administrador - el envio de RSVP esta deshabilitado.
        </div>
      )}
      {eventHasFeature(event, "external_rsvp_whatsapp") && !event.whatsapp_phone ? (
        <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-xs font-semibold text-amber-300">
          Este evento usa aviso por WhatsApp, pero todavia no tiene un numero configurado. La confirmacion se guardara en el sistema.
        </div>
      ) : null}
      {rsvpError && !isAdminPreview ? (
        <div className="mb-5 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-100">
          {rsvpError}
        </div>
      ) : null}

      <form action={!isEditor ? rsvpAction ?? undefined : undefined} className="grid gap-5 md:gap-7">
        <input type="hidden" name="slug" value={event.slug} />
        <input type="hidden" name="guest_token" value={guestToken ?? ""} />
        <input type="hidden" name="external_rsvp_whatsapp" value={shouldUseWhatsAppRsvp ? "1" : ""} />
        <input type="hidden" name="event_title" value={event.title} />

        {isConfirmed && !isAdminPreview ? (
          <div className="rounded-2xl border border-[#d4af37]/35 bg-[#d4af37]/10 p-4 text-[#f5ecd9]">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#d4af37]">Confirmacion recibida</p>
            <p className="mt-2 text-sm leading-6 text-[#f5ecd9]/72">
              {confirmedAttending === false
                ? "Gracias por tu respuesta."
                : "Gracias por confirmar tu presencia. Te esperamos con mucha alegria."}
            </p>
            {shouldRedirectWhatsApp && event.whatsapp_phone && whatsappMessage ? (
              <RsvpWhatsAppRedirect phone={event.whatsapp_phone} message={whatsappMessage} />
            ) : null}
          </div>
        ) : null}

        <LuxeField label="Nombre">
          <input
            name="guest_name"
            required
            defaultValue={invitedGuest?.guest_name ?? invitedGuestRsvp?.guest_name ?? ""}
            readOnly={lockGuestName || formDisabled}
            disabled={formDisabled}
            className="kais-input-luxe"
          />
        </LuxeField>

        <div className="grid gap-5 md:grid-cols-2 md:gap-7">
          <LuxeField label="Telefono">
            <input
              name="phone"
              defaultValue={invitedGuest?.phone ?? invitedGuestRsvp?.phone ?? ""}
              readOnly={lockPhone || formDisabled}
              disabled={formDisabled}
              className="kais-input-luxe"
            />
          </LuxeField>
          <LuxeField label="Email">
            <input
              name="email"
              type="email"
              defaultValue={invitedGuest?.email ?? invitedGuestRsvp?.email ?? ""}
              readOnly={lockEmail || formDisabled}
              disabled={formDisabled}
              className="kais-input-luxe"
            />
          </LuxeField>
        </div>

        <div className="grid gap-5 md:grid-cols-2 md:gap-7">
          <LuxeField label="Asistira?">
            <select
              name="attending"
              defaultValue={invitedGuestRsvp?.attending === false ? "no" : "si"}
              disabled={formDisabled}
              className="kais-input-luxe"
            >
              <option value="si">Si, con gusto</option>
              <option value="no">No podre asistir</option>
            </select>
          </LuxeField>
          {invitedGuest?.max_companions === 0 ? (
            <div className="rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 px-4 py-3">
            <p className="text-sm font-semibold text-[#f5ecd9]">Invitacion individual.</p>
            </div>
          ) : (
            <LuxeField label="Acompanantes">
              <input
                name="companions"
                type="number"
                min={0}
                max={invitedGuest?.max_companions}
                defaultValue={String(invitedGuestRsvp?.companions ?? 0)}
                disabled={formDisabled}
                className="kais-input-luxe"
              />
              {invitedGuest ? (
                <p className="mt-2 text-xs leading-5 text-[#f5ecd9]/65">
                  Tu cupo permite hasta {invitedGuest.max_companions} acompanante{invitedGuest.max_companions === 1 ? "" : "s"}.
                </p>
              ) : null}
            </LuxeField>
          )}
        </div>

        <LuxeField label="Restriccion alimentaria">
          <input
            name="dietary_restrictions"
            placeholder="Opcional"
            defaultValue={invitedGuestRsvp?.dietary_restrictions ?? ""}
            disabled={formDisabled}
            className="kais-input-luxe"
          />
        </LuxeField>

        <LuxeField label="Mensaje para los anfitriones">
          <textarea
            name="message"
            rows={3}
            defaultValue={invitedGuestRsvp?.message ?? ""}
            disabled={formDisabled}
            className="kais-input-luxe resize-none"
          />
        </LuxeField>

        {!isConfirmed && !isAdminPreview && !isEditor ? (
          <div className="mt-2">
            <button type="submit" className="kais-cta w-full sm:w-fit">
              <Send className="h-3.5 w-3.5" />
              Confirmar presencia
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function LuxeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kais-eyebrow text-[0.6rem] tracking-[0.36em] text-[#d4af37]/85">{label}</span>
      <div className="mt-2.5">{children}</div>
    </label>
  );
}
