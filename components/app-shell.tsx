import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/dal";
import { AREAS, allowedAreas, type Area } from "@/lib/auth/roles";
import { darken } from "@/lib/color";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Common structure for authenticated areas: header with club, area selector
// (only the ones the user can see) and sign-out.
export function AppShell({
  profile,
  area,
  children,
}: {
  profile: Profile;
  area: Area;
  children: React.ReactNode;
}) {
  const areas = AREAS.filter((a) =>
    allowedAreas(profile.context).includes(a.area),
  );

  const brandColor = profile.brandColor && HEX_RE.test(profile.brandColor)
    ? profile.brandColor
    : null;
  const themeStyle = brandColor
    ? ({
        "--color-primary": brandColor,
        "--color-primary-hover": darken(brandColor),
        "--color-primary-container": brandColor,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex flex-1 flex-col" style={themeStyle}>
      <header className="border-b border-border bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-margin py-3 md:px-margin-desktop">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" aria-hidden>
              sports_tennis
            </span>
            <span className="text-headline-sm text-on-surface">
              {profile.clubName ?? "Academia de Tenis"}
            </span>
          </div>
          <nav aria-label="Áreas" className="flex flex-1 gap-4">
            {areas.map((a) => (
              <Link
                key={a.area}
                href={a.path}
                aria-current={a.area === area ? "page" : undefined}
                className={
                  a.area === area
                    ? "text-body-md-medium text-primary"
                    : "text-body-md text-on-surface-variant hover:text-on-surface"
                }
              >
                {a.label}
              </Link>
            ))}
            {profile.context.clubCount > 1 && (
              <Link
                href="/select-club"
                className="text-body-md text-on-surface-variant hover:text-on-surface"
              >
                Cambiar de club
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-label-sm text-on-surface-variant">
              {profile.fullName}
            </span>
            <form action={logout}>
              <Button type="submit" variant="secondary" className="py-1.5!">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-margin py-6 md:px-margin-desktop">
        {children}
      </main>
    </div>
  );
}
