import Link from "next/link";
import { joinClub } from "@/app/actions/club";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/ui/alert";
import { requireSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Unirme a un club · Academia de Tenis" };

export default async function JoinPage({ params }: PageProps<"/join/[slug]">) {
  const { slug } = await params;
  await requireSession();

  const supabase = await createClient();
  const { data } = await supabase.rpc("public_club", { p_slug: slug });
  const club = Array.isArray(data) ? data[0] : null;

  if (!club || !club.open_registration) {
    return (
      <>
        <h1 className="text-headline-lg text-on-surface">Unirme a un club</h1>
        <Alert tone="error">
          Este club no existe o no admite registro abierto. Pide una invitación
          a su administrador.
        </Alert>
        <Link href="/" className="text-body-md text-primary underline">
          Volver al inicio
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-headline-lg text-on-surface">
        Unirme a {club.name}
      </h1>
      <p className="text-body-md text-on-surface-variant">
        Te agregaremos como alumno. Conservas tus demás clubes y roles.
      </p>
      <ActionForm
        action={joinClub}
        hidden={{ slug }}
        label="Unirme como alumno"
        pendingLabel="Uniéndome…"
      />
    </>
  );
}
