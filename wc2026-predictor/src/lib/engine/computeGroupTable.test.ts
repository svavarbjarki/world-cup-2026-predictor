import { describe, it, expect } from "vitest";
import { computeGroupTable } from "./computeGroupTable";
import type { GroupMatch } from "./types";

// Four fake teams used across the fixtures below.
const A = "team-a";
const B = "team-b";
const C = "team-c";
const D = "team-d";

/** Helper to build a match with less noise in the fixtures. */
function match(
  homeTeamId: string,
  homeGoals: number,
  awayGoals: number,
  awayTeamId: string,
): GroupMatch {
  return { homeTeamId, awayTeamId, homeGoals, awayGoals };
}

/** Convenience: read back the ordered list of team ids from a table. */
function order(matches: GroupMatch[]): string[] {
  return computeGroupTable(matches).map((row) => row.teamId);
}

describe("computeGroupTable", () => {
  it("ranks a normal group with a clear, distinct ordering", () => {
    // A wins all 3, B wins 2, C wins 1, D wins 0.
    const matches: GroupMatch[] = [
      match(A, 2, 0, B),
      match(A, 3, 0, C),
      match(A, 1, 0, D),
      match(B, 2, 0, C),
      match(B, 2, 0, D),
      match(C, 1, 0, D),
    ];

    const table = computeGroupTable(matches);

    expect(table.map((r) => r.teamId)).toEqual([A, B, C, D]);

    // Spot check the leader's full row.
    expect(table[0]).toEqual({
      teamId: A,
      played: 3,
      won: 3,
      drawn: 0,
      lost: 0,
      goalsFor: 6,
      goalsAgainst: 0,
      goalDifference: 6,
      points: 9,
    });

    // And the bottom team, who lost everything.
    expect(table[3]).toEqual({
      teamId: D,
      played: 3,
      won: 0,
      drawn: 0,
      lost: 3,
      goalsFor: 0,
      goalsAgainst: 4,
      goalDifference: -4,
      points: 0,
    });
  });

  it("separates teams level on points by goal difference", () => {
    // A and B both finish on 6 points (2 wins, 1 loss each). A's wins keep a
    // better goal difference (+3) than B's (+2), so A ranks above B.
    const matches: GroupMatch[] = [
      match(A, 2, 1, B), // A beats B
      match(C, 1, 0, A), // A's only loss
      match(A, 3, 0, D), // A wins big
      match(B, 2, 0, C), // B beats C
      match(B, 1, 0, D), // B beats D narrowly
      match(D, 1, 0, C), // D beats C, leaving C and D level on 3
    ];

    const table = computeGroupTable(matches);
    const a = table.find((r) => r.teamId === A)!;
    const b = table.find((r) => r.teamId === B)!;

    expect(a.points).toBe(6);
    expect(b.points).toBe(6);
    expect(a.goalDifference).toBeGreaterThan(b.goalDifference);

    // A above B on goal difference, then C and D below on 3 points.
    expect(order(matches)).toEqual([A, B, C, D]);
  });

  it("separates teams level on points and goal difference by goals scored", () => {
    // A and B both: beat each other? No. We want them level on points and GD
    // but with A having scored more goals.
    // A: draw with B, beat C, beat D. B: draw with A, beat C, beat D.
    // Make A's wins higher scoring but conceding equally so GD ties.
    const matches: GroupMatch[] = [
      match(A, 1, 1, B), // shared draw
      match(A, 3, 1, C), // A scores a lot, concedes some
      match(A, 3, 1, D),
      match(B, 2, 0, C), // B scores fewer, concedes fewer -> same GD
      match(B, 2, 0, D),
      match(C, 1, 1, D), // C and D each pick up a point
    ];

    const table = computeGroupTable(matches);
    const a = table.find((r) => r.teamId === A)!;
    const b = table.find((r) => r.teamId === B)!;

    expect(a.points).toBe(b.points);
    expect(a.goalDifference).toBe(b.goalDifference);
    expect(a.goalsFor).toBeGreaterThan(b.goalsFor);

    // A edges B on goals scored; both lead C and D.
    expect(order(matches).slice(0, 2)).toEqual([A, B]);
  });

  it("handles draws, awarding 1 point each and tallying standings correctly", () => {
    // Every match is a draw, so all four teams finish level on 3 points.
    const matches: GroupMatch[] = [
      match(A, 0, 0, B),
      match(A, 1, 1, C),
      match(A, 2, 2, D),
      match(B, 1, 1, C),
      match(B, 0, 0, D),
      match(C, 3, 3, D),
    ];

    const table = computeGroupTable(matches);

    for (const row of table) {
      expect(row.played).toBe(3);
      expect(row.won).toBe(0);
      expect(row.lost).toBe(0);
      expect(row.drawn).toBe(3);
      expect(row.points).toBe(3);
      expect(row.goalDifference).toBe(0);
    }

    // A specific row: A drew 0-0, 1-1, 2-2 -> scored 3, conceded 3.
    const a = table.find((r) => r.teamId === A)!;
    expect(a.goalsFor).toBe(3);
    expect(a.goalsAgainst).toBe(3);
  });
});
