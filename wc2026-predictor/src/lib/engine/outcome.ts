import type { Scoreline } from "./types";

/** The result of a match from the home team's perspective. */
export type MatchOutcome = "home" | "away" | "draw";

/**
 * Classify a scoreline into its outcome bucket: a home win, an away win, or a
 * draw. Shared by the group table tally and by group-match scoring so both agree
 * on what counts as the same result.
 */
export function matchOutcome(score: Scoreline): MatchOutcome {
  if (score.homeGoals > score.awayGoals) return "home";
  if (score.homeGoals < score.awayGoals) return "away";
  return "draw";
}
