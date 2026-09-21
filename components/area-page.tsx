import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";
import { ROLE_LABELS, type Area } from "@/lib/auth/roles";

// Página provisional de cada área: confirma sesión, rol y club. Se reemplaza
// por las pantallas reales de cada módulo.
export async function AreaPage({
  area,
  title,
}: {
  area: Area;
  title: string;
}) {
  await requireArea(area);
  const profile = await getProfile();

  return (
    <AppShell profile={profile} area={area}>
      <h1 className="text-headline-lg text-on-surface">{title}</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        Esta sección está en construcción.
      </p>
      <dl className="mt-6 grid max-w-md gap-3 rounded-lg border border-border bg-surface-container-lowest p-4 text-body-md">
        <div>
          <dt className="text-label-sm text-on-surface-variant">Persona</dt>
          <dd>
            {profile.fullName} · {profile.email}
          </dd>
        </div>
        <div>
          <dt className="text-label-sm text-on-surface-variant">Club activo</dt>
          <dd>{profile.clubName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-label-sm text-on-surface-variant">Roles</dt>
          <dd>
            {[
              profile.context.isPlatformAdmin ? "Admin de plataforma" : null,
              ...profile.context.roles.map((r) => ROLE_LABELS[r]),
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
      </dl>
    </AppShell>
  );
}
