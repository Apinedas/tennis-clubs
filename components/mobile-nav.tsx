"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ADMIN_NAV_ITEMS } from "@/lib/admin-nav";

// Mobile-only entry point into the admin destinations that, on desktop,
// live in the AdminNav sidebar (hidden below md). Role/club switching and
// "Mi perfil" live in ProfileMenu instead — this is admin navigation only.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
      >
        <span className="material-symbols-outlined" aria-hidden>
          {open ? "close" : "menu"}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-border bg-surface-container-lowest p-1.5 shadow-lg"
        >
          <Link
            href="/admin"
            role="menuitem"
            onClick={() => setOpen(false)}
            aria-current={pathname === "/admin" ? "page" : undefined}
            className="block rounded-lg px-2.5 py-2 text-body-md-medium text-on-surface hover:bg-surface-container"
          >
            Administración
          </Link>
          <div className="my-1 border-t border-border" />
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center gap-3 rounded-lg px-2.5 py-2 text-body-md-medium text-primary"
                    : "flex items-center gap-3 rounded-lg px-2.5 py-2 text-body-md text-on-surface hover:bg-surface-container"
                }
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
