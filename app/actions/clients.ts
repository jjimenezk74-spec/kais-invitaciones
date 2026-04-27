"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageClients, getCurrentUserProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createClientRecord(formData: FormData) {
  const userId = await assertCanManageClients();
  const payload = getClientPayload(formData);

  if (!payload.name) {
    redirect("/dashboard/clientes?error=El nombre del cliente es obligatorio.");
  }

  const { error } = await createAdminClient()
    .from("clients")
    .insert({
      ...payload,
      created_by: userId
    });

  if (error) {
    redirect(`/dashboard/clientes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/clientes");
  redirect("/dashboard/clientes?created=Cliente creado correctamente.");
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  await assertCanManageClients();
  const payload = getClientPayload(formData);

  if (!payload.name) {
    redirect(`/dashboard/clientes?error=El nombre del cliente es obligatorio.`);
  }

  const { error } = await createAdminClient().from("clients").update(payload).eq("id", clientId);

  if (error) {
    redirect(`/dashboard/clientes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/clientes");
}

export async function toggleClientStatus(clientId: string, status: "activo" | "inactivo") {
  await assertCanManageClients();
  const { error } = await createAdminClient().from("clients").update({ status }).eq("id", clientId);

  if (error) {
    redirect(`/dashboard/clientes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/clientes");
}

async function assertCanManageClients() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?error=Inicia sesion para gestionar clientes.");
  }

  if (!canManageClients(profile?.role)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para gestionar clientes.");
  }

  return user.id;
}

function getClientPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact_name: nullable(formData.get("contact_name")),
    phone: nullable(formData.get("phone")),
    whatsapp: nullable(formData.get("whatsapp")),
    email: nullable(formData.get("email")),
    notes: nullable(formData.get("notes")),
    status: String(formData.get("status") ?? "activo") === "inactivo" ? "inactivo" : "activo"
  };
}

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}
