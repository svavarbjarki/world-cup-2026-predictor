import type { GroupLetter, GroupStanding } from "./types";
import { compareByStandardCriteria } from "./ranking";

/**
 * How many of the 12 third-placed teams advance to the round of 32.
 * (Top 2 of each group give 24, plus the best 8 thirds for 32 total.)
 */
export const THIRD_PLACE_QUALIFIER_COUNT = 8;

/**
 * Input shape: the 12 computed group tables keyed by their group letter.
 *
 * A Map keyed by GroupLetter is the cleanest choice here because each table is
 * tied directly to its group, so every extracted third-place team can carry its
 * group of origin without any separate bookkeeping. Each value is the ranked
 * output of computeGroupTable (1st to 4th).
 */
export type GroupTablesByLetter = Map<GroupLetter, GroupStanding[]>;

/**
 * One third-placed team within the cross-group ranking.
 */
export interface ThirdPlaceEntry {
  /** The group this team finished third in. Needed later for bracket slotting. */
  group: GroupLetter;
  /** The team's group-stage standing, carried through unchanged. */
  standing: GroupStanding;
  /** Position in the cross-group ranking, 1 (best) through 12 (worst). */
  rank: number;
  /** True for the best 8, who advance to the knockout stage. */
  qualified: boolean;
}

/**
 * Rank the 12 third-placed teams against each other and mark the best 8 that
 * qualify for the round of 32.
 *
 * Ranking uses the same criteria as group tables (points, then goal difference,
 * then goals scored) via the shared comparator. Head-to-head does NOT apply
 * across groups, so it is not used here.
 *
 * The returned array is the full field of 12, ordered best to worst, each entry
 * tagged with its rank (1 to 12), its group of origin, and a `qualified` flag.
 * A caller can read the ranking directly or split on `qualified` to get the 8
 * who advance and the 4 who are out.
 */
export function rankThirdPlaceTeams(
  groupTables: GroupTablesByLetter,
): ThirdPlaceEntry[] {
  // Pull the third-placed team (index 2 of each ranked table) out of each group.
  const thirdPlaced: { group: GroupLetter; standing: GroupStanding }[] = [];
  for (const [group, standings] of groupTables) {
    const third = standings[2];
    if (!third) {
      throw new Error(
        `Group ${group} has no third-placed team; expected a ranked table of 4.`,
      );
    }
    thirdPlaced.push({ group, standing: third });
  }

  thirdPlaced.sort((a, b) => {
    const byStandardCriteria = compareByStandardCriteria(a.standing, b.standing);
    if (byStandardCriteria !== 0) return byStandardCriteria;

    // Deterministic fallback. A GroupStanding carries no seed, so when two teams
    // are still level on points, goal difference and goals scored we order them
    // alphabetically by team id. This is arbitrary but fixed, so the same input
    // always produces the same 8 qualifiers and the result is never random.
    return a.standing.teamId.localeCompare(b.standing.teamId);
  });

  return thirdPlaced.map((entry, index) => ({
    group: entry.group,
    standing: entry.standing,
    rank: index + 1,
    qualified: index < THIRD_PLACE_QUALIFIER_COUNT,
  }));
}
