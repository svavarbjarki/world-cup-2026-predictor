// The bonus side-game leaderboard: flat points per correct resolved pick, summed
// live (no caching, tiny scale). Fully separate from the main leaderboard and
// main points. The pure tally is split from the Prisma loader so it is testable
// without a database, mirroring leaderboard-compute.ts / leaderboard.ts.

import { prisma } from "@/lib/prisma";
import {
  isBonusPickCorrect,
  type BonusGoalEvent,
  type BonusMatchContext,
} from "@/lib/bonusPredictions";

export interface BonusLeaderboardRow {
  userId: string;
  displayName: string;
  /** Number of correct resolved picks. */
  correct: number;
  points: number;
  /** 1-based; tied points share a rank (standard competition ranking). */
  rank: number;
}

export interface BonusStandingsInput {
  users: { id: string; displayName: string }[];
  predictions: { id: string; matchNumber: number; type: string; line: number | null }[];
  picks: { userId: string; bonusPredictionId: string; choice: string }[];
  /** Grading context per match number (final score + goal events + team ids). */
  contexts: Map<number, BonusMatchContext>;
  pointsPerCorrect: number;
}

/**
 * Rank everyone who has made at least one bonus pick by points (flat value per
 * correct resolved pick). A pick scores only when its match has a computable
 * answer that matches, so unresolved and no-answer (for example 0-0) picks score
 * nothing. Players with picks but no correct ones still appear, with 0 points.
 */
export function computeBonusStandings(
  input: BonusStandingsInput,
): BonusLeaderboardRow[] {
  const predById = new Map(input.predictions.map((p) => [p.id, p]));
  const nameById = new Map(input.users.map((u) => [u.id, u.displayName]));

  const correct = new Map<string, number>();
  const participants = new Set<string>();
  for (const pick of input.picks) {
    participants.add(pick.userId);
    const pred = predById.get(pick.bonusPredictionId);
    if (!pred) continue;
    const ctx = input.contexts.get(pred.matchNumber);
    if (!ctx) continue;
    if (isBonusPickCorrect(pred, ctx, pick.choice)) {
      correct.set(pick.userId, (correct.get(pick.userId) ?? 0) + 1);
    }
  }

  const rows: BonusLeaderboardRow[] = [...participants].map((userId) => {
    const c = correct.get(userId) ?? 0;
    return {
      userId,
      displayName: nameById.get(userId) ?? userId,
      correct: c,
      points: c * input.pointsPerCorrect,
      rank: 0,
    };
  });

  rows.sort(
    (a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName),
  );
  rows.forEach((row, i) => {
    row.rank =
      i > 0 && rows[i - 1].points === row.points ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

function toBonusGoalEvent(g: {
  id: string;
  side: string;
  scorerId: string | null;
  minute: number | null;
}): BonusGoalEvent {
  return { id: g.id, side: g.side, scorerId: g.scorerId, minute: g.minute };
}

/** Build grading contexts (by match number) for the given bonus predictions. */
async function loadContexts(
  predictions: { matchNumber: number }[],
): Promise<Map<number, BonusMatchContext>> {
  const groupNums = predictions
    .map((p) => p.matchNumber)
    .filter((n) => n <= 72);
  const koNums = predictions.map((p) => p.matchNumber).filter((n) => n > 72);

  const [groupFixtures, koFixtures] = await Promise.all([
    groupNums.length
      ? prisma.groupFixture.findMany({
          where: { matchNumber: { in: groupNums } },
          select: {
            id: true,
            matchNumber: true,
            homeTeamId: true,
            awayTeamId: true,
            result: {
              select: { homeGoals: true, awayGoals: true, goalEvents: true },
            },
          },
        })
      : Promise.resolve([]),
    koNums.length
      ? prisma.knockoutFixture.findMany({
          where: { matchNumber: { in: koNums } },
          select: {
            matchNumber: true,
            homeTeamId: true,
            awayTeamId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // Knockout scores/goals live on KnockoutResult, keyed by match number.
  const koResults = koNums.length
    ? await prisma.knockoutResult.findMany({
        where: { matchNumber: { in: koNums } },
        select: {
          matchNumber: true,
          homeGoals: true,
          awayGoals: true,
          goalEvents: true,
        },
      })
    : [];
  const koResultByMatch = new Map(koResults.map((r) => [r.matchNumber, r]));

  const contexts = new Map<number, BonusMatchContext>();

  for (const f of groupFixtures) {
    contexts.set(f.matchNumber, {
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      finalScore: f.result
        ? { homeGoals: f.result.homeGoals, awayGoals: f.result.awayGoals }
        : null,
      goalEvents: f.result ? f.result.goalEvents.map(toBonusGoalEvent) : [],
    });
  }

  for (const f of koFixtures) {
    if (!f.homeTeamId || !f.awayTeamId) continue;
    const result = koResultByMatch.get(f.matchNumber);
    const finalScore =
      result && result.homeGoals != null && result.awayGoals != null
        ? { homeGoals: result.homeGoals, awayGoals: result.awayGoals }
        : null;
    contexts.set(f.matchNumber, {
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      finalScore,
      goalEvents: result ? result.goalEvents.map(toBonusGoalEvent) : [],
    });
  }

  return contexts;
}

/** Load everything the bonus leaderboard needs and compute it live. */
export async function getBonusLeaderboard(): Promise<BonusLeaderboardRow[]> {
  const [users, predictions, picks, settings] = await Promise.all([
    prisma.user.findMany({ select: { id: true, displayName: true } }),
    prisma.bonusPrediction.findMany({
      select: { id: true, matchNumber: true, type: true, line: true },
    }),
    prisma.bonusPredictionPick.findMany({
      select: { userId: true, bonusPredictionId: true, choice: true },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const contexts = await loadContexts(predictions);

  return computeBonusStandings({
    users,
    predictions,
    picks,
    contexts,
    pointsPerCorrect: settings?.bonusPointsPerCorrect ?? 1,
  });
}
