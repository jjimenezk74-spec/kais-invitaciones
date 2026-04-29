/**
 * AccesoSection — deferred async Server Component
 * Carga: event_logins (solo si canManage)
 * Renderiza: Acceso del cliente card
 */
import { KeyRound } from "lucide-react";
import {
  createEventLogin,
  resetEventLoginPassword,
  toggleEventLoginActive,
  updateEventLoginExpiration,
} from "@/app/actions/event-logins";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventLogin } from "@/lib/types";
import { buildCredentialsMessage } from "@/lib/utils";

type Props = {
  event: Event;
  canManage: boolean;
  profileRole?: string;
  loginUsername?: string;
  loginPassword?: string;
  accessExisting?: string;
  clientPanelUrl: string;
};

export async function AccesoSection({
  event,
  canManage,
  profileRole,
  loginUsername,
  loginPassword,
  accessExisting,
  clientPanelUrl,
}: Props) {
  const sectionLabel = perfStart(`acceso-section-${event.id}`);
  const admin = createAdminClient();

  const { data: loginData } = canManage
    ? await timed(
        "[KAIS PERF] acceso event_logins",
        admin
          .from("event_logins")
          .select("id,event_id,username,password_hash,active,expires_at,last_login_at,created_at,created_by")
          .eq("event_id", event.id)
          .order("created_at", { ascending: false })
      )
    : { data: [] };
  perfEnd(sectionLabel);

  const eventLogins       = (loginData ?? []) as EventLogin[];
  const latestCredentials =
    loginUsername && loginPassword
      ? buildCredentialsMessage(loginUsername, loginPassword)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Acceso del cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!canManage ? (
          <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            Tu sesion esta activa, pero tu rol actual es{" "}
            <span className="font-semibold">{profileRole ?? "sin perfil"}</span>. Para generar
            accesos de cliente necesitas rol admin o admin_kais.
          </div>
        ) : null}

        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-semibold">Panel del cliente</p>
          <p className="mt-2 break-all text-sm text-muted-foreground">{clientPanelUrl}</p>
        </div>

        {latestCredentials ? (
          <div className="rounded-lg border bg-secondary p-4">
            <p className="font-semibold">Credenciales generadas</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-foreground">
              {latestCredentials}
            </pre>
            <div className="mt-3">
              <CopyLinkButton
                value={latestCredentials}
                label="Copiar acceso para WhatsApp"
                copiedLabel="Acceso copiado"
              />
            </div>
          </div>
        ) : null}

        {accessExisting ? (
          <div className="rounded-lg border bg-background p-4">
            <p className="font-semibold">Este evento ya tiene acceso creado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Usuario: <span className="font-semibold text-foreground">{accessExisting}</span>. Usa
              resetear contrasena si necesitas enviar una nueva clave.
            </p>
          </div>
        ) : null}

        {canManage ? (
          <form action={createEventLogin.bind(null, event.id)}>
            <Button className="w-full sm:w-fit">
              <KeyRound className="h-4 w-4" />
              Generar acceso del cliente
            </Button>
          </form>
        ) : null}

        <div className="grid gap-3">
          {eventLogins.map((login) => (
            <div
              key={login.id}
              className="grid gap-4 rounded-lg border bg-background p-4 lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div>
                <p className="font-semibold">{login.username}</p>
                <p className="text-sm text-muted-foreground">
                  Estado: {login.active ? "activo" : "desactivado"} · Expira:{" "}
                  {login.expires_at
                    ? new Date(login.expires_at).toLocaleString("es-PY")
                    : "sin expiracion"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ultimo ingreso:{" "}
                  {login.last_login_at
                    ? new Date(login.last_login_at).toLocaleString("es-PY")
                    : "sin ingresos"}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <form action={resetEventLoginPassword.bind(null, login.id, event.id)}>
                  <Button variant="outline" size="sm">Reset contrasena</Button>
                </form>
                <form action={toggleEventLoginActive.bind(null, login.id, event.id, !login.active)}>
                  <Button variant={login.active ? "danger" : "outline"} size="sm">
                    {login.active ? "Desactivar" : "Activar"}
                  </Button>
                </form>
              </div>
              <form
                action={updateEventLoginExpiration.bind(null, login.id, event.id)}
                className="flex flex-col gap-2 sm:flex-row lg:col-span-2"
              >
                <input
                  name="expires_at"
                  type="datetime-local"
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                  defaultValue={login.expires_at ? login.expires_at.slice(0, 16) : ""}
                />
                <Button variant="outline" size="sm">Guardar expiracion</Button>
              </form>
            </div>
          ))}
          {eventLogins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavia no hay acceso de cliente para este evento.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
