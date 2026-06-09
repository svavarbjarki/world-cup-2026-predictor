import { describe, it, expect } from "vitest";
import { resolvePartialBracket, type WinnerPicks } from "./advanceBracket";
import { buildRoundOf32 } from "./buildRoundOf32";
import type { KnockoutMatch } from "./buildRoundOf32";
import type { ThirdPlaceEntry } from "./rankThirdPlaceTeams";
import type { GroupLetter, GroupStanding } from "./types";

const ALL_GROUPS: GroupLetter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

function standing(teamId: string): GroupStanding {
  return {
    teamId, played: 3, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
  };
}
function makeThirds(groups: GroupLetter[]): ThirdPlaceEntry[] {
  return groups.map((group, index) => ({
    group,
    standing: standing(`3-${group}`),
    rank: index + 1,
    qualified: true,
  }));
}
function roundOf32(): KnockoutMatch[] {
  return buildRoundOf32(
    new Map(ALL_GROUPS.map((g) => [g, `W-${g}`])),
    new Map(ALL_GROUPS.map((g) => [g, `RU-${g}`])),
    makeThirds(["A", "B", "C", "D", "E", "F", "G", "H"]),
  );
}

/** Look up a match across all rounds of a resolved bracket. */
function findMatch(
  rounds: ReturnType<typeof resolvePartialBracket>["rounds"],
  matchNumber: number,
) {
  for (const r of rounds) {
    const m = r.matches.find((x) => x.matchNumber === matchNumber);
    if (m) return m;
  }
  throw new Error(`match ${matchNumber} not found`);
}

describe("resolvePartialBracket", () => {
  it("leaves later matches undetermined until their feeders are picked", () => {
    const r32 = roundOf32();
    // No picks at all.
    const res = resolvePartialBracket(r32, new Map());

    expect(res.complete).toBe(false);
    expect(res.championTeamId).toBeNull();
    // R32 teams are known from the group stage.
    expect(findMatch(res.rounds, 73).teamA.teamId).not.toBeNull();
    // R16 and beyond have no teams yet.
    expect(findMatch(res.rounds, 89).teamA.teamId).toBeNull();
    expect(findMatch(res.rounds, 89).teamB.teamId).toBeNull();
    expect(findMatch(res.rounds, 104).teamA.teamId).toBeNull();
  });

  it("fills a later match once both its feeders are decided", () => {
    const r32 = roundOf32();
    // M89 is fed by winners of M74 and M77.
    const m74 = r32.find((m) => m.matchNumber === 74)!;
    const m77 = r32.find((m) => m.matchNumber === 77)!;
    const picks: WinnerPicks = new Map([
      [74, m74.teamA.teamId],
      [77, m77.teamA.teamId],
    ]);
    const res = resolvePartialBracket(r32, picks);

    const m89 = findMatch(res.rounds, 89);
    expect(m89.teamA.teamId).toBe(m74.teamA.teamId);
    expect(m89.teamB.teamId).toBe(m77.teamA.teamId);
    expect(m89.pick).toBeNull(); // determined but not yet picked
  });

  it("drops a downstream pick when an upstream change eliminates its team, leaving unrelated picks intact", () => {
    const r32 = roundOf32();
    const m74 = r32.find((m) => m.matchNumber === 74)!;
    const m77 = r32.find((m) => m.matchNumber === 77)!;
    const m73 = r32.find((m) => m.matchNumber === 73)!;
    const m75 = r32.find((m) => m.matchNumber === 75)!;

    // M89 is fed by 74 and 77; M90 is fed by 73 and 75.
    const base: WinnerPicks = new Map([
      [73, m73.teamA.teamId],
      [74, m74.teamA.teamId],
      [75, m75.teamA.teamId],
      [77, m77.teamA.teamId],
      [89, m74.teamA.teamId], // pick the winner of 74 to advance from M89
      [90, m73.teamA.teamId], // unrelated downstream pick
    ]);

    const before = resolvePartialBracket(r32, base);
    expect(before.effectivePicks.get(89)).toBe(m74.teamA.teamId);
    expect(before.effectivePicks.get(90)).toBe(m73.teamA.teamId);

    // Change the M74 winner to the other team. The team picked in M89 no longer
    // reaches M89, so the M89 pick must be cleared. M90 is untouched.
    const changed: WinnerPicks = new Map(base);
    changed.set(74, m74.teamB.teamId);

    const after = resolvePartialBracket(r32, changed);
    expect(after.effectivePicks.get(74)).toBe(m74.teamB.teamId);
    expect(after.effectivePicks.has(89)).toBe(false); // cleared
    expect(findMatch(after.rounds, 89).pick).toBeNull();
    expect(after.effectivePicks.get(90)).toBe(m73.teamA.teamId); // intact
  });

  it("cascades invalidation through multiple rounds", () => {
    const r32 = roundOf32();
    // Build a full bracket by always advancing teamA, then change one R32 pick
    // and confirm the whole downstream chain that carried that team is cleared.
    const picks: WinnerPicks = new Map();
    let res = resolvePartialBracket(r32, picks);
    while (!res.complete) {
      for (const round of res.rounds) {
        for (const m of round.matches) {
          if (m.pick === null && m.teamA.teamId !== null) {
            picks.set(m.matchNumber, m.teamA.teamId);
          }
        }
      }
      res = resolvePartialBracket(r32, picks);
    }
    expect(res.complete).toBe(true);
    expect(res.effectivePicks.size).toBe(31); // 16 + 8 + 4 + 2 + 1
    expect(res.championTeamId).not.toBeNull();

    // Flip M74 to teamB. M89 (R16), M97 (QF), M101 (SF), M104 (final) all carried
    // the old M74 winner down teamA's side, so they should all drop.
    const changed: WinnerPicks = new Map(picks);
    const m74 = r32.find((m) => m.matchNumber === 74)!;
    changed.set(74, m74.teamB.teamId);
    const after = resolvePartialBracket(r32, changed);

    expect(after.effectivePicks.has(89)).toBe(false);
    expect(after.effectivePicks.has(97)).toBe(false);
    expect(after.effectivePicks.has(101)).toBe(false);
    expect(after.effectivePicks.has(104)).toBe(false);
    expect(after.championTeamId).toBeNull();
    expect(after.complete).toBe(false);
    // A pick on the opposite half of the bracket survives.
    expect(after.effectivePicks.has(96)).toBe(true);
  });
});
