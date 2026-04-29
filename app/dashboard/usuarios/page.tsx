import { redirect } from "next/navigation";
import { createInternalUser, deleteInternalUser, toggleInternalUserActive, updateInternalUserRole } from "@/app/actions/internal-users";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id,full_name,email,role,is_active,created_at")
    .neq("role", "cliente")
    .order("created_at", { ascending: false });
  const users = (data ?? []) as Profile[];
  const credentialsMessage =
    query.created_email && query.created_password
      ? `Usuario interno KAIS creado:\n\nEmail: ${query.created_email}\nContrasena temporal: ${query.created_password}\nRol: ${query.created_role ?? ""}\nPanel: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`
      : null;

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Super admin</p>
        <h1 className="font-display text-4xl font-bold">Usuarios internos</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Gestiona el acceso del equipo KAIS. Los clientes de evento siguen usando /evento-login.
        </p>
        {query.error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p> : null}
        {query.deleted ? <p className="mt-4 rounded-md bg-secondary p-3 text-sm font-semibold">{query.deleted}</p> : null}
      </div>

      {credentialsMessage ? (
        <Card className="border-secondary">
          <CardHeader>
            <CardTitle>Credenciales temporales</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-secondary p-4 text-sm font-semibold">{credentialsMessage}</pre>
            <div className="mt-3">
              <CopyLinkButton value={credentialsMessage} label="Copiar credenciales" copiedLabel="Credenciales copiadas" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Crear usuario interno</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createInternalUser} className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input name="full_name" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Contrasena temporal">
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
            <label className="flex items-center gap-3 text-sm font-semibold md:col-span-2">
              <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
              Usuario activo
            </label>
            <div className="md:col-span-2">
              <Button>Crear usuario</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo KAIS</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-3">Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b align-top">
                  <td className="py-3 font-medium">{user.full_name || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>
                    <form action={updateInternalUserRole.bind(null, user.id)} className="flex gap-2">
                      <Select name="role" defaultValue={user.role} className="h-9">
                        {user.role === "admin" ? <option value="admin">admin legacy</option> : null}
                        {INTERNAL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Select>
                      <Button size="sm" variant="outline">Guardar</Button>
                    </form>
                  </td>
                  <td>{user.is_active === false ? "inactivo" : "activo"}</td>
                  <td>{new Date(user.created_at).toLocaleDateString("es-PY")}</td>
                  <td className="flex flex-wrap gap-2">
                    <form action={toggleInternalUserActive.bind(null, user.id, user.is_active === false)}>
                      <Button size="sm" variant={user.is_active === false ? "outline" : "danger"}>
                        {user.is_active === false ? "Activar" : "Desactivar"}
                      </Button>
                    </form>
                    <form action={deleteInternalUser.bind(null, user.id)}>
                      <Button size="sm" variant="danger">Eliminar</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
