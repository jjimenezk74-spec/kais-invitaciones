import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Gem, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const benefits = [
  ["Gestión completa", "Eventos, invitados, RSVP, fotos, QR y estadísticas desde un panel claro."],
  ["Experiencia premium", "Invitaciones públicas con portada visual, cuenta regresiva y acciones móviles."],
  ["Operación SaaS", "Roles, RLS, Supabase Storage y arquitectura lista para clientes reales."]
];

const eventTypes = ["Bodas", "Quinceaños", "Cumpleaños", "Corporativos", "Graduaciones", "Baby showers"];
const proofPoints = [
  { Icon: CalendarCheck, text: "RSVP centralizado" },
  { Icon: ShieldCheck, text: "Seguridad con RLS" },
  { Icon: QrCode, text: "QR automático" }
];

export default function HomePage() {
  return (
    <main>
      <section className="luxury-noise min-h-[92vh] px-4 py-6">
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-sm font-black tracking-[0.24em]">
            KAIS INVITACIONES
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/registro">Crear evento</Link>
            </Button>
          </div>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-10 pb-10 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4 text-accent" />
              Invitaciones digitales premium
            </p>
            <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.95] tracking-normal text-foreground md:text-7xl">
              KAIS INVITACIONES
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Crea experiencias digitales elegantes para eventos memorables. Publica invitaciones, genera QR, recibe
              confirmaciones y gestiona fotos desde una plataforma profesional.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/registro">
                  Crear evento
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#contacto">Solicitar demo</a>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-white/80 p-4 shadow-soft backdrop-blur">
            <div className="relative overflow-hidden rounded-lg bg-[linear-gradient(160deg,#111827,#155e75_55%,#e11d48)] p-7 text-white">
              <div className="mb-28 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/70">
                <span>Vista pública</span>
                <QrCode className="h-5 w-5" />
              </div>
              <p className="font-display text-5xl font-semibold leading-none">Ana & Luis</p>
              <p className="mt-4 max-w-sm text-white/80">Una noche para celebrar el comienzo de una historia.</p>
              <div className="mt-8 grid grid-cols-3 gap-2">
                {["RSVP", "Maps", "Fotos"].map((item) => (
                  <div key={item} className="rounded-md border border-white/20 bg-white/10 px-3 py-4 text-center text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-white" id="como-funciona">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Cómo funciona</p>
            <h2 className="mt-3 font-display text-4xl font-bold">Del evento al QR en minutos.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ["1", "Crea el evento", "Carga anfitriones, fecha, ubicación, portada, mensaje y estilo visual."],
              ["2", "Publica la invitación", "Obtén un enlace público con QR descargable en PNG o SVG."],
              ["3", "Gestiona respuestas", "Revisa RSVP, fotos, visitas y exporta invitados a CSV."]
            ].map(([step, title, text]) => (
              <Card key={step}>
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary font-bold">{step}</div>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">{text}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-muted/60">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Beneficios</p>
            <h2 className="mt-3 font-display text-4xl font-bold">Pensado para vender como servicio real.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map(([title, text]) => (
              <Card key={title}>
                <CardHeader>
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">{text}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Eventos</p>
              <h2 className="mt-3 font-display text-4xl font-bold">Para celebraciones sociales y corporativas.</h2>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {eventTypes.map((type) => (
              <span key={type} className="rounded-full border bg-background px-5 py-3 text-sm font-semibold">
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-foreground text-white">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {[
            ["Starter", "$29", "1 evento publicado, QR, RSVP y galería moderada."],
            ["Pro", "$79", "Hasta 5 eventos, estadísticas y exportación CSV."],
            ["Studio", "$149", "Panel admin para agencias y creación para clientes."]
          ].map(([name, price, text]) => (
            <Card key={name} className="border-white/20 bg-white/10 text-white">
              <CardHeader>
                <Gem className="h-5 w-5 text-secondary" />
                <CardTitle>{name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-4xl font-bold">{price}</p>
                <p className="mt-4 text-sm leading-6 text-white/70">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="section bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {proofPoints.map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded-lg border bg-background p-5">
              <Icon className="h-5 w-5 text-accent" />
              <span className="font-semibold">{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section bg-muted/60">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Testimonios</p>
            <h2 className="mt-3 font-display text-4xl font-bold">Una experiencia clara para anfitriones e invitados.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["María G.", "Pudimos publicar la invitación, compartir el QR y ver confirmaciones sin hojas sueltas."],
              ["Estudio Alba", "El panel admin nos permite operar varios clientes con una presentación mucho más profesional."],
              ["Carlos R.", "La página pública se ve elegante en móvil y los invitados entendieron todo al instante."]
            ].map(([name, text]) => (
              <Card key={name}>
                <CardContent className="p-6">
                  <p className="leading-7 text-muted-foreground">“{text}”</p>
                  <p className="mt-5 font-semibold">{name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-muted/60" id="contacto">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Contacto</p>
          <h2 className="mt-3 font-display text-4xl font-bold">Lanza tu servicio de invitaciones digitales.</h2>
          <p className="mt-4 text-muted-foreground">Agenda una demo o crea tu primer evento y prueba el flujo completo.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild>
              <Link href="/registro">Crear evento</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:hola@kais.app">Solicitar demo</a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
