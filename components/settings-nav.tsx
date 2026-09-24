"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar items mirror the Stitch reference's "Panel de Configuración" nav.
// Only the ones with a real screen behind them are links; the rest show a
// "Próximamente" tag instead of pointing nowhere.
const ITEMS: { icon: string; label: string; path: string | null }[] = [
  { icon: "domain", label: "Club", path: "/admin/settings/club" },
  { icon: "stadium", label: "Canchas", path: "/admin/settings/courts" },
  { icon: "payments", label: "Tarifas", path: "/admin/settings/rates" },
  { icon: "group", label: "Personas", path: null },
  { icon: "calendar_clock", label: "Reservas", path: null },
  { icon: "extension", label: "Módulos", path: null },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Panel de configuración"
      className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible"
    >
      {ITEMS.map((item) => {
        if (!item.path) {
          return (
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
          );
        }

        const active = pathname.startsWith(item.path);
        return (
          <Link
            key={item.label}
            href={item.path}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex items-center gap-3 whitespace-nowrap rounded-lg bg-primary-container/40 px-3 py-2.5 text-body-md-medium text-primary"
                : "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-body-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
