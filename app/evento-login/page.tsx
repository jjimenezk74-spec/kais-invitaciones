import Link from "next/link";
import { eventLoginSignIn } from "@/app/actions/event-logins";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function EventoLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;

  return (
    <main className="luxury-noise flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur">
        <CardHeader>
          <Link href="/" className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
            KAIS INVITACIONES
          </Link>
          <CardTitle className="font-display text-3xl">Panel de evento</CardTitle>
          {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
        </CardHeader>
        <CardContent>
          <form action={eventLoginSignIn} className="grid gap-4">
            <Field label="Usuario">
              <Input name="username" autoComplete="username" required />
            </Field>
            <Field label="Contrasena">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <Button>Entrar al panel</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
