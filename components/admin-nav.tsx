"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@/lib/admin-nav";

// Desktop-only sidebar across every admin destination (settings, calendario,
// reportes) — on mobile this same navigation lives behind the hamburger
// (MobileNav) instead, so it isn't duplicated as a horizontal scroll row.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación de administración" className="hidden shrink-0 md:flex md:w-56 md:flex-col md:gap-1">
      <Link
        href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
        className="mb-2 flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-body-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          arrow_back
        </span>
        Administración
      </Link>
      <div className="mb-1 border-t border-border" />
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
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
