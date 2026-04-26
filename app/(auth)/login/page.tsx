import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const query = await searchParams;
  return (
    <main className="luxury-noise flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur">
        <CardHeader>
          <Link href="/" className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
            KAIS INVITACIONES
          </Link>
          <CardTitle className="font-display text-3xl">Ingresar</CardTitle>
          {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
          {query.status ? <p className="text-sm text-muted-foreground">{query.status}</p> : null}
        </CardHeader>
        <CardContent>
          <form action={signIn} className="grid gap-4">
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Contraseña">
              <Input name="password" type="password" required />
            </Field>
            <Button>Entrar al panel</Button>
          </form>
          <p className="mt-5 text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold text-foreground">
              Crear cuenta
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
