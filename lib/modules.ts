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
    value: "dynamic_pricing",
    label: "Tarifario dinámico",
    description: "Precios que varían automáticamente según demanda u ocupación.",
  },
  {
    value: "tournaments",
    label: "Torneos y rankings",
    description: "Cuadros eliminatorios, round-robin y escalafón interno del club.",
  },
];

export function moduleLabel(module: ClubModuleName): string {
  return MODULES.find((m) => m.value === module)?.label ?? module;
}
