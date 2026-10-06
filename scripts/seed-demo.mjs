// Datos de demo para El Rodadero — pensado para correr DESPUÉS de
// seed-dev.mjs (reusa ese club y las cuentas base). Agrega lo que un demo
// comercial necesita: variedad de canchas/tarifas, suficientes socios para
// un cuadro de torneo convincente, un curso con historial de asistencia, y
// dos torneos — uno listo para generar el cuadro EN VIVO durante el demo,
// otro ya resuelto de punta a punta como respaldo si algo falla en vivo.
//
//   node --env-file=.env.local scripts/seed-demo.mjs --yes
//
// Requiere SUPABASE_SECRET_KEY. Es idempotente donde es razonable (cuentas,
// canchas, tarifas); los pasos de generación de curso/torneo se saltan si
// ya existen (buscan por nombre) en vez de fallar al reintentar.

import { createClient } from "@supabase/supabase-js";

const PASSWORD = "Demo1234!";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.error(`Esto creará datos de demo en ${url}.\nVuelve a correrlo con --yes para confirmar.`);
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const check = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

async function signIn(email) {
  const anon = createClient(url, anonKey);
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return {
    userId: data.user.id,
    client: createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
  };
}

async function upsertUser(email, fullName) {
  const created = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (!created.error) return created.data.user.id;
  const list = check(await admin.auth.admin.listUsers({ perPage: 1000 }), "listar usuarios");
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`crear ${email}: ${created.error.message}`);
  return user.id;
}

async function membership(personId, clubId, roles, extra = {}) {
  check(
    await admin.from("membership").upsert({ person_id: personId, club_id: clubId, roles, active: true, ...extra }),
    "membresía",
  );
}

// ---------------------------------------------------------------------------

const { data: club } = await admin.from("club").select("id, timezone").eq("slug", "el-rodadero-tenis").single();
if (!club) {
  console.error("No encontré el club el-rodadero-tenis — corre primero scripts/seed-dev.mjs");
  process.exit(1);
}
const clubId = club.id;
console.log("Club:", clubId);

// --- 1. Canchas: reactivar las 2 que quedaron inactivas de pruebas previas,
// así el calendario y los filtros muestran variedad real (clay/dura,
// techada/al aire libre) en vez de solo 2 canchas iguales.
for (const name of ["Cancha 1", "Cancha 3"]) {
  const { error } = await admin.from("court").update({ active: true }).eq("club_id", clubId).eq("name", name);
  if (error) console.log(`  (no pude reactivar ${name}: ${error.message})`);
}
console.log("1. Canchas reactivadas (Cancha 1, Cancha 3)");

// --- 2. Tarifas: activar la de clases (estaba apagada) y agregar una de
// curso, que hoy no existe — sin eso el selector de tarifa en Configuración
// de Cursos sale vacío.
await admin.from("rate").update({ active: true }).eq("club_id", clubId).eq("name", "Clases con entrenador");
const { data: existingCourseRate } = await admin.from("rate").select("id").eq("club_id", clubId).eq("name", "Clínica Grupal").maybeSingle();
if (!existingCourseRate) {
  check(
    await admin.from("rate").insert({
      club_id: clubId, name: "Clínica Grupal", service: "course",
      start_time: "06:00", end_time: "22:00", weekdays: [1, 2, 3, 4, 5, 6, 7], price_amount: 35000,
    }),
    "tarifa de curso",
  );
}
console.log("2. Tarifas: clases activada, tarifa de curso lista");

// --- 3. Entrenadores adicionales (2 nuevos, sin rol de admin, para que el
// demo muestre un cuerpo técnico real y no solo al admin haciendo de coach).
const coach2 = await upsertUser("laura.beltran@demo.test", "Laura Beltrán");
await membership(coach2, clubId, ["coach"], { title: "Entrenadora certificada ITF" });
const coach3 = await upsertUser("esteban.quintero@demo.test", "Esteban Quintero");
await membership(coach3, clubId, ["coach"], { title: "Preparador físico y técnico" });
console.log("3. Entrenadores: Laura Beltrán, Esteban Quintero");

