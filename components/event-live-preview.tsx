"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type EventLivePreviewProps = {
  templateId: string;
  templateSlug?: string;
  title: string;
  hostNames: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  address?: string;
  mainMessage?: string | null;
  musicUrl?: string | null;
  heroImageUrl?: string | null;
};

type PreviewDevice = "desktop" | "mobile";
type PreviewSection = "hero" | "story" | "details" | "rsvp" | "location";

type TemplateStyle = {
  background: string;
  accent: string;
  text: string;
  muted: string;
  overlay: string;
  surface: string;
  border: string;
};

type PreviewContext = {
  style: TemplateStyle;
  eventType: string;
  displayName: string;
  displayTitle: string;
  displayDate: string;
  displayTime: string;
  displayAddress: string;
  mainMessage: string;
  heroImageUrl?: string | null;
  hasMusic: boolean;
};

const previewTabs: { value: PreviewSection; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "story", label: "Historia" },
  { value: "details", label: "Datos" },
  { value: "rsvp", label: "RSVP" },
  { value: "location", label: "Ubicacion" }
];

export function EventLivePreview({
  templateId,
  templateSlug,
  title,
  hostNames,
  eventType,
  eventDate,
  eventTime,
  address,
  mainMessage,
  musicUrl,
  heroImageUrl
}: EventLivePreviewProps) {
  const [activeSection, setActiveSection] = useState<PreviewSection>("hero");
  const style = getTemplateStyle(templateSlug ?? templateId);
  const context: PreviewContext = {
    style,
    eventType: eventType || "quinceanos",
    displayName: hostNames || title || "Nombre del evento",
    displayTitle: title || "Mis 15 Anos",
    displayDate: formatPreviewDate(eventDate) || "Fecha del evento",
    displayTime: eventTime || "Hora",
    displayAddress: address || "Salon principal, ciudad",
    mainMessage: mainMessage || "Hace 15 anos comenzo mi historia. Hoy quiero compartir este momento especial con las personas que mas quiero.",
    heroImageUrl,
    hasMusic: Boolean(musicUrl)
  };

  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-4">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Vista previa del diseno</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulacion compacta de la invitacion. Puedes cambiar de seccion sin navegar la pagina.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {previewTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveSection(tab.value)}
            className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition ${
              activeSection === tab.value
                ? "border-accent bg-accent text-accent-foreground shadow-soft"
                : "border-border bg-muted/30 text-muted-foreground hover:border-accent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <PreviewFrame label="Preview Desktop" aspectClass="aspect-video w-full max-w-[420px]" section={activeSection} device="desktop" context={context} />
        <PreviewFrame label="Preview Mobile" aspectClass="aspect-[9/16] w-full max-w-[180px]" section={activeSection} device="mobile" context={context} />
      </div>
    </section>
  );
}

function PreviewFrame({
  label,
  aspectClass,
  section,
  device,
  context
}: {
  label: string;
  aspectClass: string;
  section: PreviewSection;
  device: PreviewDevice;
  context: PreviewContext;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className={`${aspectClass} overflow-hidden rounded-lg border shadow-soft`} style={{ background: context.style.background }}>
        {renderPreviewSection(section, device, context)}
      </div>
    </div>
  );
}

function renderPreviewSection(section: PreviewSection, device: PreviewDevice, context: PreviewContext) {
  if (section === "story") return renderStoryPreview(device, context);
  if (section === "details") return renderDetailsPreview(device, context);
  if (section === "rsvp") return renderRsvpPreview(device, context);
  if (section === "location") return renderLocationPreview(device, context);
  return renderHeroPreview(device, context);
}

