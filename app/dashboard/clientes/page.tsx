import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Edit3, Eye, Plus, Search, UsersRound } from "lucide-react";
import {
  createClientRecord,
  deleteClientRecord,
  toggleClientStatus,
  updateClientRecord,
} from "@/app/actions/clients";
import { getCurrentProfile } from "@/app/actions/events";
import { DeleteClientButton } from "@/components/delete-client-button";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { perfEnd, perfStart, timed } from "@/lib/perf";
import { canManageClients } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, CommercialPlan, Event } from "@/lib/types";

type SearchParams = {
  error?: string;
  created?: string;
  create?: string;
  edit?: string;
  q?: string;
  status?: string;
  plan?: string;
  events?: string;
};

type ClientEvent = Pick<Event, "id" | "title" | "status" | "client_id" | "event_date">;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [profile, query] = await Promise.all([getCurrentProfile(), searchParams]);

  if (!canManageClients(profile?.role)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para gestionar clientes.");
  }

  const admin = createAdminClient();
  const pagePerf = perfStart("dashboard-clientes");
  const [{ data: clientsData }, { data: eventsData }, { data: plansData }] = await Promise.all([
    timed(
      "clientes-list",
      admin
        .from("clients")
        .select("id,name,contact_name,plan_id,phone,whatsapp,email,notes,status,created_at,created_by")
        .order("created_at", { ascending: false })
    ),
    timed(
      "clientes-events-summary",
      admin.from("events").select("id,title,status,client_id,event_date").order("created_at", { ascending: false })
    ),
    timed(
      "clientes-plans",
      admin
        .from("commercial_plans")
        .select("id,name,slug,price_label,features,active,created_at")
        .eq("active", true)
        .order("created_at", { ascending: true })
    ),
  ]);
  perfEnd(pagePerf);

  const clients = (clientsData ?? []) as Client[];
  const events = (eventsData ?? []) as ClientEvent[];
  const plans = (plansData ?? []) as CommercialPlan[];
  const filteredClients = filterClients(clients, query);
  const editingClient = clients.find((client) => client.id === query.edit) ?? null;
  const eventsClient = clients.find((client) => client.id === query.events) ?? null;
  const selectedClientEvents = eventsClient
    ? events.filter((event) => event.client_id === eventsClient.id)
    : [];
  const showCreate = query.create === "1";

  return (
    <div className="grid gap-7">
      <section className="rounded-2xl border border-[#eadfd2] bg-[linear-gradient(135deg,#fffaf2,#f7efe4)] p-6 shadow-[0_28px_90px_-64px_rgba(17,24,39,0.75)] md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7b1631]">KAIS</p>
            <h1 className="mt-2 font-display text-4xl font-bold text-[#1f1215]">Clientes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Gestiona personas y empresas que contratan eventos. Asociarlos te ayuda a ordenar historial, planes y seguimiento.
            </p>
            {query.error ? (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p>
            ) : null}
            {query.created ? (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{query.created}</p>
            ) : null}
          </div>
          <Button asChild className="bg-[#6f1029] text-white hover:bg-[#581023]">
            <Link href="/dashboard/clientes?create=1">
              <Plus className="h-4 w-4" />
              Crear cliente
            </Link>
          </Button>
        </div>
      </section>

      {(showCreate || editingClient) ? (
        <Card className="border-[#eadfd2] bg-white shadow-[0_24px_90px_-64px_rgba(17,24,39,0.8)]">
          <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-[#1f1215]">
                {editingClient ? "Editar cliente" : "Crear cliente"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {editingClient ? "Actualiza los datos comerciales del cliente." : "Carga los datos mínimos para asociarle eventos."}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/clientes">Cancelar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ClientForm client={editingClient} plans={plans} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#eadfd2] bg-white">
        <CardContent className="p-4 md:p-5">
          <form className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]" action="/dashboard/clientes">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Buscar por nombre, contacto, teléfono, WhatsApp o email"
                className="h-11 pl-9"
              />
            </div>
            <Select name="status" defaultValue={query.status ?? "todos"}>
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </Select>
            <Select name="plan" defaultValue={query.plan ?? "todos"}>
              <option value="todos">Todos los planes</option>
              <option value="sin-plan">Sin plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </Select>
            <Button variant="outline">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-3">
        {eventsClient ? (
          <Card className="border-[#eadfd2] bg-[#fffaf2]">
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-[#1f1215]">Eventos de {eventsClient.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedClientEvents.length} {selectedClientEvents.length === 1 ? "evento asociado" : "eventos asociados"}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/clientes">Cerrar</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-2">
              {selectedClientEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/dashboard/eventos/${event.id}`}
                  className="flex flex-col justify-between gap-1 rounded-lg border bg-white px-4 py-3 text-sm transition hover:bg-muted sm:flex-row sm:items-center"
                >
                  <span className="font-semibold text-[#3b1b24]">{event.title}</span>
                  <span className="text-muted-foreground">{event.status} · {event.event_date}</span>
                </Link>
              ))}
              {selectedClientEvents.length === 0 ? (
                <p className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
                  Este cliente todavía no tiene eventos asociados.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {filteredClients.map((client) => {
          const clientEvents = events.filter((event) => event.client_id === client.id);
          const plan = plans.find((item) => item.id === client.plan_id);
          const contact = client.whatsapp || client.phone || "Sin teléfono";

          return (
            <Card key={client.id} className="border-[#eadfd2] bg-white shadow-[0_18px_64px_-56px_rgba(17,24,39,0.7)]">
              <CardContent className="grid gap-4 p-5 xl:grid-cols-[1.15fr_0.75fr_0.7fr_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#7b1631]" />
                    <p className="truncate text-lg font-bold text-[#1f1215]">{client.name}</p>
                    <span className={client.status === "activo" ? statusClassActive : statusClassInactive}>
                      {client.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {client.contact_name || "Sin persona de contacto"}
                  </p>
                </div>

                <div className="grid gap-1 text-sm">
                  <p className="font-semibold text-[#3b1b24]">{plan?.name ?? "Sin plan"}</p>
                  <p className="text-muted-foreground">{plan?.price_label ?? "Plan no asignado"}</p>
                </div>

                <div className="grid gap-1 text-sm">
                  <p className="font-semibold text-[#3b1b24]">{contact}</p>
                  <p className="truncate text-muted-foreground">{client.email || "Sin email"}</p>
                  <p className="flex items-center gap-1 text-xs font-semibold text-[#7b1631]">
                    <UsersRound className="h-3.5 w-3.5" />
                    {clientEvents.length} {clientEvents.length === 1 ? "evento" : "eventos"}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/clientes?edit=${client.id}`}>
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </Link>
                  </Button>
                  <form action={toggleClientStatus.bind(null, client.id, client.status === "activo" ? "inactivo" : "activo")}>
                    <Button size="sm" variant={client.status === "activo" ? "outline" : "default"} className="w-full sm:w-fit">
                      {client.status === "activo" ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/clientes?events=${client.id}`}>
                      <Eye className="h-4 w-4" />
                      Ver eventos
                    </Link>
                  </Button>
                  <DeleteClientButton action={deleteClientRecord.bind(null, client.id)} />
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredClients.length === 0 ? (
          <Card className="border-[#eadfd2] bg-white">
            <CardContent className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f7efe4] text-[#7b1631]">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="mt-4 font-display text-2xl font-bold text-[#1f1215]">Todavía no hay clientes</p>
              <p className="mt-2 text-sm text-muted-foreground">Creá tu primer cliente para asociarle eventos.</p>
              <div className="mt-5">
                <Button asChild className="bg-[#6f1029] text-white hover:bg-[#581023]">
                  <Link href="/dashboard/clientes?create=1">Crear cliente</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function ClientForm({ client, plans }: { client: Client | null; plans: CommercialPlan[] }) {
  const action = client ? updateClientRecord.bind(null, client.id) : createClientRecord;

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2 [&_label]:font-semibold">
      <Field label="Nombre del cliente o empresa">
        <Input name="name" defaultValue={client?.name ?? ""} required />
      </Field>
      <Field label="Persona de contacto">
        <Input name="contact_name" defaultValue={client?.contact_name ?? ""} />
      </Field>
      <Field label="Plan comercial">
        <Select name="plan_id" defaultValue={client?.plan_id ?? ""}>
          <option value="">Sin plan asignado</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} {plan.price_label ? `· ${plan.price_label}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Teléfono">
        <Input name="phone" defaultValue={client?.phone ?? ""} />
      </Field>
      <Field label="WhatsApp">
        <Input name="whatsapp" defaultValue={client?.whatsapp ?? ""} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={client?.email ?? ""} />
      </Field>
      <Field label="Estado">
        <Select name="status" defaultValue={client?.status ?? "activo"}>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Notas">
          <Textarea name="notes" defaultValue={client?.notes ?? ""} />
        </Field>
      </div>
      <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row">
        <Button asChild type="button" variant="outline">
          <Link href="/dashboard/clientes">Cancelar</Link>
        </Button>
        <Button className="bg-[#6f1029] text-white hover:bg-[#581023]">
          {client ? "Guardar cambios" : "Guardar cliente"}
        </Button>
      </div>
    </form>
  );
}

function filterClients(clients: Client[], query: SearchParams) {
  const term = normalize(query.q);
  const status = query.status ?? "todos";
  const plan = query.plan ?? "todos";

  return clients.filter((client) => {
    const matchesStatus = status === "todos" || client.status === status;
    const matchesPlan =
      plan === "todos" ||
      (plan === "sin-plan" ? !client.plan_id : client.plan_id === plan);
    const haystack = normalize(
      [client.name, client.contact_name, client.phone, client.whatsapp, client.email].filter(Boolean).join(" ")
    );
    const matchesSearch = !term || haystack.includes(term);
    return matchesStatus && matchesPlan && matchesSearch;
  });
}

function normalize(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const statusClassActive =
  "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800";
const statusClassInactive =
  "rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700";