// --- 4. Socios: 12 cuentas con nombres reales, suficientes para que un
// cuadro de torneo muestre byes de verdad (no es lo mismo con 4 inscritos
// que con 10-12).
const studentNames = [
  ["juan.restrepo@demo.test", "Juan Pablo Restrepo"],
  ["camila.gomez@demo.test", "María Camila Gómez"],
  ["andres.torres@demo.test", "Andrés Felipe Torres"],
  ["valentina.rios@demo.test", "Valentina Ríos"],
  ["santiago.herrera@demo.test", "Santiago Herrera"],
  ["isabella.marin@demo.test", "Isabella Marín"],
  ["daniel.ospina@demo.test", "Daniel Ospina"],
  ["sofia.jaramillo@demo.test", "Sofía Jaramillo"],
  ["mateo.cardenas@demo.test", "Mateo Cárdenas"],
  ["camila.velez@demo.test", "Camila Vélez"],
  ["nicolas.patino@demo.test", "Nicolás Patiño"],
  ["luciana.zapata@demo.test", "Luciana Zapata"],
];
const studentIds = [];
for (const [email, name] of studentNames) {
  const id = await upsertUser(email, name);
  await membership(id, clubId, ["student"]);
  studentIds.push({ id, name });
}
console.log(`4. ${studentIds.length} socios creados/actualizados`);

const { data: ana } = await admin.from("person").select("id").eq("full_name", "Ana Alumna").single();
const anaId = ana.id;

// --- 5. Canchas y entrenadores que vamos a usar, por id.
const { data: courts } = await admin.from("court").select("id, name").eq("club_id", clubId).eq("active", true).order("name");
const courtByName = Object.fromEntries(courts.map((c) => [c.name, c.id]));

// --- 6. Reservas sueltas en el calendario de esta semana, para que el
// calendario operativo del admin no se vea vacío.
const todayISO = new Date().toISOString().slice(0, 10);
function atLocalTime(dateISO, hhmm) {
  // America/Bogota no tiene horario de verano — offset fijo -05:00 sirve
  // para datos de demo sin depender de zonedTimeToUtcISO aquí.
  return `${dateISO}T${hhmm}:00-05:00`;
}
function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fillerBookings = [
  { court: "Cancha 2", day: 0, start: "08:00", end: "09:00", person: studentIds[0].id, type: "singles" },
  { court: "Cancha 2", day: 0, start: "10:00", end: "11:00", person: studentIds[1].id, type: "doubles" },
  { court: "Suzanne Lenglen", day: 1, start: "09:00", end: "10:00", person: studentIds[2].id, type: "singles" },
  { court: "Cancha 1", day: 1, start: "16:00", end: "17:00", guest: "Visitante Invitado", type: "singles" },
  { court: "Cancha 3", day: 2, start: "07:00", end: "08:00", person: studentIds[3].id, type: "doubles" },
];
for (const b of fillerBookings) {
  const day = addDaysISO(todayISO, b.day);
  const row = {
    club_id: clubId, court_id: courtByName[b.court], type: b.type, status: "confirmed",
    starts_at: atLocalTime(day, b.start), ends_at: atLocalTime(day, b.end), payment_status: "paid",
  };
  if (b.person) row.person_id = b.person; else row.guest_name = b.guest;
  const { error } = await admin.from("booking").insert(row);
  if (error && !error.message.includes("exclusion")) console.log(`  (reserva de relleno: ${error.message})`);
}
console.log("5. Reservas de relleno creadas en el calendario (pagadas, para que no todo sea el flujo de pago pendiente)");

// --- 7. La reserva PENDIENTE DE PAGO que vas a usar en vivo: Ana Alumna, de
// aquí a 3 días, sin comprobante todavía — subilo en vivo durante el demo.
const liveDay = addDaysISO(todayISO, 3);
const { data: liveBooking, error: liveBookingErr } = await admin
  .from("booking")
  .insert({
    club_id: clubId, court_id: courtByName["Suzanne Lenglen"], person_id: anaId, type: "singles",
    status: "confirmed", starts_at: atLocalTime(liveDay, "18:00"), ends_at: atLocalTime(liveDay, "19:00"),
  })
  .select("id")
  .maybeSingle();
if (liveBookingErr && !liveBookingErr.message.includes("exclusion")) console.log(`  (reserva en vivo: ${liveBookingErr.message})`);
console.log("6. Reserva de Ana lista para subir comprobante EN VIVO:", liveBooking?.id ?? "(ya existía)");

console.log("\n— listo con lo rápido de insertar; sigue el curso y los torneos —\n");

// ---------------------------------------------------------------------------
// A partir de acá, todo pasa por las mismas RPCs que usa la app (no
// inserciones directas) — autenticado como admin o como el socio que
// corresponda, exactamente como pasaría en el demo real.
// ---------------------------------------------------------------------------

