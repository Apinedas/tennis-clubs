import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ClubSettingsForm } from "./club-settings-form";

export const metadata = { title: "Configuración del club · Academia de Tenis" };

export default async function ClubSettingsPage() {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const [{ data: club, error }, { count: memberCount }] = await Promise.all([
    supabase.from("club").select("*").eq("id", clubId).single(),
    supabase
      .from("membership")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("active", true),
  ]);

  if (error || !club) {
    return (
      <p className="text-body-md text-blocked-fg">
        No pudimos cargar la configuración del club.
      </p>
    );
  }

  return <ClubSettingsForm club={club} memberCount={memberCount ?? 0} />;
}
