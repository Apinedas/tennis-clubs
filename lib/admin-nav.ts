// Single source of truth for admin destinations — reused by the dashboard
// cards, the desktop sidebar, and the mobile hamburger, so the three never
// drift out of sync.
export type AdminNavItem = {
  path: string;
  icon: string;
  label: string;
  description: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
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
