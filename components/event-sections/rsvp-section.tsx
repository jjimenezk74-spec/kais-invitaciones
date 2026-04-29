/**
 * RsvpSection -- deferred async Server Component
 * Carga: rsvps completos
 * Renderiza: Confirmaciones card -- diseno premium
 */
import { UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Rsvp } from "@/lib/types";

function AttendingBadge({ attending }: { attending: boolean }) {
  return attending ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      Asistira
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
      No asiste
    </span>
  );
}

function EmptyRsvps() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <UserCheck className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Sin confirmaciones aun</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Las confirmaciones apareceran aqui cuando los invitados respondan la invitacion.
        </p>
      </div>
    </div>
  );
}

export async function RsvpSection({ eventId }: { eventId: string }) {
  const sectionLabel = perfStart(`rsvp-section-${eventId}`);
  const admin = createAdminClient();
  const [{ data: rsvpsData }, { data: guestQuotaData }] = await Promise.all([
    timed(
      "[KAIS PERF] rsvp full-list",
      admin
        .from("rsvps")
        .select("id,event_id,guest_name,phone,email,attending,companions,message,dietary_restrictions,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
    ),
    timed(
      "[KAIS PERF] rsvp guest-quotas",
      admin
        .from("event_guests")
        .select("rsvp_id,max_companions")
        .eq("event_id", eventId)
        .not("rsvp_id", "is", null)
    )
  ]);
  perfEnd(sectionLabel);

  const rsvps = (rsvpsData ?? []) as Rsvp[];
  const quotaByRsvpId = new Map(
    (guestQuotaData ?? []).map((guest) => [guest.rsvp_id as string, Number(guest.max_companions ?? 0) + 1])
  );
  const attendingCount    = rsvps.filter((r) => r.attending).length;
  const notAttendingCount = rsvps.filter((r) => !r.attending).length;

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-accent" />
            Confirmaciones
          </CardTitle>
          {rsvps.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                <span className="font-semibold text-emerald-600">{attendingCount}</span> asistiran
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-red-500">{notAttendingCount}</span> no asisten
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {rsvps.length === 0 ? (
          <EmptyRsvps />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Nombre</th>
                    <th className="pr-4">Estado</th>
                    <th className="pr-4 text-center">Asisten</th>
                    <th className="pr-4">Contacto</th>
                    <th className="pr-2">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {rsvps.map((rsvp) => (
                    <tr
                      key={rsvp.id}
                      className="border-b last:border-0 align-middle transition-colors hover:bg-muted/30"
                    >
                      <td className="py-3 pr-4 font-medium text-foreground">{rsvp.guest_name}</td>
                      <td className="pr-4"><AttendingBadge attending={rsvp.attending} /></td>
                      <td className="pr-4 text-center">
                        {rsvp.attending ? (
                          <>
                            <p className="font-semibold">
                              {rsvp.companions + 1}
                              {quotaByRsvpId.has(rsvp.id) ? ` de ${quotaByRsvpId.get(rsvp.id)}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {rsvp.companions <= 0
                                ? "Sin acompanante"
                                : `+${rsvp.companions} acompanante${rsvp.companions === 1 ? "" : "s"}`}
                            </p>
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-red-600">No asiste</span>
                        )}
                      </td>
                      <td className="pr-4 text-muted-foreground">
                        {rsvp.email || rsvp.phone || <span className="opacity-40">-</span>}
                      </td>
                      <td className="max-w-[200px] pr-2 text-muted-foreground">
                        {rsvp.message
                          ? <span className="line-clamp-2">{rsvp.message}</span>
                          : <span className="opacity-40">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {rsvps.length} respuesta{rsvps.length !== 1 ? "s" : ""} en total
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
