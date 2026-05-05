// Catálogo de decoraciones predefinidas para el editor canvas.
// URLs de Twemoji (MIT license) vía jsDelivr CDN — versión fija para estabilidad.

const TW = (code: string) =>
  `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`;

export type Decoration = {
  id: string;
  name: string;
  url: string;
};

export const DECORATIONS: Decoration[] = [
  // ── Flores ──────────────────────────────────────────────────────────────
  { id: "rosa",       name: "Rosa",         url: TW("1f339") },
  { id: "flor-rosa",  name: "Flor rosa",    url: TW("1f338") },
  { id: "hibisco",    name: "Hibisco",      url: TW("1f33a") },
  { id: "girasol",    name: "Girasol",      url: TW("1f33b") },
  { id: "tulipan",    name: "Tulipán",      url: TW("1f337") },
  { id: "ramo",       name: "Ramo",         url: TW("1f490") },
  { id: "hojas",      name: "Hojas",        url: TW("1f343") },
  { id: "hierba",     name: "Hierba",       url: TW("1f33f") },
  // ── Estrellas & brillos ──────────────────────────────────────────────────
  { id: "destellos",  name: "Destellos",    url: TW("2728")  },
  { id: "estrella",   name: "Estrella",     url: TW("2b50")  },
  { id: "estrella-8", name: "Estrella 8p",  url: TW("1f31f") },
  { id: "dizzy",      name: "Centellas",    url: TW("1f4ab") },
  // ── Accesorios ──────────────────────────────────────────────────────────
  { id: "moño",       name: "Moño",         url: TW("1f380") },
  { id: "corona",     name: "Corona",       url: TW("1f451") },
  { id: "diamante",   name: "Diamante",     url: TW("1f48e") },
  { id: "corazon",    name: "Corazón",      url: TW("2764")  },
  { id: "mariposa",   name: "Mariposa",     url: TW("1f98b") },
  { id: "paloma",     name: "Paloma",       url: TW("1fab6") },
  { id: "confeti",    name: "Confeti",      url: TW("1f38a") },
  { id: "anillos",    name: "Anillos",      url: TW("1f48d") },
];
