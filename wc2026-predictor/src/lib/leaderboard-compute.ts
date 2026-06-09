// Pure leaderboard computation, separated from the Prisma loader so it is
// testable without a database. All scoring goes through the engine; point values
// are passed in (sourced from Settings by the loader).

import {
  scoreGroupMatch,
  scoreKnockoutMatch,
  type GroupScoringConfig,
  type KnockoutScoringConfig,
} from "./engine/scoring";

export interface LeaderboardInput {
  users: { id: string; displayName: string }[];
  groupPredictions: {
    userId: string;
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
  }[];
  /** Actual group scorelines, keyed by fixtureId. Absent = not played yet. */
  groupResults: Map<string, { homeGoals: number; awayGoals: number }>;
  knockoutPredictions: {
    userId: string;
    matchNumber: number;
    predictedWinnerTeamId: string;
  }[];
  /** Actual knockout winners, keyed by official match number. */
  knockoutResults: Map<number, string>;
  /** Each user's award picks (team + four players), nulls allowed. */
  awardPredictions: AwardPicks[];
  /** The actual award winners, or null if not entered yet. */
  awardResult: AwardPicks | null;
  groupConfig: GroupScoringConfig;
  knockoutConfig: KnockoutScoringConfig;
  /** Flat points per correct award category. */
  awardPoints: number;
}

/** The five award picks (team + four players). null = not picked / not decided. */
export interface AwardPicks {
  userId?: string;
  winnerTeamId: string | null;
  goldenBallPlayerId: string | null;
  goldenBootPlayerId: string | null;
  goldenGlovePlayerId: string | null;
  youngPlayerId: string | null;
}

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  groupPoints: number;
  knockoutPoints: number;
  awardPoints: number;
  totalPoints: number;
  /** 1-based; tied totals share a rank (standard competition ranking). */
  rank: number;
}

/** Count correct award categories times the flat points value. */
function scoreAwards(
  prediction: AwardPicks,
  result: AwardPicks | null,
  points: number,
): number {
  if (!result) return 0;
  const pairs: [string | null, string | null][] = [
    [prediction.winnerTeamId, result.winnerTeamId],
    [prediction.goldenBallPlayerId, result.goldenBallPlayerId],
    [prediction.goldenBootPlayerId, result.goldenBootPlayerId],
    [prediction.goldenGlovePlayerId, result.goldenGlovePlayerId],
    [prediction.youngPlayerId, result.youngPlayerId],
  ];
  let total = 0;
  for (const [pick, actual] of pairs) {
    if (actual != null && pick != null && pick === actual) total += points;
  }
  return total;
}

/**
 * Compute the ranked leaderboard. A prediction only scores once its real result
 * exists; with no results, every total is 0. Ordering is total points
 * descending, then display name ascending as a stable, deterministic tie-break.
 */
export function computeLeaderboard(input: LeaderboardInput): LeaderboardRow[] {
  const groupPoints = new Map<string, number>();
  const knockoutPoints = new Map<string, number>();
  const awardPoints = new Map<string, number>();
  for (const u of input.users) {
    groupPoints.set(u.id, 0);
    knockoutPoints.set(u.id, 0);
    awardPoints.set(u.id, 0);
  }

  for (const pred of input.awardPredictions) {
    if (!pred.userId) continue;
    awardPoints.set(
      pred.userId,
      scoreAwards(pred, input.awardResult, input.awardPoints),
    );
  }

  for (const p of input.groupPredictions) {
    const result = input.groupResults.get(p.fixtureId);
    if (!result) continue;
    const pts = scoreGroupMatch(
      { homeGoals: p.homeGoals, awayGoals: p.awayGoals },
      result,
      input.groupConfig,
    );
    groupPoints.set(p.userId, (groupPoints.get(p.userId) ?? 0) + pts);
  }

  for (const p of input.knockoutPredictions) {
    const actualWinner = input.knockoutResults.get(p.matchNumber);
    if (actualWinner === undefined) continue;
    const pts = scoreKnockoutMatch(
      p.predictedWinnerTeamId,
      actualWinner,
      input.knockoutConfig,
    );
    knockoutPoints.set(p.userId, (knockoutPoints.get(p.userId) ?? 0) + pts);
  }

  const rows: LeaderboardRow[] = input.users.map((u) => {
    const g = groupPoints.get(u.id) ?? 0;
    const k = knockoutPoints.get(u.id) ?? 0;
    const a = awardPoints.get(u.id) ?? 0;
    return {
      userId: u.id,
      displayName: u.displayName,
      groupPoints: g,
      knockoutPoints: k,
      awardPoints: a,
      totalPoints: g + k + a,
      rank: 0,
    };
  });

  rows.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      a.displayName.localeCompare(b.displayName),
  );
  rows.forEach((row, i) => {
    row.rank =
      i > 0 && rows[i - 1].totalPoints === row.totalPoints
        ? rows[i - 1].rank
        : i + 1;
  });

  return rows;
}
