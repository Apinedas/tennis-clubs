import { AppShell } from "@/components/app-shell";
import { SidebarNav } from "@/components/sidebar-nav";
import { getEnabledModules, getProfile, requireArea } from "@/lib/auth/dal";
import { COACH_NAV_ITEMS, filterByModules } from "@/lib/nav-items";

// Shared chrome for every coach destination. Unlike admin/student, there's
// no separate dashboard hub to exclude the sidebar from — /coach (Agenda)
// is itself one of the destinations, so it gets the sidebar too.
export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireArea("coach");
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const enabled = await getEnabledModules(clubId);
  const items = filterByModules(COACH_NAV_ITEMS, enabled);

  return (
    <AppShell profile={profile} area="coach" nav={{ items, hubHref: "/coach", hubLabel: "Agenda" }}>
      <div className="flex flex-col gap-6 md:flex-row">
        <SidebarNav items={items} ariaLabel="Navegación de entrenador" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
