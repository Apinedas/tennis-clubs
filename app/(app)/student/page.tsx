import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Alumno · Academia de Tenis" };

const SHORTCUTS: { module: "bookings" | "lessons"; href: string; icon: string; title: string; description: string }[] = [
  {
    module: "bookings",
    href: "/student/book",
    icon: "stadium",
    title: "Reservar cancha",
    description: "Elige cancha y horario para jugar sencillos o dobles.",
  },
  {
    module: "lessons",
    href: "/student/lessons",
    icon: "sports_tennis",
    title: "Solicitar clase",
    description: "Pide una clase con un entrenador del club.",
  },
];

// Always available: viewing and cancelling what you've already booked
// shouldn't disappear just because a module got toggled off afterward.
const RESERVATIONS_SHORTCUT = {
  href: "/student/reservations",
  icon: "event_note",
  title: "Mis reservas",
  description: "Tus próximas clases y reservas, y tu historial.",
};

const PROFILE_SHORTCUT = {
  href: "/student/profile",
  icon: "person",
  title: "Mi perfil",
  description: "Tus datos de contacto y contraseña.",
};

export default async function StudentPage() {
  const session = await requireArea("student");
  const profile = await getProfile();
  const clubId = session.context.clubId as string;
  const supabase = await createClient();

  const { data: modules } = await supabase
    .from("club_module")
    .select("module, active")
    .eq("club_id", clubId);
  const enabled = new Set((modules ?? []).filter((m) => m.active).map((m) => m.module));

  const available = [
    ...SHORTCUTS.filter((s) => enabled.has(s.module)),
    RESERVATIONS_SHORTCUT,
    PROFILE_SHORTCUT,
  ];

  return (
    <AppShell profile={profile} area="student">
      <h1 className="text-headline-lg text-on-surface">Alumno</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {profile.clubName}
      </p>
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {available.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden>
              {s.icon}
            </span>
            <div>
              <p className="text-body-md-medium text-on-surface">{s.title}</p>
              <p className="text-label-xs text-on-surface-variant">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
