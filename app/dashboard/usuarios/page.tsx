import { redirect } from "next/navigation";
import { createInternalUser, deleteInternalUser, toggleInternalUserActive, updateInternalUserRole } from "@/app/actions/internal-users";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listD1Profiles } from "@/lib/cloudflare/public-events";
import { canManageUsers } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/app/actions/events";
import type { Profile, UserRole } from "@/lib/types";

const INTERNAL_ROLES: UserRole[] = ["super_admin", "admin_kais", "diseñador", "soporte_evento", "vendedor"];

export default async function InternalUsersPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; deleted?: string; created_email?: string; created_password?: string; created_role?: string }>;
}) {
  const [profile, query] = await Promise.all([getCurrentProfile(), searchParams]);

  if (!canManageUsers(profile)) {
    redirect("/dashboard?error=Solo super_admin puede gestionar usuarios internos.");
  }

  const isCloudflareMode = process.env.USE_CLOUDFLARE_AUTH === "1";
  const { data } = isCloudflareMode
    ? { data: await listD1Profiles(false) }
    : await createAdminClient()
        .from("profiles")
        .select("id,full_name,email,role,is_active,created_at")
        .neq("role", "cliente")
        .order("created_at", { ascending: false });
  const users = (data ?? []) as Profile[];
  const activeUsersCount = users.filter((user) => user.is_active !== false).length;
  const credentialsMessage =
    query.created_email && query.created_password
      ? `Usuario interno KAIS creado:\n\nEmail: ${query.created_email}\nContraseña temporal: ${query.created_password}\nRol: ${query.created_role ?? ""}\nPanel: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`
      : null;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <section className="rounded-3xl border border-[#eadfd2] bg-[#fffaf3] px-8 py-5 shadow-[0_18px_50px_-42px_rgba(74,23,36,0.5)]">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-accent">Super admin</p>
            <h1 className="font-display text-4xl leading-none text-[#24171b]">Usuarios internos</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Gestiona el acceso del equipo KAIS. Los clientes de evento siguen usando /evento-login.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[280px]">
            <div className="rounded-xl border border-[#eadfd2] bg-white px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Usuarios</p>
              <p className="font-display text-3xl leading-none text-[#24171b]">{users.length}</p>
            </div>
            <div className="rounded-xl border border-[#eadfd2] bg-white px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Activos</p>
              <p className="font-display text-3xl leading-none text-[#24171b]">{activeUsersCount}</p>
            </div>
          </div>
        </div>
        {query.error ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{query.error}</p> : null}
        {query.deleted ? <p className="mt-3 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold">{query.deleted}</p> : null}
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(360px,0.62fr)_minmax(0,1fr)]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          {credentialsMessage ? (
            <Card className="overflow-hidden rounded-2xl border-secondary">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-lg">Credenciales temporales</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <pre className="whitespace-pre-wrap rounded-xl bg-secondary p-4 text-sm font-semibold">{credentialsMessage}</pre>
                <div className="mt-3">
                  <CopyLinkButton value={credentialsMessage} label="Copiar credenciales" copiedLabel="Credenciales copiadas" />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border-[#eadfd2] bg-white shadow-[0_18px_45px_-40px_rgba(74,23,36,0.55)]">
            <CardHeader className="border-b border-[#eadfd2] px-5 py-4">
              <CardTitle className="text-lg">Crear usuario interno</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 p-5">
              <form action={createInternalUser} className="grid gap-3">
                <Field label="Nombre">
                  <Input name="full_name" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required />
                </Field>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <Field label="Contraseña temporal">
                    <Input name="password" minLength={8} placeholder="KAIS-4829-21" />
                  </Field>
                  <Field label="Rol">
                    <Select name="role" defaultValue="soporte_evento">
                      {INTERNAL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-3 text-sm font-semibold">
                    <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
                    Usuario activo
                  </label>
                  <Button className="rounded-xl bg-[#141724] px-5 text-white hover:bg-[#202436]">Crear usuario</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border-[#eadfd2] bg-white shadow-[0_18px_45px_-40px_rgba(74,23,36,0.55)]">
          <CardHeader className="border-b border-[#eadfd2] px-5 py-4">
            <CardTitle className="text-lg">Equipo KAIS</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 overflow-y-auto p-4">
            <div className="grid gap-2">
              {users.map((user) => (
                <div key={user.id} className="grid gap-3 rounded-xl border border-[#eadfd2] bg-[#fffaf7] px-4 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-[#24171b]">{user.full_name || "-"}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${user.is_active === false ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {user.is_active === false ? "inactivo" : "activo"}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email || "Sin email"}</p>
                    <p className="text-xs text-muted-foreground">Alta {new Date(user.created_at).toLocaleDateString("es-PY")}</p>
                  </div>

                  <form action={updateInternalUserRole.bind(null, user.id)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Select name="role" defaultValue={user.role} className="h-10">
                      {user.role === "admin" ? <option value="admin">admin legacy</option> : null}
                      {INTERNAL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" variant="outline" className="h-10 rounded-lg border-[#d9cbbb]">Guardar</Button>
                  </form>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <form action={toggleInternalUserActive.bind(null, user.id, user.is_active === false)}>
                      <Button size="sm" variant={user.is_active === false ? "outline" : "danger"} className="rounded-lg">
                        {user.is_active === false ? "Activar" : "Desactivar"}
                      </Button>
                    </form>
                    <form action={deleteInternalUser.bind(null, user.id)}>
                      <Button size="sm" variant="danger" className="rounded-lg">Eliminar</Button>
                    </form>
                  </div>
                </div>
              ))}
              {users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#eadfd2] bg-[#fffaf7] p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay usuarios internos.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
