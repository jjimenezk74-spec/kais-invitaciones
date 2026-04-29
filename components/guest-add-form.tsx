"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  action: (fd: FormData) => Promise<void>;
};

export function GuestAddForm({ action }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await action(fd);
      setOpen(false);
      formRef.current?.reset();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Agregar invitado
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-semibold text-foreground">Nuevo invitado</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Nombre *</label>
          <input
            name="guest_name"
            required
            disabled={isPending}
            className="h-10 rounded-md border bg-white px-3 text-sm placeholder:text-muted-foreground disabled:opacity-60"
            placeholder="Nombre del invitado"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium">WhatsApp *</label>
          <input
            name="phone"
            required
            disabled={isPending}
            className="h-10 rounded-md border bg-white px-3 text-sm placeholder:text-muted-foreground disabled:opacity-60"
            placeholder="595..."
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            disabled={isPending}
            className="h-10 rounded-md border bg-white px-3 text-sm placeholder:text-muted-foreground disabled:opacity-60"
            placeholder="Email opcional"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Pases / Acompanantes</label>
          <input
            name="max_companions"
            type="number"
            min="0"
            defaultValue="0"
            disabled={isPending}
            className="h-10 rounded-md border bg-white px-3 text-sm disabled:opacity-60"
          />
        </div>

        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar invitado"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
