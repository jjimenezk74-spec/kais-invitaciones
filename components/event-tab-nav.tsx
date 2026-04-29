"use client";

import Link from "next/link";

export const EVENT_TABS = [
  { key: "resumen",        label: "Resumen" },
  { key: "invitados",      label: "Invitados" },
  { key: "confirmaciones", label: "Confirmaciones" },
  { key: "publicacion",    label: "Publicacion" },
  { key: "acceso",         label: "Acceso cliente" },
  { key: "ajustes",        label: "Ajustes" },
] as const;

export type EventTabKey = (typeof EVENT_TABS)[number]["key"];

const ALL_KEYS = EVENT_TABS.map((t) => t.key) as string[];

export function EventTabNav({
  eventId,
  activeTab,
}: {
  eventId: string;
  activeTab: string;
}) {
  const resolved = ALL_KEYS.includes(activeTab) ? activeTab : "resumen";

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <nav className="flex min-w-max gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {EVENT_TABS.map((tab) => {
          const isActive = resolved === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/dashboard/eventos/${eventId}?tab=${tab.key}`}
              className={[
                "rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
