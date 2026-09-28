"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { initials } from "@/lib/initials";

export function ProfileMenu({
  fullName,
  email,
  showProfileLink,
}: {
  fullName: string;
  email: string;
  showProfileLink: boolean;
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menú de ${fullName}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-label-sm font-medium text-on-primary"
      >
        {initials(fullName)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-border bg-surface-container-lowest p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-body-md-medium text-on-surface">{fullName}</p>
            <p className="truncate text-label-xs text-on-surface-variant">{email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          {showProfileLink && (
            <Link
              href="/student/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-body-md text-on-surface hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                person
              </span>
              Mi perfil
            </Link>
          )}
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-body-md text-on-surface hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                logout
              </span>
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
