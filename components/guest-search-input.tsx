"use client";

import { Search } from "lucide-react";

export function GuestSearchInput() {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll<HTMLTableRowElement>("[data-guest-row]").forEach((row) => {
      const name  = (row.getAttribute("data-guest-name")  ?? "").toLowerCase();
      const phone = (row.getAttribute("data-guest-phone") ?? "").toLowerCase();
      row.style.display = !q || name.includes(q) || phone.includes(q) ? "" : "none";
    });
  }

  return (
    <div className="relative max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        placeholder="Buscar invitado..."
        onChange={handleChange}
        className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}
