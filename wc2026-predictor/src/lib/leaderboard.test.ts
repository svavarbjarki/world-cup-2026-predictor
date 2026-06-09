import { describe, it, expect } from "vitest";
import { computeLeaderboard, type LeaderboardInput } from "./leaderboard-compute";

const GROUP_CONFIG = { exact: 3, result: 1, wrong: 0 };
const KO_CONFIG = { correct: 3, wrong: 0 };

function baseInput(over: Partial<LeaderboardInput> = {}): LeaderboardInput {
  return {
    users: [
      { id: "u1", displayName: "Bea" },
      { id: "u2", displayName: "Ada" },
    ],
    groupPredictions: [],
    groupResults: new Map(),
    knockoutPredictions: [],
    knockoutResults: new Map(),
    awardPredictions: [],
    awardResult: null,
    groupConfig: GROUP_CONFIG,
    knockoutConfig: KO_CONFIG,
    awardPoints: 5,
    ...over,
  };
}

const EMPTY_AWARD = {
  winnerTeamId: null,
  goldenBallPlayerId: null,
  goldenBootPlayerId: null,
  goldenGlovePlayerId: null,
  youngPlayerId: null,
};

describe("computeLeaderboard", () => {
  it("scores everyone 0 with no results, ordered by name (tie-break)", () => {
    const rows = computeLeaderboard(
      baseInput({
        groupPredictions: [
          { userId: "u1", fixtureId: "f1", homeGoals: 2, awayGoals: 1 },
          { userId: "u2", fixtureId: "f1", homeGoals: 0, awayGoals: 0 },
        ],
      }),
    );
    expect(rows.every((r) => r.totalPoints === 0)).toBe(true);
    // All tied on 0, so order is by display name ascending: Ada before Bea.
    expect(rows.map((r) => r.displayName)).toEqual(["Ada", "Bea"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]); // tied totals share rank
  });

  it("awards group points via the engine once a result exists", () => {
    const rows = computeLeaderboard(
      baseInput({
        groupPredictions: [
          { userId: "u1", fixtureId: "f1", homeGoals: 2, awayGoals: 1 }, // exact
          { userId: "u2", fixtureId: "f1", homeGoals: 3, awayGoals: 1 }, // right result
        ],
        groupResults: new Map([["f1", { homeGoals: 2, awayGoals: 1 }]]),
      }),
    );
    const u1 = rows.find((r) => r.userId === "u1")!;
    const u2 = rows.find((r) => r.userId === "u2")!;
    expect(u1.groupPoints).toBe(3); // exact
    expect(u2.groupPoints).toBe(1); // correct result, wrong score
    expect(rows[0].userId).toBe("u1"); // higher total ranks first
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("awards knockout points and sums both phases", () => {
    const rows = computeLeaderboard(
      baseInput({
        groupPredictions: [
          { userId: "u1", fixtureId: "f1", homeGoals: 1, awayGoals: 0 },
        ],
        groupResults: new Map([["f1", { homeGoals: 1, awayGoals: 0 }]]),
        knockoutPredictions: [
          { userId: "u1", matchNumber: 73, predictedWinnerTeamId: "br" },
          { userId: "u2", matchNumber: 73, predictedWinnerTeamId: "ar" },
        ],
        knockoutResults: new Map([[73, "br"]]),
      }),
    );
    const u1 = rows.find((r) => r.userId === "u1")!;
    const u2 = rows.find((r) => r.userId === "u2")!;
    expect(u1.groupPoints).toBe(3);
    expect(u1.knockoutPoints).toBe(3);
    expect(u1.totalPoints).toBe(6);
    expect(u2.knockoutPoints).toBe(0); // wrong team
    expect(u2.totalPoints).toBe(0);
  });

  it("respects custom point values from config", () => {
    const rows = computeLeaderboard(
      baseInput({
        groupConfig: { exact: 10, result: 4, wrong: -1 },
        groupPredictions: [
          { userId: "u1", fixtureId: "f1", homeGoals: 2, awayGoals: 1 }, // exact
          { userId: "u2", fixtureId: "f1", homeGoals: 0, awayGoals: 2 }, // wrong
        ],
        groupResults: new Map([["f1", { homeGoals: 2, awayGoals: 1 }]]),
      }),
    );
    expect(rows.find((r) => r.userId === "u1")!.groupPoints).toBe(10);
    expect(rows.find((r) => r.userId === "u2")!.groupPoints).toBe(-1);
  });

  it("awards flat points per correct category, contributing to the total", () => {
    const rows = computeLeaderboard(
      baseInput({
        awardPoints: 5,
        awardPredictions: [
          {
            ...EMPTY_AWARD,
            userId: "u1",
            winnerTeamId: "br", // correct
            goldenBallPlayerId: "p1", // correct
            goldenBootPlayerId: "pX", // wrong
          },
          { ...EMPTY_AWARD, userId: "u2", winnerTeamId: "ar" }, // wrong
        ],
        awardResult: {
          ...EMPTY_AWARD,
          winnerTeamId: "br",
          goldenBallPlayerId: "p1",
          goldenBootPlayerId: "p2",
        },
      }),
    );
    const u1 = rows.find((r) => r.userId === "u1")!;
    const u2 = rows.find((r) => r.userId === "u2")!;
    expect(u1.awardPoints).toBe(10); // two correct x 5
    expect(u1.totalPoints).toBe(10);
    expect(u2.awardPoints).toBe(0);
  });

  it("awards 0 when no award result is entered", () => {
    const rows = computeLeaderboard(
      baseInput({
        awardPredictions: [
          { ...EMPTY_AWARD, userId: "u1", winnerTeamId: "br" },
        ],
        awardResult: null,
      }),
    );
    expect(rows.every((r) => r.awardPoints === 0)).toBe(true);
  });

  it("ignores predictions whose match has no result yet", () => {
    const rows = computeLeaderboard(
      baseInput({
        groupPredictions: [
          { userId: "u1", fixtureId: "f1", homeGoals: 2, awayGoals: 1 },
        ],
        groupResults: new Map(), // f1 not played
        knockoutPredictions: [
          { userId: "u1", matchNumber: 73, predictedWinnerTeamId: "br" },
        ],
        knockoutResults: new Map(), // M73 not played
      }),
    );
    expect(rows.every((r) => r.totalPoints === 0)).toBe(true);
  });
});
