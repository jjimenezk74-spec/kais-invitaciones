import Link from "next/link";
import { CalendarDays, Images, UsersRound } from "lucide-react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const benefits = [
  { Icon: CalendarDays, title: "Eventos", text: "Gestiona y organiza tus eventos" },
  { Icon: UsersRound, title: "Invitados", text: "Administra confirmaciones" },
  { Icon: Images, title: "Albumes en vivo", text: "Comparte cada momento" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const query = await searchParams;
  return (
    <main className="relative min-h-dvh overflow-x-hidden overflow-y-auto bg-[#21040c] px-4 py-5 text-[#241316] md:h-dvh md:overflow-hidden md:px-8 md:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(124,18,48,0.72),transparent_28%),radial-gradient(circle_at_84%_84%,rgba(130,19,53,0.58),transparent_32%),linear-gradient(135deg,#1a0309_0%,#3b0714_42%,#681228_72%,#160307_100%)]" />
      <div className="absolute -left-40 top-[-9rem] h-[30rem] w-[30rem] rounded-full bg-[#8f2140]/34 blur-3xl" />
      <div className="absolute bottom-[-14rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[#f0c58f]/12 blur-3xl" />
      <div className="absolute left-[6%] top-0 hidden h-[42rem] w-[18rem] rotate-[32deg] rounded-full border border-[#d6a653]/40 md:block" />
      <div className="absolute right-[3%] top-[8%] hidden h-40 w-56 bg-[radial-gradient(circle,#d6a653_1px,transparent_1.5px)] [background-size:24px_24px] opacity-30 md:block" />
      <div className="absolute bottom-[10%] left-[3%] hidden h-28 w-44 bg-[radial-gradient(circle,#f5d7a2_1px,transparent_1.5px)] [background-size:24px_24px] opacity-45 md:block" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,1,4,0.48),transparent_42%,rgba(8,1,4,0.42))]" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl items-center gap-8 md:h-full md:min-h-0 md:grid-cols-[1fr_0.92fr] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden px-6 text-center text-white md:block lg:px-10">
          <div className="mx-auto max-w-xl">
            <p className="text-[0.8rem] font-black uppercase tracking-[0.52em] text-[#d8a85a]">
              KAIS
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.32em] text-[#f3dec2]/85">
              Invitaciones
            </p>
            <div className="mx-auto mt-7 h-px w-16 bg-[#d8a85a]/70" />
            <h1 className="mt-9 font-display text-4xl font-semibold leading-tight text-[#fffaf2] lg:text-5xl">
              Bienvenido de vuelta
            </h1>
            <p className="mx-auto mt-5 max-w-md text-base leading-8 text-[#ead7d2]/78">
              Accede a tu cuenta para gestionar eventos, invitados y álbumes en vivo.
            </p>

            <div className="mt-16 grid grid-cols-3 gap-4">
              {benefits.map(({ Icon, title, text }) => (
                <div key={title} className="border-l border-white/15 px-4 first:border-l-0">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8a85a]/25 bg-[#8b1737]/34 text-[#f2c979] shadow-[0_16px_44px_-30px_rgba(0,0,0,0.9)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-sm font-bold text-white">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-[#ead7d2]/68">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center">
          <Card className="w-full max-w-[27rem] rounded-[1.65rem] border border-[#f1dfcd] !bg-[#fffaf3] !text-[#241316] shadow-[0_42px_120px_-58px_rgba(7,1,4,0.95)] backdrop-blur-xl transition duration-300 hover:shadow-[0_46px_130px_-62px_rgba(7,1,4,1)]">
            <CardHeader className="space-y-4 px-6 pb-4 pt-7 text-center sm:px-8 sm:pt-8">
              <Link href="/" className="mx-auto text-[0.72rem] font-black uppercase tracking-[0.28em] text-[#5b0d20] transition hover:text-[#7c1730] md:hidden">
                KAIS INVITACIONES
              </Link>
              <div>
                <CardTitle className="font-display text-[2rem] leading-none !text-[#4a1724] sm:text-4xl">
                  Ingresar
                </CardTitle>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <span className="h-px w-12 bg-[#d8a85a]/45" />
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.34em] text-[#7b1631]">
                    Acceso interno
                  </p>
                  <span className="h-px w-12 bg-[#d8a85a]/45" />
                </div>
              </div>
              {query.error ? (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {query.error}
                </p>
              ) : null}
              {query.status ? (
                <p className="rounded-lg border border-[#ead8c8] bg-[#f6ead8] px-3 py-2 text-sm font-semibold text-[#4a1724]">
                  {query.status}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-5 px-6 pb-7 sm:px-8 sm:pb-8">
              <form action="/api/auth/login" method="post" className="grid gap-4 [&_label]:font-bold [&_label]:text-[#3b1b24]">
                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    className="h-12 rounded-xl border-[#d9b9b2] bg-white px-4 text-base font-medium text-[#211316] shadow-sm transition placeholder:text-[#9b7d84] hover:border-[#b8787b] focus-visible:border-[#7b1631] focus-visible:ring-[#7b1631]/30"
                    required
                  />
                </Field>
                <Field label="Contrasena">
                  <Input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="........"
                    className="h-12 rounded-xl border-[#d9b9b2] bg-white px-4 text-base font-medium text-[#211316] shadow-sm transition placeholder:text-[#9b7d84] hover:border-[#b8787b] focus-visible:border-[#7b1631] focus-visible:ring-[#7b1631]/30"
                    required
                  />
                </Field>
                <Button className="mt-2 h-[3.25rem] rounded-xl bg-[linear-gradient(135deg,#9a1c43,#571023)] text-base font-bold text-white shadow-[0_20px_46px_-24px_rgba(91,13,32,1)] transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_24px_56px_-26px_rgba(91,13,32,1)] focus-visible:ring-[#7b1631]/35">
                  Ingresar
                </Button>
              </form>
              <Link href="/" className="text-center text-xs font-bold text-[#6f1029] transition hover:text-[#3b0714]">
                Volver al inicio
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
