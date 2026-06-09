import { describe, it, expect } from "vitest";
import { resolvePartialBracket, type WinnerPicks } from "./engine/advanceBracket";
import type { KnockoutMatch } from "./engine/buildRoundOf32";
import { R32_SLOTS } from "./admin-r32";

// Verifies that the real Round-of-32 data (the KnockoutFixture shape: matchNumber,
// slot, homeTeamId, awayTeamId) maps cleanly onto the engine's KnockoutMatch and
// is consumed by advanceBracket unchanged. The repointing task will assign a
// proper participant source; advanceBracket only reads matchNumber/slot/teamId, so
// the placeholder source below does not affect advancement.

interface FixtureRow {
  matchNumber: number;
  slot: number;
  homeTeamId: string;
  awayTeamId: string;
}

function fixtureToMatch(f: FixtureRow): KnockoutMatch {
  return {
    matchNumber: f.matchNumber,
    slot: f.slot,
    teamA: { source: { type: "winner", group: "A" }, teamId: f.homeTeamId },
    teamB: { source: { type: "winner", group: "A" }, teamId: f.awayTeamId },
  };
}

/** 16 fully-filled real R32 fixtures with distinct team ids. */
function realR32(): KnockoutMatch[] {
  return R32_SLOTS.map(({ slot, matchNumber }, i) =>
    fixtureToMatch({
      matchNumber,
      slot,
      homeTeamId: `t${2 * i + 1}`,
      awayTeamId: `t${2 * i + 2}`,
    }),
  );
}

describe("real R32 shape feeds advanceBracket", () => {
  it("uses match numbers 73-88 across 16 slots", () => {
    const r32 = realR32();
    expect(r32).toHaveLength(16);
    expect(r32.map((m) => m.matchNumber)).toEqual(
      Array.from({ length: 16 }, (_, i) => 73 + i),
    );
  });

  it("resolves into the full bracket structure with no picks", () => {
    const resolved = resolvePartialBracket(realR32(), new Map());
    // R32 teams are known; later rounds exist but are undetermined.
    const r32Round = resolved.rounds[0];
    expect(r32Round.matches.every((m) => m.teamA.teamId !== null)).toBe(true);
    expect(resolved.rounds.map((r) => r.name)).toEqual([
      "roundOf32",
      "roundOf16",
      "quarterFinals",
      "semiFinals",
      "final",
    ]);
    expect(resolved.complete).toBe(false);
  });

  it("clears a downstream pick when an upstream R32 pick changes, keeping unrelated picks", () => {
    const r32 = realR32();
    const m74 = r32.find((m) => m.matchNumber === 74)!;
    const m73 = r32.find((m) => m.matchNumber === 73)!;

    // M89 is fed by winners of M74 and M77; M90 by winners of M73 and M75.
    const base: WinnerPicks = new Map([
      [73, m73.teamA.teamId],
      [74, m74.teamA.teamId],
      [75, r32.find((m) => m.matchNumber === 75)!.teamA.teamId],
      [77, r32.find((m) => m.matchNumber === 77)!.teamA.teamId],
      [89, m74.teamA.teamId], // advance the M74 winner from M89
      [90, m73.teamA.teamId], // unrelated downstream pick
    ]);
    const before = resolvePartialBracket(r32, base);
    expect(before.effectivePicks.get(89)).toBe(m74.teamA.teamId);
    expect(before.effectivePicks.get(90)).toBe(m73.teamA.teamId);

    // Flip the M74 winner: the team picked in M89 no longer reaches it.
    const changed: WinnerPicks = new Map(base);
    changed.set(74, m74.teamB.teamId);
    const after = resolvePartialBracket(r32, changed);

    expect(after.effectivePicks.get(74)).toBe(m74.teamB.teamId);
    expect(after.effectivePicks.has(89)).toBe(false); // cleared
    expect(after.effectivePicks.get(90)).toBe(m73.teamA.teamId); // intact
  });

  it("advances to a champion when all picks are made", () => {
    const r32 = realR32();
    const picks: WinnerPicks = new Map();
    let resolved = resolvePartialBracket(r32, picks);
    while (!resolved.complete) {
      for (const round of resolved.rounds) {
        for (const m of round.matches) {
          if (m.pick === null && m.teamA.teamId !== null) {
            picks.set(m.matchNumber, m.teamA.teamId);
          }
        }
      }
      resolved = resolvePartialBracket(r32, picks);
    }
    expect(resolved.complete).toBe(true);
    expect(resolved.championTeamId).not.toBeNull();
  });
});
