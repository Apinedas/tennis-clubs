import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PeopleManager } from "./people-manager";

export const metadata = { title: "Personas · Academia de Tenis" };

export default async function PeoplePage() {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const [{ data: members, error: membersError }, { data: invitations, error: invitationsError }] =
    await Promise.all([
      supabase.rpc("list_club_members", { p_club: clubId }),
      supabase
        .from("invitation")
        .select("*")
        .eq("club_id", clubId)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);

  if (membersError || invitationsError) {
    return (
      <p className="text-body-md text-blocked-fg">
        No pudimos cargar el directorio de personas.
      </p>
    );
  }

  return (
    <PeopleManager members={members ?? []} invitations={invitations ?? []} />
  );
}
