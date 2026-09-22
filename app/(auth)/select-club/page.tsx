import { ActionForm } from "@/components/action-form";
import { selectClub } from "@/app/actions/club";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/dal";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Elegir club · Academia de Tenis" };

type Membership = {
  club_id: string;
  roles: Role[];
  club: { name: string } | null;
};

export default async function SelectClubPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("membership")
    .select("club_id, roles, club(name)")
    .eq("person_id", session.userId)
    .eq("active", true)
    .order("created_at");
  const memberships = (data ?? []) as unknown as Membership[];

  return (
    <>
      <h1 className="text-headline-lg text-on-surface">Elige un club</h1>
      <p className="text-body-md text-on-surface-variant">
        Perteneces a varios clubes. Puedes cambiar de club cuando quieras.
      </p>
      <ul className="flex flex-col gap-3">
        {memberships.map((m) => (
          <li
            key={m.club_id}
            className="flex flex-col gap-2 rounded-lg border border-border p-4"
          >
            <div>
              <p className="text-headline-sm text-on-surface">
                {m.club?.name}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {m.roles.map((r) => ROLE_LABELS[r]).join(" · ")}
              </p>
            </div>
            <ActionForm
              action={selectClub}
              hidden={{ club_id: m.club_id }}
              label={
                m.club_id === session.context.clubId ? "Club actual" : "Entrar"
              }
              pendingLabel="Entrando…"
              variant={m.club_id === session.context.clubId ? "secondary" : "primary"}
            />
          </li>
        ))}
      </ul>
      <form action={logout}>
        <Button type="submit" variant="secondary" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </>
  );
}
