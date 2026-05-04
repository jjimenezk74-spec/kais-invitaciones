"use client";

import { useEffect } from "react";

export function RsvpWhatsAppRedirect({
  phone,
  message
}: {
  phone: string;
  message: string;
}) {
  const normalizedPhone = phone.replace(/[^\d]/g, "");
  const href = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

  useEffect(() => {
    window.location.href = href;
  }, [href]);

  return (
    <a
      href={href}
      className="mt-4 inline-flex rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-black uppercase tracking-[0.14em] text-black"
    >
      Abrir WhatsApp
    </a>
  );
}
