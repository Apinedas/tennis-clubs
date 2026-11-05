import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SidebarNav } from "@/components/sidebar-nav";
import { getEnabledModules, getProfile, requireArea } from "@/lib/auth/dal";
import { filterByModules, STUDENT_NAV_ITEMS } from "@/lib/nav-items";

// Shared chrome for every student destination except the dashboard itself
// (/student, which already shows this same list as cards and doesn't need a
// sidebar pointing back at itself). A route group so it doesn't change any
// URLs — /student/book, /student/courses, etc. stay exactly the same.
export default async function StudentNavLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireArea("student");
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const enabled = await getEnabledModules(clubId);
  const items = filterByModules(STUDENT_NAV_ITEMS, enabled);

  return (
    <AppShell
      profile={profile}
      area="student"
      nav={{ items, hubHref: "/student", hubLabel: "Alumno" }}
    >
      <div className="flex flex-col gap-6 md:flex-row">
        <SidebarNav
          items={items}
          backHref="/student"
          backLabel="Alumno"
          ariaLabel="Navegación de alumno"
        />
        <div className="min-w-0 flex-1">
          {/* SidebarNav's own "← Alumno" is desktop-only (hidden below md);
              without this, mobile had no way back except the hamburger. */}
          <Link
            href="/student"
            className="mb-4 flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-on-surface md:hidden"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              arrow_back
            </span>
            Alumno
          </Link>
          {children}
        </div>
      </div>
    </AppShell>
  );
}
