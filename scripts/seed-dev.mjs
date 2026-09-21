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

async function upsertClub(slug, nombre) {
  const existing = check(
    await supabase.from("club").select("id").eq("slug", slug).maybeSingle(),
    "buscar club",
  );
  if (existing) return existing.id;
  return check(
    await supabase.from("club").insert({ slug, nombre }).select("id").single(),
    "crear club",
  ).id;
}

async function upsertUser(email, nombre) {
  const created = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  });
  if (!created.error) return created.data.user.id;

  // Ya existía: se busca entre los usuarios.
  const list = check(await supabase.auth.admin.listUsers({ perPage: 1000 }), "listar usuarios");
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`crear ${email}: ${created.error.message}`);
  return user.id;
}

async function membership(personaId, clubId, roles) {
  check(
    await supabase
      .from("membresia")
      .upsert({ persona_id: personaId, club_id: clubId, roles, activo: true }),
    "membresía",
  );
}

const rodadero = await upsertClub("el-rodadero", "Club Campestre El Rodadero");
const demo2 = await upsertClub("club-demo-2", "Club Demo 2");

for (const [i, nombre] of ["Cancha 1", "Cancha 2", "Cancha 3"].entries()) {
  check(
    await supabase
      .from("cancha")
      .upsert({ club_id: rodadero, nombre, superficie: i === 2 ? "Cemento" : "Arcilla" }, { onConflict: "club_id,nombre" }),
    "cancha",
  );
}

const plataforma = await upsertUser("plataforma@demo.test", "Paula Plataforma");
check(await supabase.from("admin_plataforma").upsert({ persona_id: plataforma }), "admin_plataforma");

const admin = await upsertUser("admin@demo.test", "Carlos Mendoza");
await membership(admin, rodadero, ["admin", "entrenador"]); // varios roles en un club

const alumno = await upsertUser("alumno@demo.test", "Ana Alumna");
await membership(alumno, rodadero, ["alumno"]);

const multi = await upsertUser("multi@demo.test", "Marta Multiclub");
await membership(multi, rodadero, ["alumno"]);
await membership(multi, demo2, ["admin"]); // varios clubes

await upsertUser("sinclub@demo.test", "Sara Sinclub"); // sin membresías

for (const [id, club] of [[admin, rodadero], [alumno, rodadero]]) {
  check(await supabase.from("persona").update({ club_activo_id: club }).eq("id", id), "club activo");
}

console.log(`Listo. Contraseña de todos: ${PASSWORD}
  plataforma@demo.test  → /platform
  admin@demo.test       → /admin (también /coach)
  alumno@demo.test      → /student
  multi@demo.test       → /select-club (alumno en El Rodadero, admin en Club Demo 2)
  sinclub@demo.test     → /no-club
  Registro abierto: /register?club=el-rodadero`);

