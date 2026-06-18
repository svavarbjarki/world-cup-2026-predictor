// Bonus side-game logic: the four mini-prediction types, lazy generation of one
// per match (with the roster-availability check), and pure grading derived from
// the real score and goal events. This is fully separate from the main game; it
// touches no prediction or scoring logic. Grading returns the correct answer or
// null, where null covers both "match not finished" and "no possible correct
// answer" (for example a 0-0 match for the team/scorer types: nobody is right or
// wrong, which is a valid outcome, not an error).

import { prisma } from "@/lib/prisma";
import type { BonusPrediction } from "@prisma/client";

/** The four bonus types. App code owns this vocabulary (SQLite has no enums). */
export type BonusType = "BTTS" | "OVER_UNDER" | "FIRST_TEAM" | "FIRST_SCORER";

/** Every bonus type, in a stable order. The full random pool when rosters exist. */
export const ALL_BONUS_TYPES: BonusType[] = [
  "BTTS",
  "OVER_UNDER",
  "FIRST_TEAM",
  "FIRST_SCORER",
];

/** Fallback over/under line if Settings has no row yet (matches the schema default). */
export const DEFAULT_BONUS_OVER_UNDER_LINE = 2.5;

/** True when a string is one of the four known bonus types. */
export function isBonusType(value: string): value is BonusType {
  return (ALL_BONUS_TYPES as string[]).includes(value);
}

/** The question text for a bonus type. The over/under line is filled in from the
 *  stored value so a changed config never alters an already-shown question. */
export function bonusQuestion(type: string, line: number | null): string {
  switch (type) {
    case "BTTS":
      return "Both teams to score?";
    case "OVER_UNDER":
      return `Over or under ${line ?? DEFAULT_BONUS_OVER_UNDER_LINE} goals?`;
    case "FIRST_TEAM":
      return "Which team scores first?";
    case "FIRST_SCORER":
      return "Who scores the first goal?";
    default:
      return "Bonus prediction";
  }
}

/**
 * Whether a submitted choice is valid for the bonus type. Team picks must be one
 * of the two match teams; scorer picks must be a player from either squad (the
 * caller supplies the eligible player ids). Enforced server-side at submit time.
 */
