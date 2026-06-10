// Static lookup for each team's top 3 players, keyed by team name. Kept as a
// static import (not a DB table) because it is small, fixed reference data that
// the UI only reads; seeding it would add a model + migration for no benefit.
// Returns [] for unknown teams and for "todo"/empty entries, so callers can
// render nothing without special-casing.

import { TEAM_TOP3, type TopPlayer } from "@/lib/data/team-top3";

export type { TopPlayer };

const byTeam = new Map<string, TopPlayer[]>(
  TEAM_TOP3.map((entry) => [entry.team, entry.players]),
);

/** The team's top 3 players, or [] if the team is unknown or not filled in. */
export function getTeamTop3(teamName: string): TopPlayer[] {
  return byTeam.get(teamName) ?? [];
}
