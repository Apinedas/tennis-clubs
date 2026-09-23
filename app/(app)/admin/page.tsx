import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";

export const metadata = { title: "Administración · Academia de Tenis" };

export default async function AdminPage() {
  await requireArea("admin");
  const profile = await getProfile();

  return (
    <AppShell profile={profile} area="admin">
      <h1 className="text-headline-lg text-on-surface">Administración</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {profile.clubName}
      </p>
      <Link
        href="/admin/settings/club"
        className="mt-6 flex max-w-sm items-center gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm hover:bg-surface-container-low"
      >
        <span className="material-symbols-outlined text-primary" aria-hidden>
          domain
        </span>
        <div>
          <p className="text-body-md-medium text-on-surface">
            Configuración del club
          </p>
          <p className="text-label-xs text-on-surface-variant">
            Nombre, slug, marca y localización de la sede.
          </p>
        </div>
      </Link>
    </AppShell>
  );
}
