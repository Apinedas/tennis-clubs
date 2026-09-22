import Link from "next/link";
import { acceptInvitation } from "@/app/actions/club";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { getSession } from "@/lib/auth/dal";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invitación · Academia de Tenis" };

type Invitation = { club_name: string; email: string; roles: Role[] };

export default async function InvitationPage({
  params,
}: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("view_invitation", { p_token: token });
  const invitation = (Array.isArray(data) ? data[0] : null) as Invitation | null;

  if (!invitation) {
    return (
      <>
        <h1 className="text-headline-lg text-on-surface">Invitación</h1>
        <Alert tone="error">
          Esta invitación no es válida, ya fue usada o expiró. Pide una nueva al
          administrador del club.
        </Alert>
      </>
    );
  }

  const session = await getSession();
  const next = `/invitation/${token}`;

  return (
    <>
      <h1 className="text-headline-lg text-on-surface">
        Te invitaron a {invitation.club_name}
      </h1>
      <p className="text-body-md text-on-surface-variant">
        Vas a unirte como{" "}
        <strong>
          {invitation.roles.map((r) => ROLE_LABELS[r]).join(" y ")}
        </strong>
        .
      </p>
      {session ? (
        <ActionForm
          action={acceptInvitation}
          hidden={{ token }}
          label="Aceptar invitación"
          pendingLabel="Aceptando…"
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className={buttonClass("primary")}
          >
            Crear cuenta
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className={buttonClass("secondary")}
          >
            Ya tengo cuenta
          </Link>
        </div>
      )}
    </>
  );
}
