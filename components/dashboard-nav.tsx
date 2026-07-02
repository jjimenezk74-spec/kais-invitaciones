"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardNavProps = {
  canManageClients: boolean;
  canCreateEvents: boolean;
  canManageEvents: boolean;
  canManageUsers: boolean;
};

const navLinkBase =
  "rounded-full px-3 py-2 text-sm font-bold transition";
const navLinkIdle =
  "text-[#1f2430] hover:bg-[#fff4e8] hover:text-[#5b1728]";
const navLinkActive =
  "bg-[#5b1728] text-white shadow-[0_10px_28px_-20px_rgba(91,23,40,0.85)]";

export function DashboardNav({
  canManageClients,
  canCreateEvents,
  canManageEvents,
  canManageUsers
}: DashboardNavProps) {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClassName = (href: string) =>
    `${navLinkBase} ${isActive(href) ? navLinkActive : navLinkIdle}`;

  return (
    <nav className="hidden items-center gap-1 rounded-full border border-[#eadfd2] bg-white/72 p-1 text-sm font-semibold shadow-[0_12px_34px_-30px_rgba(74,23,36,0.55)] md:flex">
      <Link href="/dashboard" className={linkClassName("/dashboard")}>
        Dashboard
      </Link>
      {canManageClients ? (
        <Link href="/dashboard/clientes" className={linkClassName("/dashboard/clientes")}>
          Clientes
        </Link>
      ) : null}
      {canCreateEvents ? (
        <Link href="/dashboard/eventos/nuevo" className={linkClassName("/dashboard/eventos/nuevo")}>
          Crear evento
        </Link>
      ) : null}
      {canManageEvents ? (
        <Link href="/dashboard/admin" className={linkClassName("/dashboard/admin")}>
          Admin
        </Link>
      ) : null}
      {canManageUsers ? (
        <Link href="/dashboard/usuarios" className={linkClassName("/dashboard/usuarios")}>
          Usuarios
        </Link>
      ) : null}
    </nav>
  );
}