function renderHeroPreview(device: PreviewDevice, context: PreviewContext) {
  const isMobile = device === "mobile";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <PreviewImage context={context} />
      <div className="absolute inset-0" style={{ background: context.style.overlay }} />
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-center">
        <p className="text-[0.5rem] font-bold uppercase tracking-[0.22em]" style={{ color: context.style.accent }}>
          {context.eventType}
        </p>
        <h3
          className={`${isMobile ? "mt-2 text-2xl" : "mt-2 text-4xl"} line-clamp-2 font-display font-bold leading-none drop-shadow`}
          style={{ color: context.style.text }}
        >
          {context.displayName}
        </h3>
        <p className={`${isMobile ? "mt-2 text-[0.62rem]" : "mt-3 text-xs"} font-semibold`} style={{ color: context.style.accent }}>
          {context.displayDate} · {context.displayTime}
        </p>
        <CountdownMini compact={isMobile} context={context} />
        <div
          className={`${isMobile ? "mt-3 px-3 py-2 text-[0.52rem]" : "mt-3 px-5 py-2 text-[0.6rem]"} mx-auto w-fit rounded-full font-bold uppercase tracking-[0.16em] shadow-[0_12px_30px_rgba(0,0,0,0.35)]`}
          style={{ background: context.style.accent, color: "#170607" }}
        >
          Confirmar asistencia
        </div>
      </div>
    </div>
  );
}

function renderStoryPreview(device: PreviewDevice, context: PreviewContext) {
  const isMobile = device === "mobile";

  return (
    <PreviewSectionShell context={context}>
      <div className={`${isMobile ? "p-4" : "grid h-full grid-cols-[0.85fr_1.15fr] gap-4 p-5"}`}>
        <div className={`${isMobile ? "mb-3 h-32" : "h-full"} overflow-hidden rounded-md`}>
          <PreviewImage context={context} />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-[0.52rem] font-bold uppercase tracking-[0.2em]" style={{ color: context.style.accent }}>
            Mis 15 Anos
          </p>
          <h3 className={`${isMobile ? "mt-2 text-xl" : "mt-2 text-3xl"} font-display leading-tight`} style={{ color: context.style.text }}>
            {context.displayTitle}
          </h3>
          <p className={`${isMobile ? "mt-2 line-clamp-5 text-[0.62rem]" : "mt-3 line-clamp-4 text-xs"} leading-relaxed`} style={{ color: context.style.muted }}>
            {context.mainMessage}
          </p>
          {context.hasMusic ? <MusicMini context={context} compact={isMobile} /> : null}
        </div>
      </div>
    </PreviewSectionShell>
  );
}

