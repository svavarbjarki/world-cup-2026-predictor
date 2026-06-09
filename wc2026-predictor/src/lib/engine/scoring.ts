import type { Scoreline } from "./types";
import { matchOutcome } from "./outcome";

/**
 * Point values for scoring a predicted group-stage scoreline. Defaults follow
 * the house rules but are parameters so an organizer can change them later.
 */
export interface GroupScoringConfig {
  /** Exact scoreline correct (both goal values match). */
  exact: number;
  /** Correct result (same outcome bucket) but wrong score. */
  result: number;
  /** Wrong result. */
  wrong: number;
}

export const DEFAULT_GROUP_SCORING: GroupScoringConfig = {
  exact: 3,
  result: 1,
  wrong: 0,
};

/** Point values for scoring a knockout advancement pick. */
export interface KnockoutScoringConfig {
  /** Correct team advances. */
  correct: number;
  /** Wrong team. */
  wrong: number;
}

export const DEFAULT_KNOCKOUT_SCORING: KnockoutScoringConfig = {
  correct: 3,
  wrong: 0,
};

/**
 * Score a predicted group-stage scoreline against the actual result.
 *
 * Exact scoreline -> `exact`; correct result but wrong score -> `result`;
 * wrong result -> `wrong`. "Correct result" means both the prediction and the
 * actual fall in the same outcome bucket (home win / away win / draw), so a
 * predicted 1-1 against an actual 2-2 scores `result`.
 */
export function scoreGroupMatch(
  prediction: Scoreline,
  actual: Scoreline,
  config: GroupScoringConfig = DEFAULT_GROUP_SCORING,
): number {
  if (
    prediction.homeGoals === actual.homeGoals &&
    prediction.awayGoals === actual.awayGoals
  ) {
    return config.exact;
  }
  if (matchOutcome(prediction) === matchOutcome(actual)) {
    return config.result;
  }
  return config.wrong;
}

/**
 * Score a knockout advancement pick: full marks if the predicted team is the one
 * that actually advanced, nothing otherwise.
 */
export function scoreKnockoutMatch(
  predictedWinnerTeamId: string,
  actualWinnerTeamId: string,
  config: KnockoutScoringConfig = DEFAULT_KNOCKOUT_SCORING,
): number {
  return predictedWinnerTeamId === actualWinnerTeamId
    ? config.correct
    : config.wrong;
}
