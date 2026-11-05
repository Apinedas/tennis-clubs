import type { ClubModuleName } from "./modules";

// Single source of truth for each area's destinations — reused by the
// dashboard/hub cards, the desktop sidebar, and the mobile hamburger, so the
// three never drift out of sync. `module`, when set, gates the item behind
// that club module being active (filterByModules below); admin's settings
// items have none — admins must reach them to turn a module on in the first
// place.
export type NavItem = {
  path: string;
  icon: string;
  label: string;
  description: string;
  module?: ClubModuleName;
};

export function filterByModules(items: NavItem[], enabled: Set<ClubModuleName>) {
  return items.filter((item) => !item.module || enabled.has(item.module));
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    path: "/admin/schedule",
    icon: "calendar_month",
    label: "Calendario",
    description: "Todas las reservas del club, todas las canchas.",
  },
  {
    path: "/admin/settings/club",
    icon: "domain",
    label: "Club",
    description: "Nombre, slug, marca y localización de la sede.",
  },
  {
    path: "/admin/settings/courts",
    icon: "stadium",
    label: "Canchas",
    description: "Nombre, superficie y disponibilidad de cada cancha.",
  },
  {
    path: "/admin/settings/rates",
    icon: "payments",
    label: "Tarifas",
    description: "Precios por cancha, horario, categoría y servicio.",
  },
  {
    path: "/admin/settings/people",
    icon: "group",
    label: "Personas",
    description: "Invita entrenadores y alumnos, gestiona sus roles.",
  },
  {
    path: "/admin/settings/courses",
    icon: "school",
    label: "Cursos",
    description: "Clases grupales, cupo, inscripciones y asistencia.",
  },
  {
    path: "/admin/settings/tournaments",
    icon: "trophy",
    label: "Torneos",
    description: "Cuadro, inscripciones, agenda y resultados.",
  },
  {
    path: "/admin/settings/booking-policy",
    icon: "calendar_clock",
    label: "Reservas",
    description: "Duración de turno y ventanas para agendar y cancelar.",
  },
  {
    path: "/admin/settings/modules",
    icon: "extension",
    label: "Módulos",
    description: "Activa o desactiva las funcionalidades del club.",
  },
  {
    path: "/admin/reports/court-usage",
    icon: "monitoring",
    label: "Uso de canchas",
    description: "Ocupación agregada por cancha y horario.",
  },
  {
    path: "/admin/payments",
    icon: "receipt_long",
    label: "Pagos",
    description: "Comprobantes pendientes de revisión.",
  },
];

export const COACH_NAV_ITEMS: NavItem[] = [
  {
    path: "/coach",
    icon: "calendar_month",
    label: "Agenda",
    description: "Solicitudes de clase y tu cronograma del día.",
    module: "lessons",
  },
  {
    path: "/coach/courses",
    icon: "school",
    label: "Mis Cursos",
    description: "Cursos que dictas y pase de lista por sesión.",
    module: "courses",
  },
];

export const STUDENT_NAV_ITEMS: NavItem[] = [
  {
    path: "/student/book",
    icon: "stadium",
    label: "Reservar cancha",
    description: "Elige cancha y horario para jugar sencillos o dobles.",
    module: "bookings",
  },
  {
    path: "/student/lessons",
    icon: "sports_tennis",
    label: "Solicitar clase",
    description: "Pide una clase con un entrenador del club.",
    module: "lessons",
  },
  {
    path: "/student/courses",
    icon: "school",
    label: "Cursos",
    description: "Clases grupales con cupo, por semanas.",
    module: "courses",
  },
  {
    path: "/student/tournaments",
    icon: "trophy",
    label: "Torneos",
    description: "Inscríbete y sigue el cuadro.",
    module: "tournaments",
  },
  {
    path: "/student/reservations",
    icon: "event_note",
    label: "Mis reservas",
    description: "Tus próximas clases y reservas, y tu historial.",
  },
  {
    path: "/student/profile",
    icon: "person",
    label: "Mi perfil",
    description: "Tus datos de contacto y contraseña.",
  },
];