const { generateSingleEliminationBracket, splitIntoGroups, roundRobinPairs, topQualifiers } =
  await import("../lib/bracket.ts");

const adminSession = await signIn("admin@demo.test");

async function existingByName(table, nameCol, name) {
  const { data } = await admin.from(table).select("id").eq("club_id", clubId).eq(nameCol, name).maybeSingle();
  return data?.id ?? null;
}

// --- 7. Curso: "Clínica de Saque y Volea" — algunas sesiones ya pasaron
// (para que el pase de lista del entrenador tenga historial), otras están
// por venir. 4 inscritos activos, 1 solicitud pendiente para aprobar en vivo.
let courseId = await existingByName("course", "name", "Clínica de Saque y Volea");
if (!courseId) {
  const { data: rate } = await admin.from("rate").select("id").eq("club_id", clubId).eq("name", "Clínica Grupal").single();
  const { data, error } = await adminSession.client.rpc("create_course", {
    p_club: clubId, p_court_id: courtByName["Cancha 2"], p_head_coach_id: coach2,
    p_assistant_coach_id: null, p_name: "Clínica de Saque y Volea", p_level: "Intermedio",
    p_start_date: "2026-09-15", p_end_date: "2026-11-15", p_weekdays: [2, 5],
    p_start_time: "17:00", p_end_time: "18:30", p_capacity: 6, p_rate_id: rate.id,
  });
  if (error) throw new Error(`create_course: ${error.message}`);
  courseId = data;

  const activeStudents = [studentIds[4], studentIds[5], studentIds[6], studentIds[7]]; // Santiago, Isabella, Daniel, Sofía
  for (const s of activeStudents) {
    const { error: e } = await adminSession.client.rpc("enroll_member", { p_course_id: courseId, p_person_id: s.id });
    if (e) console.log(`  (enroll_member ${s.name}: ${e.message})`);
  }
  const pendingStudent = await signIn(studentNames[8][0]); // Mateo — solicitud para aprobar en vivo
  const { error: reqErr } = await pendingStudent.client.rpc("request_enrollment", { p_course_id: courseId });
  if (reqErr) console.log(`  (request_enrollment: ${reqErr.message})`);

  // Asistencia de la primera sesión ya pasada.
  const { data: sessions } = await adminSession.client.rpc("list_course_sessions", { p_course_id: courseId });
  const pastSession = sessions.find((s) => new Date(s.starts_at) < new Date());
  if (pastSession) {
    const presentFlags = [true, true, false, true];
    for (let i = 0; i < activeStudents.length; i++) {
      await adminSession.client.rpc("mark_attendance", {
        p_session_booking_id: pastSession.id, p_person_id: activeStudents[i].id, p_present: presentFlags[i],
      });
    }
  }
  console.log("7. Curso creado con sesiones, 4 inscritos activos, 1 solicitud pendiente (Mateo), asistencia pasada marcada");
} else {
  console.log("7. Curso ya existía — lo dejo tal cual");
}

// --- 8. Torneo en vivo: 10 inscritos, inscripciones TODAVÍA ABIERTAS para
// que el demo muestre "cerrar inscripción -> generar cuadro" como dos pasos
// en vivo. Eliminación directa (10 -> bracket de 16, 6 byes).
let liveTournamentId = await existingByName("tournament", "name", "Copa Octubre");
if (!liveTournamentId) {
  const { data, error } = await adminSession.client.rpc("create_tournament", {
    p_club: clubId, p_name: "Copa Octubre", p_category: "Singles Open",
    p_format: "single_elimination", p_group_size: null, p_advance_per_group: null, p_start_date: "2026-10-20",
  });
  if (error) throw new Error(`create_tournament (vivo): ${error.message}`);
  liveTournamentId = data;
  for (const s of studentIds.slice(0, 10)) {
    const { error: e } = await adminSession.client.rpc("register_entry", { p_tournament_id: liveTournamentId, p_person_id: s.id });
    if (e) console.log(`  (register_entry ${s.name}: ${e.message})`);
  }
  console.log("8. Torneo EN VIVO listo (Copa Octubre, 10 inscritos, cuadro SIN generar — generalo durante el demo)");
} else {
  console.log("8. Torneo en vivo ya existía — lo dejo tal cual (revisa que siga sin cuadro generado)");
}

