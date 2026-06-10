// Pure "what the group predicted" aggregation, with the per-phase visibility gate
// baked in so it is enforced and testable without a database. A viewer who has
// not submitted that phase gets { allowed: false } no matter what predictions are
// passed in, mirroring the individual-prediction privacy rule. Group scorelines
// are bucketed with the engine's matchOutcome (the same logic scoring uses).

import { matchOutcome } from "./engine/outcome";

export type OutcomeKey = "home" | "draw" | "away";

export interface AggregateSegment {
  key: OutcomeKey;
  count: number;
  /** Rounded 0-100 share of the total. */
  pct: number;
}

export type MatchAggregate =
  | { allowed: false }
  | { allowed: true; total: number; segments: AggregateSegment[] };

function buildSegments(
  counts: Record<OutcomeKey, number>,
  keys: OutcomeKey[],
): { total: number; segments: AggregateSegment[] } {
  const total = keys.reduce((n, k) => n + counts[k], 0);
  const segments = keys.map((k) => ({
    key: k,
    count: counts[k],
    pct: total > 0 ? Math.round((counts[k] / total) * 100) : 0,
  }));
  return { total, segments };
}

/**
 * Group-match aggregate: bucket each submitted player's predicted scoreline into
 * home win / draw / away win. The caller passes only submitted players' scorelines
 * and whether the viewer has earned visibility for the group phase.
 */
export function groupAggregate(
  viewerSubmitted: boolean,
  scorelines: { homeGoals: number; awayGoals: number }[],
): MatchAggregate {
  if (!viewerSubmitted) return { allowed: false };
  const counts: Record<OutcomeKey, number> = { home: 0, draw: 0, away: 0 };
  for (const s of scorelines) counts[matchOutcome(s)] += 1;
  const { total, segments } = buildSegments(counts, ["home", "draw", "away"]);
  return { allowed: true, total, segments };
}

/**
 * Knockout-match aggregate: each submitted player's pick is already a winner, so
 * tally home vs away by comparing to the real match's home team. Only valid for
 * the shared, admin-entered matches (Round of 32) where the matchup is the same
 * for everyone.
 */
export function knockoutAggregate(
  viewerSubmitted: boolean,
  winnerTeamIds: string[],
  homeTeamId: string,
): MatchAggregate {
  if (!viewerSubmitted) return { allowed: false };
  const counts: Record<OutcomeKey, number> = { home: 0, draw: 0, away: 0 };
  for (const id of winnerTeamIds) {
    if (id === homeTeamId) counts.home += 1;
    else counts.away += 1;
  }
  const { total, segments } = buildSegments(counts, ["home", "away"]);
  return { allowed: true, total, segments };
}
