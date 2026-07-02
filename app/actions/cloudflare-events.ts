"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getD1EventGuestByToken, getD1PublicEventBySlug, insertD1Rsvp, updateD1EventGuestRsvp } from "@/lib/cloudflare/public-events";

export async function submitD1Rsvp(eventId: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const guestToken = String(formData.get("guest_token") ?? "").trim();
  const rsvpUrl = (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    if (guestToken) search.set("guest", guestToken);
    return `/evento/${slug}?${search.toString()}#rsvp`;
  };
  const errorUrl = (message: string) => rsvpUrl({ rsvp_error: message });

  if (!slug) {
    redirect("/?error=No se pudo identificar la invitacion.");
  }

  const event = await getD1PublicEventBySlug(slug);
  if (!event || event.id !== eventId || event.status !== "publicado") {
    redirect(errorUrl("Esta invitacion aun no esta publicada."));
  }

  const eventGuest = guestToken ? await getD1EventGuestByToken(eventId, guestToken) : null;

  if (event.guest_mode === "lista_invitados" && !guestToken) {
    redirect(errorUrl("Esta invitacion requiere enlace personal."));
  }

  if (guestToken && !eventGuest) {
    redirect(errorUrl("Este enlace personal no es valido."));
  }

  if (eventGuest?.status === "bloqueado") {
    redirect(errorUrl("Este enlace ya no esta activo."));
  }

  let guestName = String(formData.get("guest_name") ?? "").trim();
  const companions = Number(formData.get("companions") || 0);
  const attending = String(formData.get("attending")) === "si";
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const dietaryRestrictions = String(formData.get("dietary_restrictions") ?? "").trim();
  const shouldOpenWhatsApp = String(formData.get("external_rsvp_whatsapp") ?? "") === "1";
  const eventTitle = String(formData.get("event_title") ?? "").trim();
  let resolvedPhone = phone;
  let resolvedEmail = email;

  if (eventGuest) {
    guestName = eventGuest.guest_name;
    resolvedPhone = eventGuest.phone?.trim() || phone;
    resolvedEmail = eventGuest.email?.trim() || email;
  }

  if (!guestName) {
    redirect(errorUrl("Escribe tu nombre para confirmar asistencia."));
  }

  if (eventGuest && companions > eventGuest.max_companions) {
    redirect(errorUrl(`Este enlace permite un cupo total de ${eventGuest.max_companions + 1} persona${eventGuest.max_companions + 1 === 1 ? "" : "s"}.`));
  }

  if (eventGuest?.rsvp_id) {
    revalidatePath(`/evento/${slug}`);
    redirect(rsvpUrl(buildRsvpSuccessParams({
      guestName,
      attending,
      companions,
      phone: resolvedPhone,
      email: resolvedEmail,
      message,
      dietaryRestrictions,
      eventTitle,
      shouldOpenWhatsApp
    })));
  }

  if (!Number.isFinite(companions) || companions < 0) {
    redirect(errorUrl("La cantidad de acompanantes debe ser 0 o mayor."));
  }

  try {
    const rsvpId = await insertD1Rsvp({
      eventId,
      guestName,
      phone: nullable(resolvedPhone),
      email: nullable(resolvedEmail),
      attending,
      companions: Math.floor(companions),
      message: nullable(message),
      dietaryRestrictions: nullable(dietaryRestrictions)
    });

    if (eventGuest) {
      await updateD1EventGuestRsvp({
        guestId: eventGuest.id,
        eventId,
        rsvpId,
        status: attending ? "confirmado" : "no_asiste"
      });
    }
  } catch (error) {
    console.error("[KAIS D1 RSVP] No se pudo guardar RSVP", {
      eventId,
      slug,
      message: error instanceof Error ? error.message : String(error)
    });
    redirect(errorUrl("No pudimos guardar tu confirmacion. Intenta de nuevo o contacta a los anfitriones."));
  }

  revalidatePath(`/evento/${slug}`);
  redirect(rsvpUrl(buildRsvpSuccessParams({
    guestName,
    attending,
    companions,
    phone: resolvedPhone,
    email: resolvedEmail,
    message,
    dietaryRestrictions,
    eventTitle,
    shouldOpenWhatsApp
  })));
}

function nullable(value: string) {
  const text = value.trim();
  return text.length ? text : null;
}

function buildRsvpSuccessParams({
  guestName,
  attending,
  companions,
  phone,
  email,
  message,
  dietaryRestrictions,
  eventTitle,
  shouldOpenWhatsApp
}: {
  guestName: string;
  attending: boolean;
  companions: number;
  phone: string;
  email: string;
  message: string;
  dietaryRestrictions: string;
  eventTitle: string;
  shouldOpenWhatsApp: boolean;
}) {
  const params: Record<string, string> = {
    rsvp: "ok",
    rsvp_attending: attending ? "si" : "no"
  };

  if (shouldOpenWhatsApp) {
    params.wa = "1";
    params.wa_message = [
      `Confirmacion RSVP - ${eventTitle || "Evento"}`,
      "",
      `Nombre: ${guestName}`,
      `Asistira: ${attending ? "Si" : "No"}`,
      `Acompanantes: ${companions}`,
      phone ? `Telefono: ${phone}` : "",
      email ? `Email: ${email}` : "",
      dietaryRestrictions ? `Restriccion alimentaria: ${dietaryRestrictions}` : "",
      message ? `Mensaje: ${message}` : ""
    ].filter(Boolean).join("\n");
  }

  return params;
}
