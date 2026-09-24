import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile } from "@/lib/auth/dal";
import { allowedAreas, homePath } from "@/lib/auth/roles";
import { moduleLabel, type ClubModuleName } from "@/lib/modules";

export const metadata = { title: "Módulo desactivado · Academia de Tenis" };

export default async function ModuleDisabledPage({
  searchParams,
}: PageProps<"/module-disabled">) {
  const params = await searchParams;
  const profile = await getProfile();
  const area = allowedAreas(profile.context)[0] ?? "admin";
  const back = typeof params.back === "string" ? params.back : homePath(profile.context);
  const moduleName =
    typeof params.module === "string" ? (params.module as ClubModuleName) : null;

  return (
    <AppShell profile={profile} area={area}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant" aria-hidden>
          toggle_off
        </span>
        <h1 className="text-headline-lg text-on-surface">
          {moduleName ? moduleLabel(moduleName) : "Este módulo"} no está activo
        </h1>
        <p className="text-body-md text-on-surface-variant">
          {profile.context.roles.includes("admin")
            ? "Actívalo desde Configuración → Módulos para poder usar esta sección."
            : "Pídele al administrador del club que lo active desde Configuración → Módulos."}
        </p>
        <div className="mt-2 flex gap-2">
          {profile.context.roles.includes("admin") && (
            <Link
              href="/admin/settings/modules"
              className="rounded-lg bg-primary px-4 py-2.5 text-body-md-medium text-on-primary hover:bg-primary-hover"
            >
              Ir a Módulos
            </Link>
          )}
          <Link
            href={back}
            className="rounded-lg border border-border bg-surface-container-lowest px-4 py-2.5 text-body-md-medium text-on-surface hover:bg-background"
          >
            Volver
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
