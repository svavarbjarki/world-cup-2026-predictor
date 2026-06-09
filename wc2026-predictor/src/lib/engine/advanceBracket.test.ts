import { describe, it, expect } from "vitest";
import {
  advanceRound,
  buildKnockoutBracket,
  type WinnerPicks,
} from "./advanceBracket";
import { buildRoundOf32 } from "./buildRoundOf32";
import type { KnockoutMatch } from "./buildRoundOf32";
import type { ThirdPlaceEntry } from "./rankThirdPlaceTeams";
import type { GroupLetter, GroupStanding } from "./types";

const ALL_GROUPS: GroupLetter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

function fullWinners(): Map<GroupLetter, string> {
  return new Map(ALL_GROUPS.map((g) => [g, `W-${g}`]));
}
function fullRunnersUp(): Map<GroupLetter, string> {
  return new Map(ALL_GROUPS.map((g) => [g, `RU-${g}`]));
}
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

/** A round of 32 fixture using a fixed third-place combination. */
function roundOf32(): KnockoutMatch[] {
  return buildRoundOf32(
    fullWinners(),
    fullRunnersUp(),
    makeThirds(["A", "B", "C", "D", "E", "F", "G", "H"]),
  );
}

/** Add a winner pick (always teamA) for each match. Mutates and returns picks. */
function pickTeamA(picks: WinnerPicks, matches: KnockoutMatch[]): WinnerPicks {
  for (const m of matches) picks.set(m.matchNumber, m.teamA.teamId);
  return picks;
}

describe("advanceRound", () => {
  it("advances the round of 32 into the correct round-of-16 matchups", () => {
    const r32 = roundOf32();
    const picks: WinnerPicks = pickTeamA(new Map(), r32);
    const r16 = advanceRound(r32, picks);

    expect(r16).toHaveLength(8);
    expect(r16.map((m) => m.matchNumber)).toEqual([89, 90, 91, 92, 93, 94, 95, 96]);
    expect(r16.map((m) => m.slot)).toEqual([17, 18, 19, 20, 21, 22, 23, 24]);

    // Article 12.7: M89 is fed by winners of M74 and M77.
    const m89 = r16.find((m) => m.matchNumber === 89)!;
    const winnerOf = (num: number) =>
      r32.find((m) => m.matchNumber === num)!.teamA.teamId;
    expect(m89.teamA).toEqual({
      source: { type: "matchWinner", matchNumber: 74 },
      teamId: winnerOf(74),
    });
    expect(m89.teamB).toEqual({
      source: { type: "matchWinner", matchNumber: 77 },
      teamId: winnerOf(77),
    });

    // M90 is fed by winners of M73 and M75.
    const m90 = r16.find((m) => m.matchNumber === 90)!;
    expect(m90.teamA.source).toEqual({ type: "matchWinner", matchNumber: 73 });
    expect(m90.teamB.source).toEqual({ type: "matchWinner", matchNumber: 75 });
  });

  it("rejects a missing or invalid winner pick", () => {
    const r32 = roundOf32();
    expect(() => advanceRound(r32, new Map())).toThrow(/Missing winner pick/);

    const badPicks: WinnerPicks = pickTeamA(new Map(), r32);
    badPicks.set(73, "not-a-real-team");
    expect(() => advanceRound(r32, badPicks)).toThrow(/is not one of/);
  });

  it("refuses to advance the final (no further round)", () => {
    const finalMatch: KnockoutMatch[] = [
      {
        matchNumber: 104,
        slot: 31,
        teamA: { source: { type: "matchWinner", matchNumber: 101 }, teamId: "X" },
        teamB: { source: { type: "matchWinner", matchNumber: 102 }, teamId: "Y" },
      },
    ];
    expect(() =>
      advanceRound(finalMatch, new Map([[104, "X"]])),
    ).toThrow(/No knockout round advances/);
  });
});

describe("buildKnockoutBracket", () => {
  /** Play the whole bracket choosing teamA at every step, accumulating picks. */
  function playAllTeamA() {
    const r32 = roundOf32();
    const picks: WinnerPicks = new Map();
    pickTeamA(picks, r32);
    const r16 = advanceRound(r32, picks);
    pickTeamA(picks, r16);
    const qf = advanceRound(r16, picks);
    pickTeamA(picks, qf);
    const sf = advanceRound(qf, picks);
    pickTeamA(picks, sf);
    const final = advanceRound(sf, picks);
    pickTeamA(picks, final);
    return { r32, picks, r16, qf, sf, final };
  }

  it("produces a full bracket with the right match counts and a single champion", () => {
    const { r32, picks } = playAllTeamA();
    const bracket = buildKnockoutBracket(r32, picks);

    expect(bracket.roundOf32).toHaveLength(16);
    expect(bracket.roundOf16).toHaveLength(8);
    expect(bracket.quarterFinals).toHaveLength(4);
    expect(bracket.semiFinals).toHaveLength(2);
    expect(bracket.final).toHaveLength(1);

    expect(bracket.final[0].matchNumber).toBe(104);
    // Champion is the picked winner of the final, one of the final's two teams.
    const finalTeams = [bracket.final[0].teamA.teamId, bracket.final[0].teamB.teamId];
    expect(finalTeams).toContain(bracket.championTeamId);
    expect(bracket.championTeamId).toBe(bracket.final[0].teamA.teamId);
  });

  it("matches a step-by-step advance through every round", () => {
    const { r32, picks, r16, qf, sf, final } = playAllTeamA();
    const bracket = buildKnockoutBracket(r32, picks);
    expect(bracket.roundOf16).toEqual(r16);
    expect(bracket.quarterFinals).toEqual(qf);
    expect(bracket.semiFinals).toEqual(sf);
    expect(bracket.final).toEqual(final);
  });

  it("is deterministic: same input yields the same bracket", () => {
    const { r32, picks } = playAllTeamA();
    const first = buildKnockoutBracket(r32, picks);
    const second = buildKnockoutBracket(r32, picks);
    expect(second).toEqual(first);
  });

  it("handles mixed picks (not always teamA) consistently", () => {
    const r32 = roundOf32();
    const picks: WinnerPicks = new Map();
    // Alternate teamA / teamB by match number parity at every round.
    const pickAlternating = (matches: KnockoutMatch[]) => {
      for (const m of matches) {
        picks.set(
          m.matchNumber,
          m.matchNumber % 2 === 0 ? m.teamA.teamId : m.teamB.teamId,
        );
      }
    };
    pickAlternating(r32);
    let round = advanceRound(r32, picks);
    while (round.length > 1) {
      pickAlternating(round);
      round = advanceRound(round, picks);
    }
    pickAlternating(round); // the final

    const bracket = buildKnockoutBracket(r32, picks);
    expect(bracket.championTeamId).toBe(picks.get(104));
    const finalTeams = [bracket.final[0].teamA.teamId, bracket.final[0].teamB.teamId];
    expect(finalTeams).toContain(bracket.championTeamId);
  });
});
