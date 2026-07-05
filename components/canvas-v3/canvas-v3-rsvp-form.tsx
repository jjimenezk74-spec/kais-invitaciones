"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  buildRsvpFormAppearance,
  type RsvpFormAppearance,
  type RsvpFormElementOverrides,
} from "@/lib/canvas-v3/rsvp-form-appearance";

type InvitedGuest = {
  guest_name?: string;
  phone?: string;
  email?: string;
  max_companions?: number;
};

type InvitedGuestRsvp = {
  attending?: boolean;
  phone?: string;
  email?: string;
  companions?: number;
  dietary_restrictions?: string;
  message?: string;
};

export type CanvasV3RsvpFormProps = {
  mode?: "public" | "preview" | "editor";
  width: number;
  themeId?: string | null;
  elementStyle?: RsvpFormElementOverrides;
  eventSlug?: string;
  eventTitle?: string;
  rsvpAction?: ((formData: FormData) => void | Promise<void>) | null;
  guestToken?: string | null;
  invitedGuest?: InvitedGuest | null;
  invitedGuestRsvp?: InvitedGuestRsvp | null;
  rsvpError?: string | null;
  rsvpStatus?: string | null;
  rsvpAttending?: string | null;
  shouldUseWhatsAppRsvp?: boolean;
};

function Field({
  label,
  appearance,
  children,
}: {
  label: string;
  appearance: RsvpFormAppearance;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={appearance.label}>{label}</span>
      {children}
    </label>
  );
}

export function CanvasV3RsvpForm({
  mode = "public",
  width,
  themeId,
  elementStyle,
  eventSlug,
  eventTitle,
  rsvpAction,
  guestToken,
  invitedGuest,
  invitedGuestRsvp,
  rsvpError,
  rsvpStatus,
  rsvpAttending,
  shouldUseWhatsAppRsvp = false,
}: CanvasV3RsvpFormProps) {
  const appearance = buildRsvpFormAppearance(themeId, elementStyle);
  const isInteractive = mode === "public";
  const isEditor = mode === "editor" || mode === "preview";
  const isConfirmed = isInteractive && (Boolean(invitedGuestRsvp) || rsvpStatus === "ok");
  const confirmedAttending = invitedGuestRsvp
    ? invitedGuestRsvp.attending
    : rsvpStatus === "ok"
      ? rsvpAttending !== "no"
      : null;
  const formDisabled = !isInteractive || isConfirmed;
  const fieldStyle: CSSProperties = {
    ...appearance.field,
    opacity: isEditor ? 0.92 : 1,
    cursor: formDisabled ? "default" : "text",
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: width,
    boxSizing: "border-box",
    padding: "24px 22px 26px",
    pointerEvents: isEditor ? "none" : "auto",
    ...appearance.card,
  };

  const submitStyle: CSSProperties = {
    ...appearance.button,
    cursor: formDisabled ? "default" : "pointer",
    opacity: formDisabled ? 0.72 : 1,
    transition: "transform 160ms ease, box-shadow 160ms ease",
  };

  return (
    <div style={cardStyle}>
      {rsvpError ? (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 12,
            border: "1px solid rgba(248,113,113,0.35)",
            background: "rgba(127,29,29,0.22)",
            padding: "10px 12px",
            fontSize: 12,
            color: "#fecaca",
            fontFamily: appearance.fontBody,
          }}
        >
          {rsvpError}
        </div>
      ) : null}

      {isConfirmed ? (
        <div style={{ ...appearance.note, marginBottom: 14 }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: appearance.accent,
              fontFamily: appearance.fontBody,
            }}
          >
            Confirmacion recibida
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              lineHeight: 1.55,
              color: appearance.muted,
              fontFamily: appearance.fontBody,
            }}
          >
            {confirmedAttending === false
              ? "Gracias por tu respuesta."
              : "Gracias por confirmar tu presencia. Te esperamos con mucha alegria."}
          </p>
        </div>
      ) : null}

      <form
        action={isInteractive && !isConfirmed ? rsvpAction ?? undefined : undefined}
        style={{ display: "grid", gap: 14 }}
      >
        <input type="hidden" name="slug" value={eventSlug ?? ""} />
        <input type="hidden" name="guest_token" value={guestToken ?? ""} />
        <input type="hidden" name="external_rsvp_whatsapp" value={shouldUseWhatsAppRsvp ? "1" : ""} />
        <input type="hidden" name="event_title" value={eventTitle ?? ""} />

        <Field label="Nombre" appearance={appearance}>
          <input
            name="guest_name"
            required={isInteractive}
            defaultValue={invitedGuest?.guest_name ?? ""}
            readOnly={Boolean(invitedGuest) || formDisabled}
            disabled={formDisabled}
            style={fieldStyle}
          />
        </Field>

        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Telefono" appearance={appearance}>
            <input
              name="phone"
              defaultValue={invitedGuest?.phone ?? invitedGuestRsvp?.phone ?? ""}
              disabled={formDisabled}
              style={fieldStyle}
            />
          </Field>
          <Field label="Email" appearance={appearance}>
            <input
              name="email"
              type="email"
              defaultValue={invitedGuest?.email ?? invitedGuestRsvp?.email ?? ""}
              disabled={formDisabled}
              style={fieldStyle}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Asistira?" appearance={appearance}>
            <select
              name="attending"
              defaultValue={invitedGuestRsvp?.attending === false ? "no" : "si"}
              disabled={formDisabled}
              style={fieldStyle}
            >
              <option value="si">Si, con gusto</option>
              <option value="no">No podre asistir</option>
            </select>
          </Field>
          {invitedGuest?.max_companions === 0 ? (
            <div style={appearance.note}>Invitacion individual.</div>
          ) : (
            <Field label="Acompanantes" appearance={appearance}>
              <input
                name="companions"
                type="number"
                min={0}
                max={invitedGuest?.max_companions}
                defaultValue={String(invitedGuestRsvp?.companions ?? 0)}
                disabled={formDisabled}
                style={fieldStyle}
              />
            </Field>
          )}
        </div>

        <Field label="Restriccion alimentaria" appearance={appearance}>
          <input
            name="dietary_restrictions"
            placeholder="Opcional"
            defaultValue={invitedGuestRsvp?.dietary_restrictions ?? ""}
            disabled={formDisabled}
            style={fieldStyle}
          />
        </Field>

        <Field label="Mensaje para los anfitriones" appearance={appearance}>
          <textarea
            name="message"
            rows={3}
            defaultValue={invitedGuestRsvp?.message ?? ""}
            disabled={formDisabled}
            style={{ ...fieldStyle, resize: "none" }}
          />
        </Field>

        {!isConfirmed ? (
          <button type={isInteractive ? "submit" : "button"} style={submitStyle} disabled={formDisabled}>
            {appearance.submitLabel}
          </button>
        ) : null}
      </form>
    </div>
  );
}

export function isRsvpFormPlaceholderElement(content?: string | null): boolean {
  if (!content) return false;
  const normalized = content.toLowerCase();
  return (
    (normalized.includes("formulario") && normalized.includes("integrado")) ||
    normalized.includes("listo para tus invitados") ||
    normalized.includes("se integra al diseño") ||
    normalized.includes("se ve premium en la vista previa")
  );
}
