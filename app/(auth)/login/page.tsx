import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
          <p className="text-sm text-muted-foreground">Acceso exclusivo para equipo KAIS.</p>
          {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
          {query.status ? <p className="text-sm text-muted-foreground">{query.status}</p> : null}
        </CardHeader>
        <CardContent>
          <form action={signIn} className="grid gap-4">
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Contrasena">
              <Input name="password" type="password" required />
            </Field>
            <Button>Entrar al panel</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
