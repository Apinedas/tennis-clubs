import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TournamentsManager } from "./tournaments-manager";

export const metadata = { title: "Torneos · Academia de Tenis" };

const SIGNED_URL_TTL_SECONDS = 300;

export default async function TournamentsPage({
  searchParams,
}: PageProps<"/admin/settings/tournaments">) {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const params = await searchParams;
  const selectedId = typeof params.tournament === "string" ? params.tournament : "";

  const [{ data: tournaments }, { data: courts }, { data: members }, { data: rates }, { data: pending }, { data: club }] =
    await Promise.all([
      supabase.rpc("list_club_tournaments", { p_club: clubId }),
      supabase.from("court").select("id, name").eq("club_id", clubId).eq("active", true).order("name"),
      supabase.rpc("list_club_members", { p_club: clubId }),
      supabase
        .from("rate")
        .select("id, name, price_amount")
        .eq("club_id", clubId)
        .eq("service", "tournament")
        .eq("active", true)
        .order("name"),
      supabase.rpc("list_pending_tournament_entries", { p_club: clubId }),
      supabase.from("club").select("currency").eq("id", clubId).single(),
    ]);

  const [{ data: entries }, { data: matches }] = selectedId
    ? await Promise.all([
        supabase.rpc("list_tournament_entries", { p_tournament_id: selectedId }),
        supabase.rpc("list_tournament_matches", { p_tournament_id: selectedId }),
      ])
    : [{ data: null }, { data: null }];

  const pendingWithProof = await Promise.all(
    (pending ?? []).map(async (item) => {
      if (!item.payment_proof_path) return { ...item, proofUrl: null };
      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(item.payment_proof_path, SIGNED_URL_TTL_SECONDS);
      return { ...item, proofUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <TournamentsManager
      tournaments={tournaments ?? []}
      courts={courts ?? []}
      members={(members ?? []).filter((m) => m.active)}
      rates={rates ?? []}
      currency={club?.currency ?? "COP"}
      pending={pendingWithProof}
      selectedId={selectedId}
      entries={entries ?? []}
      matches={matches ?? []}
    />
  );
}
