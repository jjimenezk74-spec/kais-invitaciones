export function NotPublishedScreen() {
  return (
    <main className="kais-stage flex min-h-screen items-center justify-center px-4 text-center">
      <div className="kais-rise">
        <p className="kais-eyebrow">KAIS Invitaciones</p>
        <h1 className="mt-5 font-display text-4xl font-light italic text-[#f5ecd9] md:text-5xl">
          Esta invitación aún no está publicada.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#f5ecd9]/65">
          Cuando el evento esté en estado publicado, podrás verlo y compartirlo.
        </p>
      </div>
    </main>
  );
}

export function PersonalLinkRequired() {
  return (
    <main className="kais-stage flex min-h-screen items-center justify-center px-4 text-center">
      <div className="kais-rise">
        <p className="kais-eyebrow">KAIS Invitaciones</p>
        <h1 className="mt-5 font-display text-4xl font-light italic text-[#f5ecd9] md:text-5xl">
          Esta invitación requiere enlace personal.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#f5ecd9]/65">
          Abre el enlace que recibiste por WhatsApp para confirmar tu asistencia.
        </p>
      </div>
    </main>
  );
}

export function InvalidPersonalLink() {
  return (
    <main className="kais-stage flex min-h-screen items-center justify-center px-4 text-center">
      <div className="kais-rise">
        <p className="kais-eyebrow">KAIS Invitaciones</p>
        <h1 className="mt-5 font-display text-4xl font-light italic text-[#f5ecd9] md:text-5xl">
          Este enlace personal no es válido.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#f5ecd9]/65">
          Verifica que abriste el enlace completo enviado por WhatsApp.
        </p>
      </div>
    </main>
  );
}

export function InactivePersonalLink() {
  return (
    <main className="kais-stage flex min-h-screen items-center justify-center px-4 text-center">
      <div className="kais-rise">
        <p className="kais-eyebrow">KAIS Invitaciones</p>
        <h1 className="mt-5 font-display text-4xl font-light italic text-[#f5ecd9] md:text-5xl">
          Este enlace ya no está activo.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#f5ecd9]/65">
          Contactá a los anfitriones si necesitás ayuda con tu invitación.
        </p>
      </div>
    </main>
  );
}
