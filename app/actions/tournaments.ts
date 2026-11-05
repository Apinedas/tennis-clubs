"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import {
  generateSingleEliminationBracket,
  roundRobinPairs,
  splitIntoGroups,
  topQualifiers,
  type BracketEntry,
  type MatchResult,
} from "@/lib/bracket";
import { zonedTimeToUtcISO } from "@/lib/slot-scheduling";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { FormState } from "./auth";

type TournamentFormat = Database["public"]["Enums"]["tournament_format"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const PATH = "/admin/settings/tournaments";

export async function createTournament(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;

  const name = text(formData, "name");
  const category = text(formData, "category");
  const format = text(formData, "format") as TournamentFormat;
  const groupSize = text(formData, "group_size");
  const advancePerGroup = text(formData, "advance_per_group");
  const startDate = text(formData, "start_date");
  const rateId = text(formData, "rate_id");
  const fields = { name, category, format, group_size: groupSize, advance_per_group: advancePerGroup };

  if (name.length < 2) return { error: "Ingresa el nombre del torneo.", fields };
  if (!["single_elimination", "round_robin", "group_knockout"].includes(format)) {
    return { error: "Elige un formato.", fields };
  }
  if (format !== "single_elimination" && (!groupSize || Number(groupSize) < 2)) {
    return { error: "Ingresa un tamaño de grupo de al menos 2.", fields };
  }
  if (format === "group_knockout" && (!advancePerGroup || Number(advancePerGroup) < 1)) {
    return { error: "Ingresa cuántos avanzan por grupo (al menos 1).", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tournament", {
    p_club: clubId,
    p_name: name,
    p_category: (category || null) as string,
    p_format: format,
    p_group_size: format === "single_elimination" ? (null as unknown as number) : Number(groupSize),
    p_advance_per_group: format === "group_knockout" ? Number(advancePerGroup) : (null as unknown as number),
    p_start_date: (startDate || null) as string,
    p_rate_id: (rateId || null) as string,
  });
  if (error) return { error: "No pudimos crear el torneo.", fields };

  revalidatePath(PATH);
  return { message: "Torneo creado." };
}

export async function registerEntry(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const tournamentId = text(formData, "tournament_id");
  const personId = text(formData, "person_id");
  if (!tournamentId || !personId) return { error: "Elige un socio." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_entry", {
    p_tournament_id: tournamentId,
    p_person_id: personId,
  });
  if (error) {
    return { error: error.code === "23505" ? "Ese socio ya está inscrito." : "No pudimos inscribirlo." };
  }

  revalidatePath(PATH);
  return { message: "Socio inscrito." };
}

export async function withdrawEntry(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const entryId = text(formData, "entry_id");
  if (!entryId) return { error: "Falta la inscripción." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_entry", { p_entry_id: entryId });
  if (error) return { error: "No pudimos retirar la inscripción." };

  revalidatePath(PATH);
  return { message: "Inscripción retirada." };
}

export async function toggleRegistration(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context } = await requireArea("admin");
  const clubId = context.clubId as string;
  const tournamentId = text(formData, "tournament_id");
  const open = text(formData, "open") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament")
    .update({ registration_open: open })
    .eq("id", tournamentId)
    .eq("club_id", clubId);
  if (error) return { error: "No pudimos cambiar el estado de inscripción." };

  revalidatePath(PATH);
  return undefined;
}

export async function requestTournamentEntry(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("student");
  const tournamentId = text(formData, "tournament_id");
  const proofPath = text(formData, "payment_proof_path");
  if (!tournamentId) return { error: "Torneo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_tournament_entry", {
    p_tournament_id: tournamentId,
    p_payment_proof_path: (proofPath || null) as string,
  });
  if (error) {
    return {
      error:
        error.code === "22023"
          ? "Las inscripciones están cerradas o falta el comprobante de pago."
          : "No pudimos inscribirte.",
    };
  }

  revalidatePath("/student/tournaments");
  return { message: "Solicitud enviada. Te confirmamos cuando el club la revise." };
}

export async function reviewEntry(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const entryId = text(formData, "entry_id");
  const approve = text(formData, "approve") === "true";
  const note = text(formData, "note");
  if (!entryId) return { error: "Falta la inscripción." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_entry", {
    p_id: entryId,
    p_approve: approve,
    p_note: note || undefined,
  });
  if (error) return { error: "No pudimos procesar la solicitud." };

  revalidatePath(PATH);
  return { message: approve ? "Solicitud aprobada." : "Solicitud rechazada." };
}

