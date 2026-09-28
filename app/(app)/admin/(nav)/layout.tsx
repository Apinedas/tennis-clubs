import Link from "next/link";
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
        <div className="min-w-0 flex-1">
          {/* AdminNav's own "← Administración" is desktop-only (hidden
              below md); without this, mobile had no way back except the
              hamburger. */}
          <Link
            href="/admin"
            className="mb-4 flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-on-surface md:hidden"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              arrow_back
            </span>
            Administración
          </Link>
          {children}
        </div>
      </div>
    </AppShell>
  );
}
