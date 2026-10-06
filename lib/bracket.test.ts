import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeGroupSizes,
  computeStandings,
  generateSingleEliminationBracket,
  nextPowerOfTwo,
  roundRobinPairs,
  seedOrder,
  splitIntoGroups,
  topQualifiers,
  type BracketEntry,
  type MatchResult,
} from "./bracket.ts";

function entries(n: number, seeded = false): BracketEntry[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: seeded ? i + 1 : null }));
}

describe("nextPowerOfTwo", () => {
  it("rounds up to the nearest power of 2", () => {
    assert.equal(nextPowerOfTwo(1), 1);
    assert.equal(nextPowerOfTwo(2), 2);
    assert.equal(nextPowerOfTwo(3), 4);
    assert.equal(nextPowerOfTwo(8), 8);
    assert.equal(nextPowerOfTwo(9), 16);
    assert.equal(nextPowerOfTwo(13), 16);
  });
});

describe("seedOrder", () => {
  it("keeps seed 1 and 2 in opposite halves at every size", () => {
    for (const size of [2, 4, 8, 16, 32]) {
      const order = seedOrder(size);
      assert.equal(order.length, size);
      assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i + 1));
      const pos1 = order.indexOf(1);
      const pos2 = order.indexOf(2);
      assert.equal(Math.floor(pos1 / (size / 2)), 0, "seed 1 in the top half");
      assert.equal(Math.floor(pos2 / (size / 2)), 1, "seed 2 in the bottom half");
    }
  });
  it("matches the known size-8 order", () => {
    assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("generateSingleEliminationBracket", () => {
  it("rejects fewer than 2 entries", () => {
    assert.throws(() => generateSingleEliminationBracket(entries(1)));
  });

  it("builds a perfect bracket with no byes for a power-of-2 field", () => {
    const matches = generateSingleEliminationBracket(entries(8, true));
    const round1 = matches.filter((m) => m.round === 1);
    assert.equal(round1.length, 4);
    for (const m of round1) {
      assert.ok(m.entry1Id && m.entry2Id, "no byes expected");
      assert.equal(m.winnerEntryId, null);
    }
    assert.equal(matches.filter((m) => m.round === 2).length, 2);
    assert.equal(matches.filter((m) => m.round === 3).length, 1);
  });

  it("gives byes to the top seeds and auto-advances them to round 2", () => {
    // 10 seeded entries -> bracket size 16, 6 byes to seeds 1-6.
    const matches = generateSingleEliminationBracket(entries(10, true));
    const round1 = matches.filter((m) => m.round === 1);
    assert.equal(round1.length, 8);
    const byeMatches = round1.filter((m) => m.winnerEntryId);
    assert.equal(byeMatches.length, 6, "bracketSize(16) - n(10) = 6 byes");
    for (const m of byeMatches) {
      assert.ok(!m.entry1Id || !m.entry2Id, "a bye match has exactly one real entry");
    }
    // Top 6 seeds (p1..p6) are the ones who got a bye.
    const byeWinners = new Set(byeMatches.map((m) => m.winnerEntryId));
    for (let seed = 1; seed <= 6; seed++) assert.ok(byeWinners.has(`p${seed}`), `seed ${seed} should have a bye`);

    // Round 2 already has both slots filled for the matches fed by two byes.
    const round2 = matches.filter((m) => m.round === 2);
    assert.equal(round2.length, 4);
    const filledRound2 = round2.filter((m) => m.entry1Id && m.entry2Id);
    assert.ok(filledRound2.length >= 1, "at least one round-2 match is already set from two byes");
  });

  it("handles a tiny 3-entry field with a single bye", () => {
    const matches = generateSingleEliminationBracket(entries(3));
    const round1 = matches.filter((m) => m.round === 1);
    assert.equal(round1.length, 2); // bracket size 4
    const byes = round1.filter((m) => m.winnerEntryId);
    assert.equal(byes.length, 1);
    assert.equal(matches.filter((m) => m.round === 2).length, 1);
  });
});

describe("computeGroupSizes", () => {
  it("matches the exact example from the conversation: 10 entries, group size 4 -> [4, 3, 3]", () => {
    assert.deepEqual(computeGroupSizes(10, 4), [4, 3, 3]);
  });
  it("is a perfect split when it divides evenly", () => {
    assert.deepEqual(computeGroupSizes(12, 4), [4, 4, 4]);
  });
  it("collapses to a single group when the group size covers everyone", () => {
    assert.deepEqual(computeGroupSizes(6, 10), [6]);
  });
});

describe("splitIntoGroups", () => {
  it("produces groups whose sizes match computeGroupSizes and cover every entry exactly once", () => {
    const all = entries(10, true);
    const groups = splitIntoGroups(all, 4);
    assert.deepEqual(groups.map((g) => g.entries.length).sort(), [3, 3, 4]);
    const seen = groups.flatMap((g) => g.entries.map((e) => e.id));
    assert.deepEqual([...seen].sort(), all.map((e) => e.id).sort());
  });
  it("spreads top seeds across different groups instead of stacking them", () => {
    const groups = splitIntoGroups(entries(9, true), 3);
    assert.equal(groups.length, 3);
    const groupOfSeed = (id: string) => groups.findIndex((g) => g.entries.some((e) => e.id === id));
    assert.notEqual(groupOfSeed("p1"), groupOfSeed("p2"));
    assert.notEqual(groupOfSeed("p1"), groupOfSeed("p3"));
  });
});

describe("roundRobinPairs", () => {
  it("pairs every entry with every other entry exactly once", () => {
    const pairs = roundRobinPairs(entries(4));
    assert.equal(pairs.length, 6); // 4*3/2
    const labels = pairs.map(([a, b]) => [a.id, b.id].sort().join("-"));
    assert.equal(new Set(labels).size, 6, "no duplicate pairings");
  });
});

describe("computeStandings / topQualifiers", () => {
  const group = entries(3);
  // p1 beats p2, p2 beats p3, p3 beats p1 -> a 3-way tie at 1 win each.
  const results: MatchResult[] = [
    { entry1Id: "p1", entry2Id: "p2", winnerEntryId: "p1" },
    { entry1Id: "p2", entry2Id: "p3", winnerEntryId: "p2" },
    { entry1Id: "p3", entry2Id: "p1", winnerEntryId: "p3" },
  ];

  it("counts wins and losses per entry", () => {
    const standings = computeStandings(group, results);
    for (const s of standings) {
      assert.equal(s.wins, 1);
      assert.equal(s.losses, 1);
    }
  });

  it("breaks a head-to-head tie correctly", () => {
    // p1 beat p2 head-to-head, so p1 outranks p2 despite equal wins.
    const top2 = topQualifiers(group, results, 2).map((e) => e.id);
    assert.equal(top2[0], "p1");
  });

  it("falls back to registration order when there's no head-to-head game", () => {
    const noGames: MatchResult[] = [];
    const top = topQualifiers(entries(3), noGames, 2).map((e) => e.id);
    assert.deepEqual(top, ["p1", "p2"]);
  });
});
