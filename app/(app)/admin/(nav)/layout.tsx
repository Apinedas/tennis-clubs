import { AdminNav } from "@/components/admin-nav";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";

// Shared chrome for every admin destination except the dashboard itself
// (/admin, which already shows this same list as cards and doesn't need a
// sidebar pointing back at itself). A route group so it doesn't change any
// URLs — /admin/schedule, /admin/settings/club, etc. stay exactly the same.
export default async function AdminNavLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireArea("admin");
  const profile = await getProfile();

  return (
    <AppShell profile={profile} area="admin">
      <div className="flex flex-col gap-6 md:flex-row">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
