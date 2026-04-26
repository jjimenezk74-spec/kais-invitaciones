import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAIS INVITACIONES",
  description: "Plataforma SaaS para crear, publicar y gestionar invitaciones digitales premium."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
