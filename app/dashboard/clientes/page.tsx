import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientRecord, toggleClientStatus, updateClientRecord } from "@/app/actions/clients";
import { getCurrentProfile } from "@/app/actions/events";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canManageClients } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, Event } from "@/lib/types";

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const [profile, query] = await Promise.all([getCurrentProfile(), searchParams]);

  if (!canManageClients(profile?.role)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para gestionar clientes.");
  }

  const admin = createAdminClient();
  const [{ data: clientsData }, { data: eventsData }] = await Promise.all([
    admin.from("clients").select("*").order("created_at", { ascending: false }),
    admin.from("events").select("id,title,status,client_id").order("created_at", { ascending: false })
  ]);
  const clients = (clientsData ?? []) as Client[];
  const events = (eventsData ?? []) as Pick<Event, "id" | "title" | "status" | "client_id">[];

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">KAIS</p>
        <h1 className="font-display text-4xl font-bold">Clientes</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Registra personas o empresas que contratan eventos. No necesitan usuario de login.
        </p>
        {query.error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p> : null}
        {query.created ? <p className="mt-4 rounded-md bg-secondary p-3 text-sm font-semibold">{query.created}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createClientRecord} className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre del cliente o empresa">
              <Input name="name" required />
            </Field>
            <Field label="Persona de contacto">
              <Input name="contact_name" />
            </Field>
            <Field label="Telefono">
              <Input name="phone" />
            </Field>
            <Field label="WhatsApp">
              <Input name="whatsapp" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field label="Estado">
              <Select name="status" defaultValue="activo">
                <option value="activo">activo</option>
                <option value="inactivo">inactivo</option>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Notas">
                <Textarea name="notes" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Button>Crear cliente</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        {clients.map((client) => {
          const clientEvents = events.filter((event) => event.client_id === client.id);
          return (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <CardTitle>{client.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.contact_name || "Sin contacto"} · {client.status}
                    </p>
                  </div>
                  <form action={toggleClientStatus.bind(null, client.id, client.status === "activo" ? "inactivo" : "activo")}>
                    <Button size="sm" variant={client.status === "activo" ? "danger" : "outline"}>
                      {client.status === "activo" ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <form action={updateClientRecord.bind(null, client.id)} className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre">
                    <Input name="name" defaultValue={client.name} required />
                  </Field>
                  <Field label="Contacto">
                    <Input name="contact_name" defaultValue={client.contact_name ?? ""} />
                  </Field>
                  <Field label="Telefono">
                    <Input name="phone" defaultValue={client.phone ?? ""} />
                  </Field>
                  <Field label="WhatsApp">
                    <Input name="whatsapp" defaultValue={client.whatsapp ?? ""} />
                  </Field>
                  <Field label="Email">
                    <Input name="email" type="email" defaultValue={client.email ?? ""} />
                  </Field>
                  <Field label="Estado">
                    <Select name="status" defaultValue={client.status}>
                      <option value="activo">activo</option>
                      <option value="inactivo">inactivo</option>
                    </Select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Notas">
                      <Textarea name="notes" defaultValue={client.notes ?? ""} />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Button variant="outline">Guardar cambios</Button>
                  </div>
                </form>

                <div className="rounded-md border bg-background p-4">
                  <p className="font-semibold">Eventos asociados</p>
                  <div className="mt-3 grid gap-2">
                    {clientEvents.map((event) => (
                      <Link key={event.id} href={`/dashboard/eventos/${event.id}`} className="text-sm font-semibold text-accent">
                        {event.title} · {event.status}
                      </Link>
                    ))}
                    {clientEvents.length === 0 ? <p className="text-sm text-muted-foreground">Sin eventos asociados todavia.</p> : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {clients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">Todavia no hay clientes registrados.</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
