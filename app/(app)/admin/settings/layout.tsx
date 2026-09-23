import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";

// Sidebar items mirror the Stitch reference's "Panel de Configuración" nav.
// Only the ones with a real screen behind them are links; the rest show a
// "Próximamente" tag instead of pointing nowhere.
const ITEMS: { icon: string; label: string; path: string | null }[] = [
  { icon: "domain", label: "Club", path: "/admin/settings/club" },
  { icon: "stadium", label: "Canchas", path: null },
  { icon: "payments", label: "Tarifas", path: null },
  { icon: "group", label: "Personas", path: null },
  { icon: "calendar_clock", label: "Reservas", path: null },
  { icon: "extension", label: "Módulos", path: null },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireArea("admin");
  const profile = await getProfile();

  return (
    <AppShell profile={profile} area="admin">
      <div className="flex flex-col gap-6 md:flex-row">
        <nav
          aria-label="Panel de configuración"
          className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible"
        >
          {/* Only one section exists so far, so it's always shown as current;
              this needs real active-path logic once more are built. */}
          {ITEMS.map((item) =>
            item.path ? (
              <Link
                key={item.label}
                href={item.path}
                className="flex items-center gap-3 whitespace-nowrap rounded-lg bg-primary-container/40 px-3 py-2.5 text-body-md-medium text-primary"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-body-md text-on-surface-variant/60"
                title="Próximamente"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
                <span className="rounded bg-surface-container px-1.5 py-0.5 text-label-xs text-on-surface-variant">
                  Próximamente
                </span>
              </span>
            ),
          )}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
