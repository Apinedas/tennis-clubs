import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Crear cuenta · Academia de Tenis" };

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const params = await searchParams;
  const slug = typeof params.club === "string" ? params.club : undefined;
  const next = safeNext(typeof params.next === "string" ? params.next : null);

  // Con ?club=<slug> el alumno se registra directamente en ese club.
  let clubName: string | null = null;
  let clubClosed = false;
  if (slug) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("club_publico", { p_slug: slug });
    const club = Array.isArray(data) ? data[0] : null;
    if (club?.registro_abierto) clubName = club.nombre;
    else clubClosed = true;
  }

  return (
    <>
      <h1 className="text-headline-lg text-on-surface">Crear cuenta</h1>
      {clubName && (
        <p className="text-body-md text-on-surface-variant">
          Te registrarás como alumno en <strong>{clubName}</strong>.
        </p>
      )}
      {clubClosed ? (
        <>
          <Alert tone="error">
            Este club no existe o no admite registro abierto. Pide una
            invitación a su administrador.
          </Alert>
          <Link href="/login" className="text-body-md text-primary underline">
            Ir a ingresar
          </Link>
        </>
      ) : (
        <RegisterForm
          club={clubName ? slug : undefined}
          next={next ?? undefined}
        />
      )}
    </>
  );
}
