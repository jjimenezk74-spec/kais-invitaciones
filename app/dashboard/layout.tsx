import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import {
  canAccessDashboard,
  canCreateEvents,
  canManageClients,
  canManageEvents,
  canManageUsers,
} from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/profiles";
import { perfEnd, perfStart } from "@/lib/perf";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const layoutPerf = perfStart("dashboard-layout");
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    perfEnd(layoutPerf);
    redirect("/login?error=Inicia sesion para entrar al panel.");
  }

  if (!profile) {
    perfEnd(layoutPerf);
    redirect("/login?error=Sesion iniciada, pero no se encontro el perfil del usuario.");
  }

  if (!canAccessDashboard(profile)) {
    perfEnd(layoutPerf);
    redirect("/login?error=Tu usuario interno esta desactivado. Contacta al super admin de KAIS.");
  }

  perfEnd(layoutPerf);

  return (
    <div className="dashboard-root h-screen overflow-hidden bg-background">
      <header className="h-16 shrink-0 border-b bg-white/92 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
          <span className="select-none text-sm font-black tracking-[0.22em]">
            KAIS INVITACIONES
          </span>
          <DashboardNav
            canManageClients={canManageClients(profile.role)}
            canCreateEvents={canCreateEvents(profile.role)}
            canManageEvents={canManageEvents(profile.role)}
            canManageUsers={canManageUsers(profile.role)}
          />
          <span className="hidden rounded-md border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
            Rol: {profile.role}
          </span>
          <form action={signOut}>
            <Button variant="outline" size="sm">Salir</Button>
          </form>
        </div>
      </header>
      <main className="mx-auto h-[calc(100vh-4rem)] max-w-7xl overflow-hidden px-4 py-4">{children}</main>
    </div>
  );
}