export function isValidBonusChoice(
  type: string,
  choice: string,
  opts: { homeTeamId: string; awayTeamId: string; validScorerIds?: Set<string> },
): boolean {
  switch (type) {
    case "BTTS":
      return choice === "yes" || choice === "no";
    case "OVER_UNDER":
      return choice === "over" || choice === "under";
    case "FIRST_TEAM":
      return choice === opts.homeTeamId || choice === opts.awayTeamId;
    case "FIRST_SCORER":
      return opts.validScorerIds?.has(choice) ?? false;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Grading inputs (kept minimal and Prisma-free so grading stays pure/testable)
// ---------------------------------------------------------------------------

/** A real goal reduced to what grading needs. `side` is the crediting team. */
export interface BonusGoalEvent {
  id: string;
  /** "home" | "away": which side of the match the goal counts for. */
  side: string;
  scorerId: string | null;
  minute: number | null;
}

/** Everything needed to grade a bonus prediction for one match. */
export interface BonusMatchContext {
  homeTeamId: string;
  awayTeamId: string;
  /** The entered final score, or null if the match is not finished. */
  finalScore: { homeGoals: number; awayGoals: number } | null;
  /** All real goal events for the match (any order). */
  goalEvents: BonusGoalEvent[];
}

/** The fields of a BonusPrediction grading reads (type + the optional line). */
export interface GradablePrediction {
  type: string;
  line: number | null;
}

// ---------------------------------------------------------------------------
// Random type pool (pure)
// ---------------------------------------------------------------------------

/**
 * The pool of bonus types eligible for a match. First-goalscorer needs roster
 * data for BOTH teams; when either is missing it is dropped and the random pick
 * comes from the remaining three.
 */
export function bonusTypePool(rosterAvailableForBoth: boolean): BonusType[] {
  return rosterAvailableForBoth
    ? [...ALL_BONUS_TYPES]
    : ALL_BONUS_TYPES.filter((t) => t !== "FIRST_SCORER");
}

/** Pick one type uniformly at random from a non-empty pool. */
export function pickRandomBonusType(
  pool: BonusType[],
  rng: () => number = Math.random,
): BonusType {
  if (pool.length === 0) throw new Error("Bonus type pool is empty.");
  // Clamp guards against rng() returning exactly 1.
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

// ---------------------------------------------------------------------------
// Grading (pure)
// ---------------------------------------------------------------------------

/**
 * The goal scored first in the match, or null when there are none. Ordered by
 * minute ascending, with a deterministic tiebreaker on the lower GoalEvent id
 * when two goals share the same minute. A null minute sorts last.
 */
export function earliestGoal(goalEvents: BonusGoalEvent[]): BonusGoalEvent | null {
  let best: BonusGoalEvent | null = null;
  for (const g of goalEvents) {
    if (best === null) {
      best = g;
      continue;
    }
    const gm = g.minute ?? Number.POSITIVE_INFINITY;
    const bm = best.minute ?? Number.POSITIVE_INFINITY;
    if (gm < bm || (gm === bm && g.id < best.id)) best = g;
  }
  return best;
}

/**
 * The correct answer for a bonus prediction, in the same polymorphic string form
 * a user's pick takes ("yes"/"no", "over"/"under", a team id, or a player id), or
 * null when there is no correct answer yet (match not finished) or no possible
 * correct answer (for example a 0-0 result for the team/scorer types).
 */
export function correctBonusAnswer(
  prediction: GradablePrediction,
  ctx: BonusMatchContext,
): string | null {
  switch (prediction.type) {
    case "BTTS": {
      if (!ctx.finalScore) return null;
      return ctx.finalScore.homeGoals > 0 && ctx.finalScore.awayGoals > 0
        ? "yes"
        : "no";
    }
    case "OVER_UNDER": {
      if (!ctx.finalScore) return null;
      const line = prediction.line ?? DEFAULT_BONUS_OVER_UNDER_LINE;
      const total = ctx.finalScore.homeGoals + ctx.finalScore.awayGoals;
      return total > line ? "over" : "under";
    }
    case "FIRST_TEAM": {
      const first = earliestGoal(ctx.goalEvents);
      if (!first) return null; // 0-0 or not played yet: nobody is right.
      return first.side === "home" ? ctx.homeTeamId : ctx.awayTeamId;
    }
    case "FIRST_SCORER": {
      const first = earliestGoal(ctx.goalEvents);
      // No goals, or an own goal / unlisted scorer first: no valid scorer.
      if (!first || !first.scorerId) return null;
      return first.scorerId;
    }
    default:
      return null;
  }
}

/** Whether a user's pick is correct: there is an answer and it matches the pick. */
export function isBonusPickCorrect(
  prediction: GradablePrediction,
  ctx: BonusMatchContext,
  choice: string,
): boolean {
  const answer = correctBonusAnswer(prediction, ctx);
  return answer !== null && answer === choice;
}

// ---------------------------------------------------------------------------
// Lazy generation (impure: reads rosters + Settings, writes one row)
// ---------------------------------------------------------------------------

/**
 * Return the bonus prediction for a match, generating it on first use. Builds the
 * eligible type pool (dropping first-goalscorer when either team lacks roster
 * data), picks one at random, copies the over/under line from Settings when that
 * type is chosen, and saves it. Concurrent first-loads race on the unique match
 * number; the loser re-reads the winner's row.
 */
export async function ensureBonusPredictionForMatch(args: {
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
}): Promise<BonusPrediction> {
  const { matchNumber, homeTeamId, awayTeamId } = args;

  const existing = await prisma.bonusPrediction.findUnique({
    where: { matchNumber },
  });
  if (existing) return existing;

  const [homeRoster, awayRoster, settings] = await Promise.all([
    prisma.player.count({ where: { teamId: homeTeamId } }),
    prisma.player.count({ where: { teamId: awayTeamId } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);
  const rosterForBoth = homeRoster > 0 && awayRoster > 0;
  const type = pickRandomBonusType(bonusTypePool(rosterForBoth));
  const line =
    type === "OVER_UNDER"
      ? settings?.bonusOverUnderLine ?? DEFAULT_BONUS_OVER_UNDER_LINE
      : null;

  try {
    return await prisma.bonusPrediction.create({
      data: { matchNumber, type, line },
    });
  } catch {
    // Lost the race on the unique matchNumber: another request created it.
    const row = await prisma.bonusPrediction.findUnique({
      where: { matchNumber },
    });
    if (row) return row;
    throw new Error(`Failed to generate bonus prediction for match ${matchNumber}.`);
  }
}