// --- 9. Torneo de respaldo, completo de punta a punta: grupos + eliminatoria
// con 9 inscritos (3 grupos de 3), todos los resultados cargados, incluida
// la final. Por si algo falla en vivo o para mostrar el formato híbrido sin
// esperar los pasos intermedios.
let backupTournamentId = await existingByName("tournament", "name", "Copa de Clínicas");
if (!backupTournamentId) {
  const { data, error } = await adminSession.client.rpc("create_tournament", {
    p_club: clubId, p_name: "Copa de Clínicas", p_category: "Mixto",
    p_format: "group_knockout", p_group_size: 3, p_advance_per_group: 1, p_start_date: "2026-10-13",
  });
  if (error) throw new Error(`create_tournament (respaldo): ${error.message}`);
  backupTournamentId = data;

  const backupStudents = studentIds.slice(0, 9); // primeros 9
  for (const s of backupStudents) {
    const { error: e } = await adminSession.client.rpc("register_entry", { p_tournament_id: backupTournamentId, p_person_id: s.id });
    if (e) console.log(`  (register_entry ${s.name}: ${e.message})`);
  }

  const { data: entries } = await adminSession.client.rpc("list_tournament_entries", { p_tournament_id: backupTournamentId });
  const bracketEntries = entries.map((e) => ({ id: e.id, seed: null }));
  const groups = splitIntoGroups(bracketEntries, 3);
  const payloadEntries = groups.flatMap((g) => g.entries.map((e) => ({ entry_id: e.id, group_label: g.groupLabel })));
  let groupSlot = 0; // global across groups — see the matching fix in app/actions/tournaments.ts
  const payloadMatches = groups.flatMap((g) =>
    roundRobinPairs(g.entries).map(([a, b]) => ({
      phase: "group", round: 1, slot: groupSlot++, entry1_id: a.id, entry2_id: b.id, winner_entry_id: null,
    })),
  );
  const { error: genErr } = await adminSession.client.rpc("generate_bracket", {
    p_tournament_id: backupTournamentId, p_entries: payloadEntries, p_matches: payloadMatches,
  });
  if (genErr) throw new Error(`generate_bracket (respaldo): ${genErr.message}`);

  // Resultados variados (no siempre gana el mismo lado) para que la tabla
  // de posiciones se vea orgánica, no un barrido de un solo jugador.
  const { data: groupMatches } = await adminSession.client.rpc("list_tournament_matches", { p_tournament_id: backupTournamentId });
  const results = [];
  let i = 0;
  for (const m of groupMatches.filter((m) => m.phase === "group")) {
    const winner = i % 3 === 1 ? m.entry2_id : m.entry1_id;
    await adminSession.client.rpc("report_match_result", {
      p_match_id: m.id, p_winner_entry_id: winner, p_score: i % 2 === 0 ? "6-4, 6-3" : "7-5, 4-6, 6-2",
    });
    results.push({ entry1Id: m.entry1_id, entry2Id: m.entry2_id, winnerEntryId: winner });
    i++;
  }

  const qualifiers = groups.flatMap((g) => topQualifiers(g.entries, results, 1));
  const seeded = qualifiers.map((q, idx) => ({ id: q.id, seed: idx + 1 }));
  const knockout = generateSingleEliminationBracket(seeded).map((m) => ({
    round: m.round, slot: m.slot, entry1_id: m.entry1Id, entry2_id: m.entry2Id, winner_entry_id: m.winnerEntryId,
  }));
  const { error: koErr } = await adminSession.client.rpc("generate_knockout_phase", {
    p_tournament_id: backupTournamentId, p_matches: knockout,
  });
  if (koErr) throw new Error(`generate_knockout_phase: ${koErr.message}`);

  const { data: koMatches } = await adminSession.client.rpc("list_tournament_matches", { p_tournament_id: backupTournamentId });
  for (const m of koMatches.filter((m) => m.phase === "knockout")) {
    await adminSession.client.rpc("report_match_result", { p_match_id: m.id, p_winner_entry_id: m.entry1_id, p_score: "6-3, 6-2" });
  }
  console.log("9. Torneo de RESPALDO completo (Copa de Clínicas: 3 grupos de 3, eliminatoria y final ya jugadas)");
} else {
  console.log("9. Torneo de respaldo ya existía — lo dejo tal cual");
}

await adminSession.client.auth.signOut();

console.log(`\nListo. Contraseña de todas las cuentas nuevas: ${PASSWORD}`);
console.log("Revisa el checklist de pre-demo que te paso aparte antes de presentar.");
