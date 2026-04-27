import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="luxury-noise flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur">
        <CardHeader>
          <Link href="/" className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
            KAIS INVITACIONES
          </Link>
          <CardTitle className="font-display text-3xl">Registro deshabilitado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Los usuarios internos de KAIS son creados exclusivamente por un super admin desde el panel.
          </p>
          <Button asChild>
            <Link href="/login">Volver a login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
