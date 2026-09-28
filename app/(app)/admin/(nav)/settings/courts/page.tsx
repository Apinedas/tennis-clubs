import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CourtsManager } from "./courts-manager";

export const metadata = { title: "Canchas · Academia de Tenis" };

export default async function CourtsPage() {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const { data: courts, error } = await supabase
    .from("court")
    .select("*")
    .eq("club_id", clubId)
    .order("name");

  if (error) {
    return (
      <p className="text-body-md text-blocked-fg">
        No pudimos cargar las canchas.
      </p>
    );
  }

  return <CourtsManager courts={courts ?? []} />;
}
