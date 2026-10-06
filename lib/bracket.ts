// Pure tournament bracket/group math — single-elimination seeding with
// byes, balanced round-robin groups, and standings with head-to-head
// tiebreak. No I/O, no Supabase: a server action computes the full set of
// matches here, then writes them in one transaction. Winner propagation
// after a single-elimination match is reported lives in SQL instead (it
// depends on live match results, not something this module can precompute).

export type BracketEntry = { id: string; seed: number | null };

export type GeneratedMatch = {
  round: number;
  slot: number;
  entry1Id: string | null;
  entry2Id: string | null;
  winnerEntryId: string | null; // set only for a round-1 bye, auto-completed
};

export type MatchResult = { entry1Id: string; entry2Id: string; winnerEntryId: string | null };

export type Standing = { entryId: string; wins: number; losses: number; played: number };

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

// The standard recursive bracket seeding order: seedOrder(8) means slot
// i (0-indexed) is occupied by seed seedOrder(8)[i] (1-indexed seed rank).
// Guarantees seed 1 and 2 can only meet in the final, 1-4 not before the
// semifinal, and so on.
export function seedOrder(bracketSize: number): number[] {
  if (bracketSize <= 1) return [1];
  const prev = seedOrder(bracketSize / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s, bracketSize + 1 - s);
  }
  return result;
}

function bySeedThenOrder(entries: BracketEntry[]): BracketEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.seed != null && b.e.seed != null) return a.e.seed - b.e.seed;
      if (a.e.seed != null) return -1;
      if (b.e.seed != null) return 1;
      return a.i - b.i; // stable: keep original (registration) order
    })
    .map(({ e }) => e);
}

// Round 1 plus empty shells for every later round, with byes auto-resolved
// and propagated into round 2 immediately (a round-1 match pairs at most
// one bye against a real entry — bracketSize is always the smallest power
// of 2 >= n, so byes < bracketSize / 2, never two byes in the same match).
export function generateSingleEliminationBracket(entries: BracketEntry[]): GeneratedMatch[] {
  const n = entries.length;
  if (n < 2) throw new Error("Se necesitan al menos 2 inscritos.");

  const bracketSize = nextPowerOfTwo(n);
  const totalRounds = Math.log2(bracketSize);
  const ordered = bySeedThenOrder(entries);
  const order = seedOrder(bracketSize);
  const slots: (BracketEntry | null)[] = order.map((rank) => (rank <= n ? ordered[rank - 1] : null));

  const matches: GeneratedMatch[] = [];
  const round1Count = bracketSize / 2;
  for (let i = 0; i < round1Count; i++) {
    const a = slots[2 * i];
    const b = slots[2 * i + 1];
    const winnerEntryId = a && !b ? a.id : b && !a ? b.id : null;
    matches.push({ round: 1, slot: i, entry1Id: a?.id ?? null, entry2Id: b?.id ?? null, winnerEntryId });
  }

  let roundSize = round1Count / 2;
  for (let r = 2; r <= totalRounds; r++) {
    for (let i = 0; i < roundSize; i++) {
      matches.push({ round: r, slot: i, entry1Id: null, entry2Id: null, winnerEntryId: null });
    }
    roundSize /= 2;
  }

  for (const m of matches.filter((m) => m.round === 1 && m.winnerEntryId)) {
    propagateWinner(matches, m.round, m.slot, m.winnerEntryId as string, totalRounds);
  }

  return matches;
}

export function propagateWinner(
  matches: GeneratedMatch[],
  round: number,
  slot: number,
  winnerEntryId: string,
  totalRounds: number,
): void {
  if (round >= totalRounds) return;
  const nextMatch = matches.find((m) => m.round === round + 1 && m.slot === Math.floor(slot / 2));
  if (!nextMatch) return;
  if (slot % 2 === 0) nextMatch.entry1Id = winnerEntryId;
  else nextMatch.entry2Id = winnerEntryId;
}

// Group sizes as even as possible: the first (n mod numGroups) groups get
// one extra entry. 10 entries, groupSize 4 -> 3 groups sized [4, 3, 3].
export function computeGroupSizes(entryCount: number, groupSize: number): number[] {
  if (entryCount < 1) return [];
  const numGroups = Math.max(1, Math.ceil(entryCount / groupSize));
  const base = Math.floor(entryCount / numGroups);
  const remainder = entryCount % numGroups;
  return Array.from({ length: numGroups }, (_, i) => base + (i < remainder ? 1 : 0));
}

const GROUP_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Snake distribution (left-to-right, then right-to-left, alternating) into
// groups of predetermined size, so seeded entries spread across groups
// instead of stacking the strongest players into group A.
export function splitIntoGroups(
  entries: BracketEntry[],
  groupSize: number,
): { groupLabel: string; entries: BracketEntry[] }[] {
  const sizes = computeGroupSizes(entries.length, groupSize);
  const ordered = bySeedThenOrder(entries);
  const groups: BracketEntry[][] = sizes.map(() => []);

  let idx = 0;
  let leftToRight = true;
  while (idx < ordered.length) {
    const order = leftToRight ? sizes.map((_, i) => i) : sizes.map((_, i) => i).reverse();
    for (const g of order) {
      if (groups[g].length < sizes[g] && idx < ordered.length) {
        groups[g].push(ordered[idx]);
        idx++;
      }
    }
    leftToRight = !leftToRight;
  }

  return groups.map((g, i) => ({ groupLabel: GROUP_LABELS[i] ?? `G${i + 1}`, entries: g }));
}

// Every entry in the group plays every other entry once.
export function roundRobinPairs(entries: BracketEntry[]): [BracketEntry, BracketEntry][] {
  const pairs: [BracketEntry, BracketEntry][] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      pairs.push([entries[i], entries[j]]);
    }
  }
  return pairs;
}

export function computeStandings(entries: BracketEntry[], results: MatchResult[]): Standing[] {
  const table = new Map<string, Standing>(
    entries.map((e) => [e.id, { entryId: e.id, wins: 0, losses: 0, played: 0 }]),
  );
  for (const r of results) {
    if (!r.winnerEntryId) continue;
    const loserId = r.winnerEntryId === r.entry1Id ? r.entry2Id : r.entry1Id;
    const winnerRow = table.get(r.winnerEntryId);
    const loserRow = table.get(loserId);
    if (winnerRow) {
      winnerRow.wins++;
      winnerRow.played++;
    }
    if (loserRow) {
      loserRow.losses++;
      loserRow.played++;
    }
  }
  return entries.map((e) => table.get(e.id)!).sort((a, b) => b.wins - a.wins);
}

// Ranks by wins, breaking ties by head-to-head result, then by the
// original (registration) order of `entries` — Array.sort is stable, so a
// 0 return preserves that order.
export function topQualifiers(
  entries: BracketEntry[],
  results: MatchResult[],
  count: number,
): BracketEntry[] {
  const standingByEntry = new Map(computeStandings(entries, results).map((s) => [s.entryId, s]));
  const sorted = [...entries].sort((a, b) => {
    const wa = standingByEntry.get(a.id)?.wins ?? 0;
    const wb = standingByEntry.get(b.id)?.wins ?? 0;
    if (wa !== wb) return wb - wa;
    const headToHead = results.find(
      (r) =>
        (r.entry1Id === a.id && r.entry2Id === b.id) || (r.entry1Id === b.id && r.entry2Id === a.id),
    );
    if (headToHead?.winnerEntryId === a.id) return -1;
    if (headToHead?.winnerEntryId === b.id) return 1;
    return 0;
  });
  return sorted.slice(0, count);
}
