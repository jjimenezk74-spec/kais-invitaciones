import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path = "") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000");

  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicEventUrl(slug: string) {
  return shortEventUrl(slug);
}

export function guestEventUrl(slug: string, token: string) {
  return shortGuestEventUrl(slug, token);
}

export function legacyPublicEventUrl(slug: string) {
  return absoluteUrl(`/evento/${slug}`);
}

export function shortEventUrl(slug: string) {
  return absoluteUrl(`/e/${slug}`);
}

export function shortGuestEventUrl(slug: string, token: string) {
  return absoluteUrl(`/e/${slug}?g=${encodeURIComponent(token)}`);
}

export function shortPhotoUploadUrl(slug: string) {
  return absoluteUrl(`/f/${slug}`);
}

export function shortAlbumUrl(slug: string) {
  return absoluteUrl(`/a/${slug}`);
}

export function shortLiveScreenUrl(slug: string) {
  return absoluteUrl(`/l/${slug}`);
}

export function buildGuestWhatsAppMessage(guestName: string, eventTitle: string, guestLink: string) {
  return [
    `Hola ${guestName}, estas invitado/a a ${eventTitle}.`,
    "",
    "Confirma tu asistencia aqui:",
    guestLink,
    "",
    "Este enlace es personal, por favor no lo compartas."
  ].join("\n");
}

export function buildGuestReminderMessage(guestName: string, eventTitle: string, guestLink: string) {
  return [
    `Hola ${guestName}, te recordamos confirmar tu asistencia a ${eventTitle}.`,
    "",
    "Puedes revisar o editar tu respuesta aqui:",
    guestLink,
    "",
    "Este enlace es personal."
  ].join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildCredentialsMessage(username: string, password: string) {
  return [
    "Hola, este es tu acceso al panel de tu evento:",
    "",
    `Panel: ${absoluteUrl("/evento-login")}`,
    `Usuario: ${username}`,
    `Contrasena: ${password}`
  ].join("\n");
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 70);
}
