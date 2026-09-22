// Crea un club de prueba y usuarios que cubren los casos de roles.
//
//   node --env-file=.env.local scripts/seed-dev.mjs --yes
//
// Requiere SUPABASE_SECRET_KEY (solo local, nunca en git). Es idempotente.
// Todos los usuarios usan la contraseña PASSWORD.

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

async function upsertClub(slug, name) {
  const existing = check(
    await supabase.from("club").select("id").eq("slug", slug).maybeSingle(),
    "buscar club",
  );
  if (existing) return existing.id;
  return check(
    await supabase.from("club").insert({ slug, name }).select("id").single(),
    "crear club",
  ).id;
}

async function upsertUser(email, fullName) {
  const created = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!created.error) return created.data.user.id;

  // Ya existía: se busca entre los usuarios.
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

const rodadero = await upsertClub("el-rodadero", "Club Campestre El Rodadero");
const demo2 = await upsertClub("club-demo-2", "Club Demo 2");

for (const [i, name] of ["Cancha 1", "Cancha 2", "Cancha 3"].entries()) {
  check(
    await supabase
      .from("court")
      .upsert({ club_id: rodadero, name, surface: i === 2 ? "Cemento" : "Arcilla" }, { onConflict: "club_id,name" }),
    "cancha",
  );
}

const platform = await upsertUser("plataforma@demo.test", "Paula Plataforma");
check(await supabase.from("platform_admin").upsert({ person_id: platform }), "platform_admin");

const admin = await upsertUser("admin@demo.test", "Carlos Mendoza");
await membership(admin, rodadero, ["admin", "coach"]); // varios roles en un club

const student = await upsertUser("alumno@demo.test", "Ana Alumna");
await membership(student, rodadero, ["student"]);

const multi = await upsertUser("multi@demo.test", "Marta Multiclub");
await membership(multi, rodadero, ["student"]);
await membership(multi, demo2, ["admin"]); // varios clubes

await upsertUser("sinclub@demo.test", "Sara Sinclub"); // sin membresías

for (const [id, club] of [[admin, rodadero], [student, rodadero]]) {
  check(await supabase.from("person").update({ active_club_id: club }).eq("id", id), "club activo");
}

console.log(`Listo. Contraseña de todos: ${PASSWORD}
  plataforma@demo.test  → /platform
  admin@demo.test       → /admin (también /coach)
  alumno@demo.test      → /student
  multi@demo.test       → /select-club (alumno en El Rodadero, admin en Club Demo 2)
  sinclub@demo.test     → /no-club
  Registro abierto: /register?club=el-rodadero`);
