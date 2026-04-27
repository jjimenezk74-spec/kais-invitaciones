"use client";

type EventLivePreviewProps = {
  templateId: string;
  templateSlug?: string;
  title: string;
  hostNames: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  heroImageUrl?: string | null;
};

type TemplateStyle = {
  background: string;
  accent: string;
  text: string;
  overlay: string;
};

export function EventLivePreview({
  templateId,
  templateSlug,
  title,
  hostNames,
  eventType,
  eventDate,
  eventTime,
  heroImageUrl
}: EventLivePreviewProps) {
  const style = getTemplateStyle(templateSlug ?? templateId);
  const displayName = hostNames || title || "Nombre del evento";
  const displayDate = [formatPreviewDate(eventDate), eventTime].filter(Boolean).join(" · ") || "Fecha y hora";

  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-4">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Vista previa del diseño</p>
        <p className="mt-1 text-sm text-muted-foreground">Miniatura visual del hero. No afecta la invitación hasta guardar.</p>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <PreviewFrame
          label="Preview Desktop"
          aspectClass="aspect-video w-full max-w-[360px]"
          style={style}
          heroImageUrl={heroImageUrl}
          eventType={eventType}
          displayName={displayName}
          displayDate={displayDate}
        />
        <PreviewFrame
          label="Preview Mobile"
          aspectClass="aspect-[9/16] w-full max-w-[160px]"
          style={style}
          heroImageUrl={heroImageUrl}
          eventType={eventType}
          displayName={displayName}
          displayDate={displayDate}
          compact
        />
      </div>
    </section>
  );
}

function PreviewFrame({
  label,
  aspectClass,
  style,
  heroImageUrl,
  eventType,
  displayName,
  displayDate,
  compact = false
}: {
  label: string;
  aspectClass: string;
  style: TemplateStyle;
  heroImageUrl?: string | null;
  eventType: string;
  displayName: string;
  displayDate: string;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className={`${aspectClass} overflow-hidden rounded-lg border shadow-soft`} style={{ background: style.background }}>
        <div className="relative h-full w-full">
          {heroImageUrl ? (
            <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0" style={{ background: style.overlay }} />
          <div className="absolute inset-0 flex flex-col justify-end p-4 text-center">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.22em]" style={{ color: style.accent }}>
              {eventType || "tipo de evento"}
            </p>
            <h3
              className={`${compact ? "mt-2 text-2xl" : "mt-3 text-4xl"} line-clamp-2 font-display font-bold leading-none drop-shadow`}
              style={{ color: style.text }}
            >
              {displayName}
            </h3>
            <p className={`${compact ? "mt-2 text-[0.62rem]" : "mt-3 text-xs"} font-semibold`} style={{ color: style.accent }}>
              {displayDate}
            </p>
            <div
              className={`${compact ? "mt-3 px-3 py-2 text-[0.5rem]" : "mt-4 px-4 py-2 text-[0.58rem]"} mx-auto rounded-full font-bold uppercase tracking-[0.18em]`}
              style={{ background: style.accent, color: "#170607" }}
            >
              Confirmar
            </div>
          </div>
        </div>
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
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(23,6,7,0.82))"
    };
  }

  if (templateKey.includes("princesa-rosa")) {
    return {
      background: "linear-gradient(135deg, #831843, #f9a8d4 58%, #fff1f2)",
      accent: "#f9a8d4",
      text: "#fff7ed",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.06), rgba(80,7,36,0.74))"
    };
  }

  if (templateKey.includes("dorado-elegante")) {
    return {
      background: "linear-gradient(135deg, #050505, #3f2f10 58%, #d4af37)",
      accent: "#f5d572",
      text: "#fff7ed",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.82))"
    };
  }

  if (templateKey.includes("floral-pastel")) {
    return {
      background: "linear-gradient(135deg, #7c2d12, #fed7aa 55%, #fdf2f8)",
      accent: "#fed7aa",
      text: "#fff7ed",
      overlay: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(67,20,7,0.68))"
    };
  }

  return {
    background: "linear-gradient(135deg, #111827, #155e75 58%, #e11d48)",
    accent: "#f59e0b",
    text: "#ffffff",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.72))"
  };
}

function formatPreviewDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
