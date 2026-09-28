"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Area } from "@/lib/auth/roles";

export function MobileNav({
  areas,
  currentArea,
  showChangeClub,
}: {
  areas: { area: Area; path: string; label: string }[];
  currentArea: Area;
  showChangeClub: boolean;
}) {
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
          className="absolute left-0 top-11 z-20 w-56 rounded-xl border border-border bg-surface-container-lowest p-1.5 shadow-lg"
        >
          {areas.map((a) => (
            <Link
              key={a.area}
              href={a.path}
              role="menuitem"
              onClick={() => setOpen(false)}
              aria-current={a.area === currentArea ? "page" : undefined}
              className={
                a.area === currentArea
                  ? "block rounded-lg px-2.5 py-2 text-body-md-medium text-primary"
                  : "block rounded-lg px-2.5 py-2 text-body-md text-on-surface hover:bg-surface-container"
              }
            >
              {a.label}
            </Link>
          ))}
          {showChangeClub && (
            <>
              <div className="my-1 border-t border-border" />
              <Link
                href="/select-club"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-2 text-body-md text-on-surface hover:bg-surface-container"
              >
                Cambiar de club
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
