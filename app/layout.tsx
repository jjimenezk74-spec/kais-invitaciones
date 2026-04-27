import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Great_Vibes, Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap"
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-romantic-script",
  display: "swap"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-luxury-serif",
  display: "swap"
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-royal-classic",
  display: "swap"
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-modern-chic",
  display: "swap"
});

export const metadata: Metadata = {
  title: "KAIS INVITACIONES",
  description: "Plataforma SaaS para crear, publicar y gestionar invitaciones digitales premium."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${cormorant.variable} ${greatVibes.variable} ${playfair.variable} ${cinzel.variable} ${montserrat.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
