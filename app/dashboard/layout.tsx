import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { getCurrentUserProfile, isKaisAdmin } from "@/lib/profiles";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?error=Inicia sesion para entrar al panel.");
  }

  if (!profile) {
    redirect("/login?error=Sesion iniciada, pero no se encontro el perfil del usuario.");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-sm font-black tracking-[0.22em]">
            KAIS INVITACIONES
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-semibold md:flex">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/eventos/nuevo">Crear evento</Link>
            {isKaisAdmin(profile.role) ? <Link href="/dashboard/admin">Admin</Link> : null}
          </nav>
          <span className="hidden rounded-md border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
            Rol: {profile.role}
          </span>
          <form action={signOut}>
            <Button variant="outline" size="sm">Salir</Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
