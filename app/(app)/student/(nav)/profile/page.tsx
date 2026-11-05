import { getProfile, requireArea } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Mi perfil · Academia de Tenis" };

export default async function StudentProfilePage() {
  const session = await requireArea("student");
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const [{ data: person }, { data: membership }] = await Promise.all([
    supabase
      .from("person")
      .select("full_name, phone")
      .eq("id", session.userId)
      .single(),
    supabase
      .from("membership")
      .select("roles, member_number, created_at")
      .eq("person_id", session.userId)
      .eq("club_id", clubId)
      .single(),
  ]);

  const memberSince = membership
    ? new Date(membership.created_at).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Mi perfil</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Tus datos de contacto y de membresía en {profile.clubName}.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-headline-sm text-on-surface">Membresía</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-label-xs text-on-surface-variant">Correo</dt>
            <dd className="text-body-md text-on-surface">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-label-xs text-on-surface-variant">Club</dt>
            <dd className="text-body-md text-on-surface">{profile.clubName}</dd>
          </div>
          <div>
            <dt className="text-label-xs text-on-surface-variant">Rol</dt>
            <dd className="text-body-md text-on-surface">
              {(membership?.roles ?? []).map((r) => ROLE_LABELS[r]).join(", ")}
            </dd>
          </div>
          {membership?.member_number && (
            <div>
              <dt className="text-label-xs text-on-surface-variant">
                Número de socio
              </dt>
              <dd className="text-body-md text-on-surface">
                {membership.member_number}
              </dd>
            </div>
          )}
          {memberSince && (
            <div>
              <dt className="text-label-xs text-on-surface-variant">Socio desde</dt>
              <dd className="text-body-md text-on-surface">{memberSince}</dd>
            </div>
          )}
        </dl>
      </section>

      <ProfileForm fullName={person?.full_name ?? ""} phone={person?.phone ?? ""} />
      <PasswordForm />
    </div>
  );
}
