import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings-nav";
import { getProfile, requireArea } from "@/lib/auth/dal";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireArea("admin");
  const profile = await getProfile();

  return (
    <AppShell profile={profile} area="admin">
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
