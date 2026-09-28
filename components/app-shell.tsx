import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { ProfileMenu } from "@/components/profile-menu";
import type { Profile } from "@/lib/auth/dal";
import { AREAS, allowedAreas, type Area } from "@/lib/auth/roles";
import { darken } from "@/lib/color";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Common structure for authenticated areas: header with club, area nav
// (desktop only — role/club switching lives in ProfileMenu instead, since
// most people only ever have one role in one club) and the profile menu.
// The mobile hamburger (MobileNav) is admin-only: it's the one area with
// enough sub-destinations to need its own navigation on a narrow screen.
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
  const showChangeClub = profile.context.clubCount > 1;

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
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-margin py-3 md:px-margin-desktop">
          <div className="flex items-center gap-2">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, no static size known
              <img
                src={profile.logoUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-md object-contain"
              />
            ) : (
              <span className="material-symbols-outlined text-primary" aria-hidden>
                sports_tennis
              </span>
            )}
            <span className="text-headline-sm text-on-surface">
              {profile.clubName ?? "Academia de Tenis"}
            </span>
          </div>
          <nav aria-label="Áreas" className="hidden flex-1 gap-4 md:flex">
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
            {showChangeClub && (
              <Link
                href="/select-club"
                className="text-body-md text-on-surface-variant hover:text-on-surface"
              >
                Cambiar de club
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {area === "admin" && <MobileNav />}
            <ProfileMenu
              fullName={profile.fullName}
              email={profile.email}
              showProfileLink={allowedAreas(profile.context).includes("student")}
              areas={areas}
              currentArea={area}
              showChangeClub={showChangeClub}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-margin py-6 md:px-margin-desktop">
        {children}
      </main>
    </div>
  );
}