function renderDetailsPreview(device: PreviewDevice, context: PreviewContext) {
  const isMobile = device === "mobile";
  const items = [
    ["Fecha", context.displayDate],
    ["Hora", context.displayTime],
    ["Lugar", context.displayAddress],
    ["Codigo", "Elegante"]
  ];

  return (
    <PreviewSectionShell context={context}>
      <div className={`${isMobile ? "p-4" : "p-5"}`}>
        <PreviewSectionTitle title="Datos del evento" context={context} />
        <div className={`${isMobile ? "mt-4 grid gap-2" : "mt-4 grid grid-cols-2 gap-3"}`}>
          {items.map(([label, value]) => (
            <div key={label} className="rounded-md border p-3" style={{ background: context.style.surface, borderColor: context.style.border }}>
              <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em]" style={{ color: context.style.accent }}>
                {label}
              </p>
              <p className="mt-1 line-clamp-2 text-[0.68rem] font-semibold" style={{ color: context.style.text }}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className={`${isMobile ? "mt-3 grid gap-2" : "mt-4 flex gap-2"}`}>
          <MiniButton label="Como llegar" context={context} />
          <MiniButton label="Calendario" context={context} subtle />
        </div>
      </div>
    </PreviewSectionShell>
  );
}

function renderRsvpPreview(device: PreviewDevice, context: PreviewContext) {
  const isMobile = device === "mobile";

  return (
    <PreviewSectionShell context={context}>
      <div className={`${isMobile ? "p-4" : "grid h-full grid-cols-[0.9fr_1.1fr] gap-4 p-5"}`}>
        <div className="flex flex-col justify-center">
          <PreviewSectionTitle title="Confirma tu asistencia" context={context} />
          <p className={`${isMobile ? "mt-2 text-[0.62rem]" : "mt-3 text-xs"} leading-relaxed`} style={{ color: context.style.muted }}>
            Tu respuesta ayuda a preparar cada detalle de la celebracion.
          </p>
        </div>
        <div className={`${isMobile ? "mt-4" : ""} rounded-md border p-3`} style={{ background: context.style.surface, borderColor: context.style.border }}>
          <PreviewInput label="Nombre" value={context.displayName} context={context} />
          <PreviewInput label="Asistencia" value="Si, asistire" context={context} />
          <PreviewInput label="Acompanantes" value="2 personas" context={context} />
          <div className="mt-3 rounded-full px-3 py-2 text-center text-[0.55rem] font-bold uppercase tracking-[0.14em]" style={{ background: context.style.accent, color: "#170607" }}>
            Confirmar
          </div>
        </div>
      </div>
    </PreviewSectionShell>
  );
}

function renderLocationPreview(device: PreviewDevice, context: PreviewContext) {
  const isMobile = device === "mobile";

  return (
    <PreviewSectionShell context={context}>
      <div className={`${isMobile ? "p-4" : "grid h-full grid-cols-[1fr_1fr] gap-4 p-5"}`}>
        <div className="flex flex-col justify-center">
          <PreviewSectionTitle title="Ubicacion" context={context} />
          <p className={`${isMobile ? "mt-2 text-[0.64rem]" : "mt-3 text-xs"} line-clamp-3 leading-relaxed`} style={{ color: context.style.muted }}>
            {context.displayAddress}
          </p>
          <div className={`${isMobile ? "mt-3 grid gap-2" : "mt-4 flex gap-2"}`}>
            <MiniButton label="Abrir mapa" context={context} />
            <MiniButton label="Guardar fecha" context={context} subtle />
          </div>
        </div>
        <div className={`${isMobile ? "mt-4 h-28" : "h-full"} relative overflow-hidden rounded-md border`} style={{ borderColor: context.style.border }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(212,175,55,0.24),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.35))]" />
          <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: context.style.accent }} />
          <div className="absolute inset-x-4 bottom-4 h-1 rounded-full" style={{ background: context.style.accent }} />
        </div>
      </div>
    </PreviewSectionShell>
  );
}

function PreviewSectionShell({ children, context }: { children: ReactNode; context: PreviewContext }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 opacity-35">
        <PreviewImage context={context} />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.88),rgba(69,10,10,0.82),rgba(0,0,0,0.72))]" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function PreviewImage({ context }: { context: PreviewContext }) {
  if (!context.heroImageUrl) {
    return <div className="h-full w-full" style={{ background: context.style.background }} />;
  }

  return <img src={context.heroImageUrl} alt="" className="h-full w-full object-cover" />;
}

function PreviewSectionTitle({ title, context }: { title: string; context: PreviewContext }) {
  return (
    <div>
      <p className="text-[0.5rem] font-bold uppercase tracking-[0.22em]" style={{ color: context.style.accent }}>
        KAIS Invitaciones
      </p>
      <h3 className="mt-2 font-display text-2xl leading-tight" style={{ color: context.style.text }}>
        {title}
      </h3>
    </div>
  );
}

function CountdownMini({ compact, context }: { compact: boolean; context: PreviewContext }) {
  return (
    <div className={`${compact ? "mt-3 gap-1" : "mt-3 gap-2"} mx-auto flex justify-center`}>
      {["12", "08", "45"].map((value, index) => (
        <div key={`${value}-${index}`} className={`${compact ? "min-w-8 px-2 py-1" : "min-w-11 px-3 py-1.5"} rounded-md border`} style={{ background: context.style.surface, borderColor: context.style.border }}>
          <p className={`${compact ? "text-[0.66rem]" : "text-xs"} font-bold`} style={{ color: context.style.text }}>
            {value}
          </p>
          <p className="text-[0.38rem] uppercase tracking-[0.12em]" style={{ color: context.style.accent }}>
            {["dias", "hrs", "min"][index]}
          </p>
        </div>
      ))}
    </div>
  );
}

