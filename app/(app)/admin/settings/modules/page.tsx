import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ModulesManager } from "./modules-manager";

export const metadata = { title: "Módulos · Academia de Tenis" };

export default async function ModulesPage() {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const supabase = await createClient();

  const { data: modules, error } = await supabase
    .from("club_module")
    .select("*")
    .eq("club_id", clubId);

  if (error) {
    return (
      <p className="text-body-md text-blocked-fg">
        No pudimos cargar los módulos.
      </p>
    );
  }

  return (
    <ModulesManager
      modules={modules ?? []}
      isPlatformAdmin={context.isPlatformAdmin}
    />
  );
}
