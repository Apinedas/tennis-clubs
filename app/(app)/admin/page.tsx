import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProfile, requireArea } from "@/lib/auth/dal";

export const metadata = { title: "Administración · Academia de Tenis" };

const SHORTCUTS = [
  {
    href: "/admin/settings/club",
    icon: "domain",
    title: "Configuración del club",
    description: "Nombre, slug, marca y localización de la sede.",
  },
  {
    href: "/admin/settings/courts",
    icon: "stadium",
    title: "Canchas",
    description: "Nombre, superficie y disponibilidad de cada cancha.",
  },
  {
    href: "/admin/settings/rates",
    icon: "payments",
    title: "Tarifas",
    description: "Precios por cancha, horario, categoría y servicio.",
  },
  {
    href: "/admin/settings/people",
    icon: "group",
    title: "Personas",
    description: "Invita entrenadores y alumnos, gestiona sus roles.",
  },
  {
    href: "/admin/settings/booking-policy",
    icon: "calendar_clock",
    title: "Reservas",
    description: "Duración de turno y ventanas para agendar y cancelar.",
  },
  {
    href: "/admin/settings/modules",
    icon: "extension",
    title: "Módulos",
    description: "Activa o desactiva las funcionalidades del club.",
  },
];

export default async function AdminPage() {
  await requireArea("admin");
  const profile = await getProfile();

  return (
    <AppShell profile={profile} area="admin">
      <h1 className="text-headline-lg text-on-surface">Administración</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {profile.clubName}
      </p>
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
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