function MusicMini({ context, compact }: { context: PreviewContext; compact: boolean }) {
  return (
    <div className={`${compact ? "mt-3" : "mt-4"} flex items-center gap-2 rounded-full border px-3 py-2`} style={{ background: context.style.surface, borderColor: context.style.border }}>
      <span className="h-5 w-5 rounded-full" style={{ background: context.style.accent }} />
      <span className="text-[0.55rem] font-bold uppercase tracking-[0.16em]" style={{ color: context.style.text }}>
        Musica
      </span>
      <span className="h-1 flex-1 rounded-full bg-white/20">
        <span className="block h-1 w-1/3 rounded-full" style={{ background: context.style.accent }} />
      </span>
    </div>
  );
}

function MiniButton({ label, context, subtle = false }: { label: string; context: PreviewContext; subtle?: boolean }) {
  return (
    <div
      className="rounded-full border px-3 py-2 text-center text-[0.55rem] font-bold uppercase tracking-[0.12em]"
      style={{
        background: subtle ? context.style.surface : context.style.accent,
        borderColor: subtle ? context.style.border : context.style.accent,
        color: subtle ? context.style.text : "#170607"
      }}
    >
      {label}
    </div>
  );
}

function PreviewInput({ label, value, context }: { label: string; value: string; context: PreviewContext }) {
  return (
    <div className="mb-2">
      <p className="text-[0.48rem] font-bold uppercase tracking-[0.16em]" style={{ color: context.style.accent }}>
        {label}
      </p>
      <div className="mt-1 rounded-md border px-2 py-1.5 text-[0.58rem]" style={{ borderColor: context.style.border, color: context.style.text }}>
        {value}
      </div>
    </div>
  );
}

function getTemplateStyle(templateKey: string): TemplateStyle {
  if (templateKey.includes("rosas-rojas")) {
    return {
      background: "radial-gradient(circle at 15% 12%, #7f1d1d 0 12%, transparent 13%), linear-gradient(135deg, #170607, #5f0f14 58%, #2a090d)",
      accent: "#d4af37",
      text: "#fff7ed",
      muted: "rgba(255, 247, 237, 0.78)",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(23,6,7,0.9))",
      surface: "rgba(255,255,255,0.09)",
      border: "rgba(212,175,55,0.32)"
    };
  }

  if (templateKey.includes("princesa-rosa")) {
    return {
      background: "linear-gradient(135deg, #831843, #f9a8d4 58%, #fff1f2)",
      accent: "#f9a8d4",
      text: "#fff7ed",
      muted: "rgba(255, 247, 237, 0.78)",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.06), rgba(80,7,36,0.82))",
      surface: "rgba(255,255,255,0.12)",
      border: "rgba(249,168,212,0.36)"
    };
  }

  if (templateKey.includes("dorado-elegante")) {
    return {
      background: "linear-gradient(135deg, #050505, #3f2f10 58%, #d4af37)",
      accent: "#f5d572",
      text: "#fff7ed",
      muted: "rgba(255, 247, 237, 0.78)",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.88))",
      surface: "rgba(255,255,255,0.09)",
      border: "rgba(245,213,114,0.34)"
    };
  }

  if (templateKey.includes("floral-pastel")) {
    return {
      background: "linear-gradient(135deg, #7c2d12, #fed7aa 55%, #fdf2f8)",
      accent: "#fed7aa",
      text: "#fff7ed",
      muted: "rgba(255, 247, 237, 0.78)",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(67,20,7,0.76))",
      surface: "rgba(255,255,255,0.12)",
      border: "rgba(254,215,170,0.36)"
    };
  }

  return {
    background: "linear-gradient(135deg, #111827, #155e75 58%, #e11d48)",
    accent: "#f59e0b",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.76)",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.78))",
    surface: "rgba(255,255,255,0.1)",
    border: "rgba(245,158,11,0.32)"
  };
}

function formatPreviewDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
