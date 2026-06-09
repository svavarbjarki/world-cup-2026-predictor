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
  type LeaderboardRow,
} from "@/lib/leaderboard-compute";

export type { LeaderboardRow } from "@/lib/leaderboard-compute";

/** Load everything the leaderboard needs and compute it on the fly. */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
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
      select: { groupFixtureId: true, homeGoals: true, awayGoals: true },
    }),
    prisma.knockoutPrediction.findMany({
      select: { userId: true, matchNumber: true, predictedWinnerTeamId: true },
    }),
    prisma.knockoutResult.findMany({
      select: { matchNumber: true, actualWinnerTeamId: true },
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

  return computeLeaderboard({
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
  });
}
