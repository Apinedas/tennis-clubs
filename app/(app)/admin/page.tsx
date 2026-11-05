import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";

export const metadata = { title: "Administración · Academia de Tenis" };

export default async function AdminPage() {
  await requireArea("admin");
  const profile = await getProfile();

  return (
    <AppShell
      profile={profile}
      area="admin"
      nav={{ items: ADMIN_NAV_ITEMS, hubHref: "/admin", hubLabel: "Administración" }}
    >
      <h1 className="text-headline-lg text-on-surface">Administración</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {profile.clubName}
      </p>
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden>
              {item.icon}
            </span>
            <div>
              <p className="text-body-md-medium text-on-surface">{item.label}</p>
              <p className="text-label-xs text-on-surface-variant">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
