import type { GroupStanding } from "./types";

/**
 * The universal football ranking criteria shared by group tables and the
 * cross-group third-place ranking. Anything carrying these three fields can be
 * compared, so both GroupStanding rows and any derived entry work directly.
 */
export type RankableStats = Pick<
  GroupStanding,
  "points" | "goalDifference" | "goalsFor"
>;

/**
 * Compare two entries by the standard criteria, in order:
 *   1. points (descending)
 *   2. goal difference (descending)
 *   3. goals scored / goalsFor (descending)
 *
 * Returns a negative number if `a` ranks ahead of `b`, positive if `b` ranks
 * ahead, and 0 if they are level on all three. A remaining 0 is deliberately
 * left for the caller to resolve, because the next tie-break differs by context:
 * head-to-head within a single group, or a deterministic fallback across groups.
 */
export function compareByStandardCriteria(
  a: RankableStats,
  b: RankableStats,
): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) {
    return b.goalDifference - a.goalDifference;
  }
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return 0;
}
