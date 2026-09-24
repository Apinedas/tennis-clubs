import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { RatesManager } from "./rates-manager";

export const metadata = { title: "Tarifas · Academia de Tenis" };

export default async function RatesPage() {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const [{ data: rates, error: ratesError }, { data: courts, error: courtsError }, { data: club }] =
    await Promise.all([
      supabase
        .from("rate")
        .select("*")
        .eq("club_id", clubId)
        .order("name"),
      supabase
        .from("court")
        .select("id, name, surface")
        .eq("club_id", clubId)
        .order("name"),
      supabase.from("club").select("currency").eq("id", clubId).maybeSingle(),
    ]);

  if (ratesError || courtsError) {
    return (
      <p className="text-body-md text-blocked-fg">
        No pudimos cargar las tarifas.
      </p>
    );
  }

  return (
    <RatesManager
      rates={rates ?? []}
      courts={courts ?? []}
      currency={club?.currency ?? "COP"}
    />
  );
}
