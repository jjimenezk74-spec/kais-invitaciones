import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BadgeCheck, FileCode2, Plus, Power, Sparkles } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/events";
import {
  createCanvasV3TemplateFromEvent,
  deleteCanvasV3Template,
  listCanvasV3Templates,
  toggleCanvasV3TemplateActive,
} from "@/app/dashboard/canvas-v3/templates/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { canEditEventDesign } from "@/lib/permissions";
import { DeleteCanvasV3TemplateButton } from "./delete-template-button";

type SearchParams = {
  error?: string;
  created?: string;
  updated?: string;
  deleted?: string;
};

const EVENT_TYPE_OPTIONS = [
  "quinceanios",
  "wedding",
  "baptism",
  "kids_birthday",
  "birthday",
  "baby_shower",
  "corporate",
  "graduation",
];

const SCOPE_OPTIONS = ["full", "section", "component"] as const;
const PAGE_PATH = "/dashboard/canvas-v3/templates";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseCompatibleEventTypes(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function createTemplateFromEventAction(formData: FormData) {
  "use server";

  const eventId = textValue(formData, "event_id");
  const name = textValue(formData, "name");
  const slug = textValue(formData, "slug");
  const result = await createCanvasV3TemplateFromEvent(eventId, {
    name,
    slug,
    compatibleEventTypes: parseCompatibleEventTypes(textValue(formData, "compatible_event_types")),
    visualCategory: textValue(formData, "visual_category"),
    templateScope: textValue(formData, "template_scope"),
    isPremium: formData.get("is_premium") === "on",
    isActive: formData.get("is_active") === "on",
  });

  if (!result.ok) {
    redirect(`${PAGE_PATH}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?created=${encodeURIComponent(result.data.name)}`);
}

async function toggleTemplateAction(id: string, nextActive: boolean) {
  "use server";

  const result = await toggleCanvasV3TemplateActive(id, nextActive);
  if (!result.ok) {
    redirect(`${PAGE_PATH}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?updated=${encodeURIComponent(result.data.name)}`);
}

async function deleteTemplateAction(id: string) {
  "use server";

  const result = await deleteCanvasV3Template(id);
  if (!result.ok) {
    redirect(`${PAGE_PATH}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?deleted=${encodeURIComponent(result.data.id)}`);
}

export default async function CanvasV3TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [profile, query] = await Promise.all([getCurrentProfile(), searchParams]);

  if (!canEditEventDesign(profile)) {
    redirect("/dashboard?error=Tu rol no tiene permisos para gestionar plantillas Canvas V3.");
  }

  const templatesResult = await listCanvasV3Templates();
  const templates = templatesResult.ok ? templatesResult.data : [];
  const activeCount = templates.filter((template) => template.isActive).length;
  const premiumCount = templates.filter((template) => template.isPremium).length;

  return (
    <div className="grid gap-7">
      <section className="rounded-2xl border border-[#eadfd2] bg-[linear-gradient(135deg,#fffaf2,#f7efe4)] p-6 shadow-[0_28px_90px_-64px_rgba(17,24,39,0.75)] md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7b1631]">
              Canvas V3
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold text-[#1f1215]">
              Plantillas internas
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Gestion interna para probar el flujo evento - plantilla - activacion.
            </p>
            {query.error || !templatesResult.ok ? (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                {query.error ?? (!templatesResult.ok ? templatesResult.error : "")}
              </p>
            ) : null}
            {query.created ? (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                Plantilla creada: {query.created}
              </p>
            ) : null}
            {query.updated ? (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                Plantilla actualizada: {query.updated}
              </p>
            ) : null}
            {query.deleted ? (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Plantilla eliminada.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 md:min-w-[360px]">
            <Metric label="Total" value={templates.length} />
            <Metric label="Activas" value={activeCount} />
            <Metric label="Premium" value={premiumCount} />
          </div>
        </div>
      </section>

      <Card className="border-[#eadfd2] bg-white shadow-[0_24px_90px_-64px_rgba(17,24,39,0.8)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1f1215]">
            <Plus className="h-5 w-5 text-[#7b1631]" />
            Crear plantilla desde evento
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Toma el canvas_design V3 del evento, lo sanitiza y reemplaza datos reales por placeholders.
          </p>
        </CardHeader>
        <CardContent>
          <form action={createTemplateFromEventAction} className="grid gap-4 lg:grid-cols-2">
            <Field label="ID del evento">
              <Input name="event_id" required placeholder="UUID del evento origen" />
            </Field>
            <Field label="Nombre">
              <Input name="name" required placeholder="Glam Rosa Quince V3" />
            </Field>
            <Field label="Slug">
              <Input name="slug" required placeholder="glam-rosa-quince-v3" />
            </Field>
            <Field label="Tipos compatibles">
              <Input name="compatible_event_types" placeholder="quinceanios, graduation" />
            </Field>
            <Field label="Categoria visual">
              <Input name="visual_category" placeholder="romantica / academica / editorial" />
            </Field>
            <Field label="Scope">
              <Select name="template_scope" defaultValue="full">
                {SCOPE_OPTIONS.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-3 rounded-lg border border-[#eadfd2] bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-[#3b1b24]">
              <input name="is_premium" type="checkbox" className="h-4 w-4" />
              Premium
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[#eadfd2] bg-[#fffaf2] px-4 py-3 text-sm font-semibold text-[#3b1b24]">
              <input name="is_active" type="checkbox" className="h-4 w-4" />
              Activa
            </label>
            <div className="lg:col-span-2">
              <Button className="bg-[#6f1029] text-white hover:bg-[#581023]">
                Crear desde evento
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#eadfd2] bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1f1215]">
            <FileCode2 className="h-5 w-5 text-[#7b1631]" />
            Plantillas V3
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-3">Plantilla</th>
                <th>Estado</th>
                <th>Premium</th>
                <th>Scope</th>
                <th>Tipos compatibles</th>
                <th>Categoria</th>
                <th>Orden</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b align-top">
                  <td className="py-4">
                    <p className="font-bold text-[#1f1215]">{template.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{template.slug}</p>
                    {template.sourceEventId ? (
                      <p className="mt-1 text-xs text-muted-foreground">Origen: {template.sourceEventId}</p>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill active={Boolean(template.isActive)} />
                  </td>
                  <td>
                    {template.isPremium ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Sparkles className="h-3 w-3" />
                        premium
                      </span>
                    ) : (
                      <span className="text-muted-foreground">standard</span>
                    )}
                  </td>
                  <td>{template.templateScope}</td>
                  <td>
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {template.compatibleEventTypes.length ? template.compatibleEventTypes.map((eventType) => (
                        <span key={eventType} className="rounded-full bg-[#f7efe4] px-2 py-1 text-xs font-semibold text-[#6f1029]">
                          {eventType}
                        </span>
                      )) : (
                        <span className="text-muted-foreground">sin tipos</span>
                      )}
                    </div>
                  </td>
                  <td>{template.visualCategory ?? "-"}</td>
                  <td>{template.sortOrder ?? 0}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleTemplateAction.bind(null, template.id ?? "", !template.isActive)}>
                        <Button size="sm" variant={template.isActive ? "outline" : "secondary"}>
                          <Power className="h-4 w-4" />
                          {template.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </form>
                      <DeleteCanvasV3TemplateButton
                        action={deleteTemplateAction.bind(null, template.id ?? "")}
                        templateName={template.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Todavia no hay plantillas Canvas V3.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#eadfd2] bg-white/75 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#1f1215]">{value}</p>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
      <BadgeCheck className="h-3 w-3" />
      activa
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
      inactiva
    </span>
  );
}