export async function generateBracket(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const tournamentId = text(formData, "tournament_id");
  if (!tournamentId) return { error: "Torneo inválido." };

  const supabase = await createClient();
  const [{ data: tournament }, { data: allEntries }] = await Promise.all([
    supabase.from("tournament").select("format, group_size").eq("id", tournamentId).single(),
    supabase.rpc("list_tournament_entries", { p_tournament_id: tournamentId }),
  ]);
  if (!tournament) return { error: "No pudimos cargar el torneo." };
  // Pending/rejected entries haven't cleared review — only approved players
  // make it into the draw.
  const entries = (allEntries ?? []).filter((e) => e.status === "active");
  if (entries.length < 2) return { error: "Necesitas al menos 2 inscritos aprobados." };

  const bracketEntries: BracketEntry[] = entries.map((e) => ({ id: e.id, seed: e.seed }));

  let payloadEntries: { entry_id: string; group_label: string | null }[];
  let payloadMatches: {
    phase: "group" | "knockout";
    round: number;
    slot: number;
    entry1_id: string | null;
    entry2_id: string | null;
    winner_entry_id: string | null;
  }[];

  if (tournament.format === "single_elimination") {
    payloadEntries = bracketEntries.map((e) => ({ entry_id: e.id, group_label: null }));
    try {
      payloadMatches = generateSingleEliminationBracket(bracketEntries).map((m) => ({
        phase: "knockout",
        round: m.round,
        slot: m.slot,
        entry1_id: m.entry1Id,
        entry2_id: m.entry2Id,
        winner_entry_id: m.winnerEntryId,
      }));
    } catch {
      return { error: "Necesitas al menos 2 inscritos." };
    }
  } else {
    const groups = splitIntoGroups(bracketEntries, tournament.group_size ?? 4);
    payloadEntries = groups.flatMap((g) =>
      g.entries.map((e) => ({ entry_id: e.id, group_label: g.groupLabel })),
    );
    // slot must be unique per (tournament, phase, round) across ALL groups,
    // not reset to 0 within each one — a per-group index collides with any
    // other group's match 0, 1, 2… as soon as there's more than one group.
    let slot = 0;
    payloadMatches = groups.flatMap((g) =>
      roundRobinPairs(g.entries).map(([a, b]) => ({
        phase: "group" as const,
        round: 1,
        slot: slot++,
        entry1_id: a.id,
        entry2_id: b.id,
        winner_entry_id: null,
      })),
    );
  }

  const { error } = await supabase.rpc("generate_bracket", {
    p_tournament_id: tournamentId,
    p_entries: payloadEntries,
    p_matches: payloadMatches,
  });
  if (error) return { error: "No pudimos generar el cuadro." };

  revalidatePath(PATH);
  return { message: "Cuadro generado." };
}

export async function generateKnockoutPhase(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const tournamentId = text(formData, "tournament_id");
  if (!tournamentId) return { error: "Torneo inválido." };

  const supabase = await createClient();
  const [{ data: tournament }, { data: entries }, { data: matches }] = await Promise.all([
    supabase.from("tournament").select("advance_per_group").eq("id", tournamentId).single(),
    supabase.rpc("list_tournament_entries", { p_tournament_id: tournamentId }),
    supabase.rpc("list_tournament_matches", { p_tournament_id: tournamentId }),
  ]);
  if (!tournament || !entries || !matches) return { error: "No pudimos cargar el torneo." };

  const groupMatches = matches.filter((m) => m.phase === "group");
  if (groupMatches.some((m) => m.status !== "completed")) {
    return { error: "Todos los partidos de grupo deben tener resultado primero." };
  }

  const groupLabels = [...new Set(entries.map((e) => e.group_label).filter((g): g is string => !!g))];
  const results: MatchResult[] = groupMatches.map((m) => ({
    entry1Id: m.entry1_id as string,
    entry2Id: m.entry2_id as string,
    winnerEntryId: m.winner_entry_id,
  }));

  const qualifiers: BracketEntry[] = groupLabels.flatMap((label) => {
    const groupEntries: BracketEntry[] = entries
      .filter((e) => e.group_label === label)
      .map((e) => ({ id: e.id, seed: e.seed }));
    return topQualifiers(groupEntries, results, tournament.advance_per_group ?? 1);
  });

  if (qualifiers.length < 2) return { error: "No hay suficientes clasificados para una fase eliminatoria." };

  // Seed qualifiers by cross-group standing (1st places first, then 2nd
  // places, …) so group-mates are less likely to meet again immediately.
  const seeded = qualifiers.map((q, i) => ({ id: q.id, seed: i + 1 }));
  const knockoutMatches = generateSingleEliminationBracket(seeded).map((m) => ({
    round: m.round,
    slot: m.slot,
    entry1_id: m.entry1Id,
    entry2_id: m.entry2Id,
    winner_entry_id: m.winnerEntryId,
  }));

  const { error } = await supabase.rpc("generate_knockout_phase", {
    p_tournament_id: tournamentId,
    p_matches: knockoutMatches,
  });
  if (error) return { error: "No pudimos generar la fase eliminatoria." };

  revalidatePath(PATH);
  return { message: "Fase eliminatoria generada." };
}

export async function scheduleMatch(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const matchId = text(formData, "match_id");
  const courtId = text(formData, "court_id");
  const date = text(formData, "date");
  const startTime = text(formData, "start_time");
  const endTime = text(formData, "end_time");
  if (!matchId || !courtId || !date || !startTime || !endTime) {
    return { error: "Completa cancha, fecha y horario." };
  }
  if (startTime >= endTime) return { error: "La hora de fin debe ser posterior a la de inicio." };

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("tournament_match")
    .select("club:club(timezone)")
    .eq("id", matchId)
    .single();
  const timeZone = match?.club?.timezone ?? "America/Bogota";

  const startsAt = zonedTimeToUtcISO(date, startTime, timeZone);
  const endsAt = zonedTimeToUtcISO(date, endTime, timeZone);

  const { error } = await supabase.rpc("schedule_match", {
    p_match_id: matchId,
    p_court_id: courtId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  if (error) {
    return {
      error: error.code === "23P01" ? "Esa cancha ya está ocupada en ese horario." : "No pudimos agendar el partido.",
    };
  }

  revalidatePath(PATH);
  return { message: "Partido agendado." };
}

export async function reportMatchResult(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const matchId = text(formData, "match_id");
  const winnerEntryId = text(formData, "winner_entry_id");
  const score = text(formData, "score");
  if (!matchId || !winnerEntryId) return { error: "Elige quién ganó." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_match_result", {
    p_match_id: matchId,
    p_winner_entry_id: winnerEntryId,
    p_score: (score || null) as string,
  });
  if (error) return { error: "No pudimos registrar el resultado." };

  revalidatePath(PATH);
  return { message: "Resultado registrado." };
}
