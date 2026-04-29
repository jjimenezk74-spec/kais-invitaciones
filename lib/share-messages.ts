import type { Event, EventGuest } from "@/lib/types";

export function getInvitationShareMessage(event: Pick<Event, "title">, url: string) {
  return [
    `Tenemos el agrado de invitarte a ${event.title}.`,
    "Ingresa al siguiente enlace para ver todos los detalles:",
    url
  ].join("\n");
}

export function getGuestInvitationShareMessage(
  event: Pick<Event, "title">,
  guest: Pick<EventGuest, "guest_name">,
  url: string
) {
  return [
    `Hola ${guest.guest_name}, tenemos el agrado de invitarte a ${event.title}.`,
    "Confirma tu asistencia desde tu enlace personal:",
    url
  ].join("\n");
}

export function getPhotoUploadShareMessage(event: Pick<Event, "title">, url: string) {
  return [
    `Comparti tus mejores recuerdos de ${event.title}.`,
    "Subi tus fotos desde este enlace:",
    url
  ].join("\n");
}

export function getAlbumShareMessage(event: Pick<Event, "title">, url: string) {
  return [
    `Ya podes ver el album de ${event.title}.`,
    "Ingresa aqui:",
    url
  ].join("\n");
}

export function getClientAccessShareMessage(event: Pick<Event, "title">, url: string) {
  return [
    `Hola, ya podes ingresar al panel de tu evento ${event.title}.`,
    "Acceso:",
    url
  ].join("\n");
}

export function getWhatsAppUrl(message: string, phone?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  const base = normalizedPhone ? `https://wa.me/${normalizedPhone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function normalizePhone(phone?: string | null) {
  return String(phone ?? "").replace(/[^\d]/g, "");
}
