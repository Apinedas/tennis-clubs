import type { Database } from "@/lib/database.types";

export type ClubModuleName = Database["public"]["Enums"]["club_module_name"];

export const MODULES: {
  value: ClubModuleName;
  label: string;
  description: string;
}[] = [
  {
    value: "bookings",
    label: "Reservas de canchas",
    description: "Grilla horaria, asignación de canchas y control de disponibilidad.",
  },
  {
    value: "lessons",
    label: "Clases y entrenadores",
    description: "Agenda de clases, cuerpo técnico y tarifas por hora de profesor.",
  },
  {
    value: "courses",
    label: "Cursos y clínicas",
    description: "Clases grupales recurrentes con cupo: inscripción, asistencia y horario fijo.",
  },
  {
    value: "dynamic_pricing",
    label: "Tarifario dinámico",
    description: "Precios que varían automáticamente según demanda u ocupación.",
  },
  {
    value: "tournaments",
    label: "Torneos",
    description: "Eliminación directa, round robin por grupos, o grupos + eliminatoria.",
  },
];

export function moduleLabel(module: ClubModuleName): string {
  return MODULES.find((m) => m.value === module)?.label ?? module;
}
