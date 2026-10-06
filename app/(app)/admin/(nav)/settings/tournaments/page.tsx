import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TournamentsManager } from "./tournaments-manager";

export const metadata = { title: "Torneos · Academia de Tenis" };

export default async function TournamentsPage({
  searchParams,
}: PageProps<"/admin/settings/tournaments">) {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const selectedId = typeof params.tournament === "string" ? params.tournament : "";

  const [{ data: tournaments }, { data: courts }, { data: members }] = await Promise.all([
    supabase.rpc("list_club_tournaments", { p_club: clubId }),
    supabase.from("court").select("id, name").eq("club_id", clubId).eq("active", true).order("name"),
    supabase.rpc("list_club_members", { p_club: clubId }),
  ]);

  const [{ data: entries }, { data: matches }] = selectedId
    ? await Promise.all([
        supabase.rpc("list_tournament_entries", { p_tournament_id: selectedId }),
        supabase.rpc("list_tournament_matches", { p_tournament_id: selectedId }),
      ])
    : [{ data: null }, { data: null }];

  return (
    <TournamentsManager
      tournaments={tournaments ?? []}
      courts={courts ?? []}
      members={(members ?? []).filter((m) => m.active)}
      selectedId={selectedId}
      entries={entries ?? []}
      matches={matches ?? []}
    />
  );
}
