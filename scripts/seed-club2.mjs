// Club Demo 2 solo tenía a Marta Multiclub (admin) — sin cancha, sin tarifa y
// sin nadie más, así que no servía para probar aislamiento entre clubes.
// Agrega un entrenador, tres alumnos, y lo mínimo para que el módulo de
// reservas (ya activo en ese club) funcione de verdad.
//
//   node --env-file=.env.local scripts/seed-club2.mjs --yes
//
// Requiere SUPABASE_SECRET_KEY (solo local, nunca en git). Es idempotente.

import { createClient } from "@supabase/supabase-js";

const PASSWORD = "Demo1234!";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.error(`Esto creará datos de prueba en ${url}.\nVuelve a correrlo con --yes para confirmar.`);
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const check = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

async function upsertUser(email, fullName) {
  const created = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!created.error) return created.data.user.id;

  const list = check(await supabase.auth.admin.listUsers({ perPage: 1000 }), "listar usuarios");
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`crear ${email}: ${created.error.message}`);
  return user.id;
}

async function membership(personId, clubId, roles) {
  check(
    await supabase
      .from("membership")
      .upsert({ person_id: personId, club_id: clubId, roles, active: true }),
    "membresía",
  );
}

const club = check(
  await supabase.from("club").select("id").eq("slug", "club-demo-2").single(),
  "buscar club-demo-2",
);
const clubId = club.id;

check(
  await supabase
    .from("court")
    .upsert(
      { club_id: clubId, name: "Cancha 1", surface: "hard", covered: false, has_lighting: true },
      { onConflict: "club_id,name" },
    ),
  "cancha",
);

const { data: existingRate } = await supabase
  .from("rate")
  .select("id")
  .eq("club_id", clubId)
  .eq("name", "Alquiler de cancha")
  .maybeSingle();
if (!existingRate) {
  check(
    await supabase.from("rate").insert({
      club_id: clubId,
      name: "Alquiler de cancha",
      category: "member",
      start_time: "06:00",
      end_time: "22:00",
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      price_amount: 40000,
    }),
    "crear tarifa",
  );
}

const coach = await upsertUser("diego.fernandez@demo.test", "Diego Fernández");
await membership(coach, clubId, ["coach"]);

const students = [
  ["pablo.jimenez@demo.test", "Pablo Jiménez"],
  ["carolina.vargas@demo.test", "Carolina Vargas"],
  ["felipe.ramirez@demo.test", "Felipe Ramírez"],
];
for (const [email, name] of students) {
  const id = await upsertUser(email, name);
  await membership(id, clubId, ["student"]);
}

console.log(`Listo. Contraseña de todas: ${PASSWORD}
  diego.fernandez@demo.test  → entrenador en Club Demo 2
  pablo.jimenez@demo.test    → alumno en Club Demo 2
  carolina.vargas@demo.test  → alumna en Club Demo 2
  felipe.ramirez@demo.test   → alumno en Club Demo 2
  (el módulo "lessons" sigue apagado en este club — activalo desde
  /admin/settings/modules si quieres probar clases con Diego)`);
