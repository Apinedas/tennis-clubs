"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav-items";

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

// Desktop-only sidebar shared by every area's sub-navigation (admin,
// coach, student) — on mobile this same list lives behind MobileNav's
// hamburger instead, so it isn't duplicated as a horizontal scroll row.
export function SidebarNav({
  items,
  backHref,
  backLabel,
  ariaLabel,
}: {
  items: NavItem[];
  backHref?: string;
  backLabel?: string;
  ariaLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="hidden shrink-0 md:flex md:w-56 md:flex-col md:gap-1">
      {backHref && backLabel && (
        <>
          <Link
            href={backHref}
            aria-current={pathname === backHref ? "page" : undefined}
            className="mb-2 flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-body-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              arrow_back
            </span>
            {backLabel}
          </Link>
          <div className="mb-1 border-t border-border" />
        </>
      )}
      {items.map((item) => {
        const active = isActive(pathname, item.path);
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
