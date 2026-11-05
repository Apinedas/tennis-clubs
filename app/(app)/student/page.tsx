import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getEnabledModules, getProfile, requireArea } from "@/lib/auth/dal";
import { filterByModules, STUDENT_NAV_ITEMS } from "@/lib/nav-items";

export const metadata = { title: "Alumno · Academia de Tenis" };

export default async function StudentPage() {
  const session = await requireArea("student");
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const enabled = await getEnabledModules(clubId);
  const available = filterByModules(STUDENT_NAV_ITEMS, enabled);

  return (
    <AppShell
      profile={profile}
      area="student"
      nav={{ items: available, hubHref: "/student", hubLabel: "Alumno" }}
    >
      <h1 className="text-headline-lg text-on-surface">Alumno</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {profile.clubName}
      </p>
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {available.map((s) => (
          <Link
            key={s.path}
            href={s.path}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden>
              {s.icon}
            </span>
            <div>
              <p className="text-body-md-medium text-on-surface">{s.label}</p>
              <p className="text-label-xs text-on-surface-variant">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
