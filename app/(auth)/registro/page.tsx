import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <main className="luxury-noise flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur">
        <CardHeader>
          <Link href="/" className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
            KAIS INVITACIONES
          </Link>
          <CardTitle className="font-display text-3xl">Crear cuenta</CardTitle>
          {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
        </CardHeader>
        <CardContent>
          <form action={signUp} className="grid gap-4">
            <Field label="Nombre">
              <Input name="full_name" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Contraseña">
              <Input name="password" type="password" minLength={6} required />
            </Field>
            <Button>Crear evento</Button>
          </form>
          <p className="mt-5 text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-foreground">
              Ingresar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
