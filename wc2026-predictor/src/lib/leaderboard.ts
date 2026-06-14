// Prisma loader for the leaderboard. Computes points ON THE FLY per request (the
// group is tiny and results change as the organizer enters them, so recomputing
// avoids any stored-score invalidation). The math lives in the pure, testable
// computeLeaderboard; this file only loads rows and the Settings point values.

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_GROUP_SCORING,
  DEFAULT_KNOCKOUT_SCORING,
  type GroupScoringConfig,
  type KnockoutScoringConfig,
} from "@/lib/engine/scoring";
import {
  computeLeaderboard,
  type LeaderboardInput,
  type LeaderboardRow,
} from "@/lib/leaderboard-compute";

export type { LeaderboardRow } from "@/lib/leaderboard-compute";

/** Which single result the admin entered most recently, for the movement delta. */
type MostRecentResult =
  | { type: "group"; key: string }
  | { type: "knockout"; key: number }
  | null;

interface LoadedLeaderboard {
  input: LeaderboardInput;
  mostRecent: MostRecentResult;
}

/** Load every input the leaderboard needs, plus which result was entered last. */
async function loadLeaderboard(): Promise<LoadedLeaderboard> {
  const [
    users,
    groupPreds,
    groupResults,
    koPreds,
    koResults,
    awardPreds,
    awardResult,
    settings,
  ] = await Promise.all([
    prisma.user.findMany({ select: { id: true, displayName: true } }),
    prisma.groupPrediction.findMany({
      select: {
        userId: true,
        groupFixtureId: true,
        homeGoals: true,
        awayGoals: true,
      },
    }),
    prisma.groupResult.findMany({
      select: {
        groupFixtureId: true,
        homeGoals: true,
        awayGoals: true,
        enteredAt: true,
      },
    }),
    prisma.knockoutPrediction.findMany({
      select: { userId: true, matchNumber: true, predictedWinnerTeamId: true },
    }),
    prisma.knockoutResult.findMany({
      select: { matchNumber: true, actualWinnerTeamId: true, enteredAt: true },
    }),
    prisma.awardPrediction.findMany({
      select: {
        userId: true,
        winnerTeamId: true,
        goldenBallPlayerId: true,
        goldenBootPlayerId: true,
        goldenGlovePlayerId: true,
        youngPlayerId: true,
      },
    }),
    prisma.awardResult.findUnique({ where: { id: 1 } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const groupConfig: GroupScoringConfig = settings
    ? {
        exact: settings.groupExactPoints,
        result: settings.groupResultPoints,
        wrong: settings.groupWrongPoints,
      }
    : DEFAULT_GROUP_SCORING;
  const knockoutConfig: KnockoutScoringConfig = settings
    ? {
        correct: settings.knockoutCorrectPoints,
        wrong: settings.knockoutWrongPoints,
      }
    : DEFAULT_KNOCKOUT_SCORING;

  // The most recently entered result across both result tables, by enteredAt.
  let mostRecent: MostRecentResult = null;
  let mostRecentAt = -Infinity;
  for (const r of groupResults) {
    if (r.enteredAt.getTime() > mostRecentAt) {
      mostRecentAt = r.enteredAt.getTime();
      mostRecent = { type: "group", key: r.groupFixtureId };
    }
  }
  for (const r of koResults) {
    if (r.enteredAt.getTime() > mostRecentAt) {
      mostRecentAt = r.enteredAt.getTime();
      mostRecent = { type: "knockout", key: r.matchNumber };
    }
  }

  const input: LeaderboardInput = {
    users,
    groupPredictions: groupPreds.map((p) => ({
      userId: p.userId,
      fixtureId: p.groupFixtureId,
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
    })),
    groupResults: new Map(
      groupResults.map((r) => [
        r.groupFixtureId,
        { homeGoals: r.homeGoals, awayGoals: r.awayGoals },
      ]),
    ),
    knockoutPredictions: koPreds,
    knockoutResults: new Map(
      koResults.map((r) => [r.matchNumber, r.actualWinnerTeamId]),
    ),
    awardPredictions: awardPreds,
    awardResult: awardResult
      ? {
          winnerTeamId: awardResult.winnerTeamId,
          goldenBallPlayerId: awardResult.goldenBallPlayerId,
          goldenBootPlayerId: awardResult.goldenBootPlayerId,
          goldenGlovePlayerId: awardResult.goldenGlovePlayerId,
          youngPlayerId: awardResult.youngPlayerId,
        }
      : null,
    groupConfig,
    knockoutConfig,
    awardPoints: settings ? settings.awardPoints : 5,
  };

  return { input, mostRecent };
}

/** Load everything the leaderboard needs and compute it on the fly. */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { input } = await loadLeaderboard();
  return computeLeaderboard(input);
}

/** A player's change since the most recently entered result. */
export interface LeaderboardMovement {
  /** Rank change versus the standing before the most recent result. */
  direction: "up" | "down" | "same";
  /** Points this player earned from that single most recent result. */
  points: number;
}

export interface LeaderboardWithMovement {
  rows: LeaderboardRow[];
  /**
   * Per-user movement keyed by userId. Empty when no result has been entered yet
   * (so the UI shows no arrows). Derived by recomputing the standing with the most
   * recent result removed and comparing rank and total to the current standing.
   */
  movement: Map<string, LeaderboardMovement>;
}

/**
 * The leaderboard plus how each player moved after the most recently entered
 * match result. The previous standing is the current inputs with that one result
 * removed; since scoring is per match, the total delta equals the points that
 * result awarded each player, and the rank delta gives the up/down/same arrow.
 */
export async function getLeaderboardWithMovement(): Promise<LeaderboardWithMovement> {
  const { input, mostRecent } = await loadLeaderboard();
  const rows = computeLeaderboard(input);

  const movement = new Map<string, LeaderboardMovement>();
  if (!mostRecent) return { rows, movement };

  // Recompute the standing as it was BEFORE the most recent result, by dropping
  // just that result from the inputs.
  let previousInput: LeaderboardInput;
  if (mostRecent.type === "group") {
    const groupResults = new Map(input.groupResults);
    groupResults.delete(mostRecent.key);
    previousInput = { ...input, groupResults };
  } else {
    const knockoutResults = new Map(input.knockoutResults);
    knockoutResults.delete(mostRecent.key);
    previousInput = { ...input, knockoutResults };
  }

  const previous = computeLeaderboard(previousInput);
  const prevRank = new Map(previous.map((r) => [r.userId, r.rank]));
  const prevTotal = new Map(previous.map((r) => [r.userId, r.totalPoints]));

  for (const row of rows) {
    const beforeRank = prevRank.get(row.userId) ?? row.rank;
    const beforeTotal = prevTotal.get(row.userId) ?? row.totalPoints;
    const direction =
      row.rank < beforeRank ? "up" : row.rank > beforeRank ? "down" : "same";
    movement.set(row.userId, {
      direction,
      points: row.totalPoints - beforeTotal,
    });
  }

  return { rows, movement };
}
