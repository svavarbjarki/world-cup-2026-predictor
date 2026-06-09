import type { GroupMatch, GroupStanding } from "./types";
import { compareByStandardCriteria } from "./ranking";
import { matchOutcome } from "./outcome";

/** Points awarded for each result, per standard football rules. */
const POINTS_FOR_WIN = 3;
const POINTS_FOR_DRAW = 1;
const POINTS_FOR_LOSS = 0;

/**
 * Compute a group table from the predicted scorelines of its matches.
 *
 * A group is 4 teams playing each other once (6 matches total). This function
 * tallies played / won / drawn / lost / goalsFor / goalsAgainst / goalDifference
 * / points for every team that appears in the matches, then returns the rows
 * ranked from 1st to 4th.
 *
 * Ranking criteria, applied in order:
 *   1. points (descending)
 *   2. goal difference (descending)
 *   3. goals scored / goalsFor (descending)
 *
 * Head-to-head results and the remaining FIFA tie-breaks (fair play, drawing of
 * lots, etc.) are deliberately NOT implemented here. They will be added in a
 * later task at the marked point below.
 */
export function computeGroupTable(matches: GroupMatch[]): GroupStanding[] {
  const standingsByTeamId = new Map<string, GroupStanding>();

  // Lazily create a blank row the first time we see a team id.
  const rowFor = (teamId: string): GroupStanding => {
    let row = standingsByTeamId.get(teamId);
    if (!row) {
      row = {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
      standingsByTeamId.set(teamId, row);
    }
    return row;
  };

  for (const match of matches) {
    const home = rowFor(match.homeTeamId);
    const away = rowFor(match.awayTeamId);

    home.played += 1;
    away.played += 1;

    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;

    const outcome = matchOutcome(match);
    if (outcome === "home") {
      home.won += 1;
      away.lost += 1;
      home.points += POINTS_FOR_WIN;
      away.points += POINTS_FOR_LOSS;
    } else if (outcome === "away") {
      away.won += 1;
      home.lost += 1;
      away.points += POINTS_FOR_WIN;
      home.points += POINTS_FOR_LOSS;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += POINTS_FOR_DRAW;
      away.points += POINTS_FOR_DRAW;
    }
  }

  // Derive goal difference once all goals are tallied.
  for (const row of standingsByTeamId.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  const standings = Array.from(standingsByTeamId.values());

  standings.sort((a, b) => {
    const byStandardCriteria = compareByStandardCriteria(a, b);
    if (byStandardCriteria !== 0) return byStandardCriteria;

    // TODO(later task): teams are still tied here. Apply head-to-head results
    // (points, then goal difference, then goals scored among the tied teams),
    // then the remaining FIFA tie-breaks. For now leave order unchanged.
    return 0;
  });

  return standings;
}
