import type { Database } from "@/lib/database.types";

type Surface = Database["public"]["Enums"]["court_surface"];
type BookingType = Database["public"]["Enums"]["booking_type"];
type RateCategory = Database["public"]["Enums"]["rate_category"];

export const SURFACE_LABELS: Record<Surface, string> = {
  clay: "Polvo de Ladrillo",
  hard: "Plexicushion / Dura",
  grass: "Césped",
  carpet: "Sintética",
  other: "Otra",
};

export const SURFACE_OPTIONS = Object.entries(SURFACE_LABELS) as [
  Surface,
  string,
][];

export const SERVICE_LABELS: Record<BookingType, string> = {
  singles: "Sencillos",
  doubles: "Dobles",
  lesson: "Clase",
  course: "Curso",
};

export const SERVICE_OPTIONS = Object.entries(SERVICE_LABELS) as [
  BookingType,
  string,
][];

export const CATEGORY_LABELS: Record<RateCategory, string> = {
  member: "Socios",
  non_member: "Visitantes / No socios",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [
  RateCategory,
  string,
][];

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lu" },
  { value: 2, label: "Ma" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Ju" },
  { value: 5, label: "Vi" },
  { value: 6, label: "Sa" },
  { value: 7, label: "Do" },
];

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
