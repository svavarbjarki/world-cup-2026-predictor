/**
 * Foundational types shared across the tournament engine.
 *
 * These are intentionally framework free (no Prisma, no React, no I/O) so the
 * engine can be exercised as pure data-in / data-out functions. Later engine
 * pieces (third-place ranking, scoring, bracket building) build on top of these.
 */

/** A group letter for the 12 World Cup 2026 groups, A through L. */
export type GroupLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

/** A national team competing in the tournament. */
export interface Team {
  /** Stable unique identifier (e.g. a database id or short code). */
  id: string;
  /** Display name, e.g. "Brazil". */
  name: string;
  /** Which group the team belongs to. */
  group: GroupLetter;
  /** Seeding within the group, where 1 is the top seed. */
  seed: number;
}

/**
 * A scoreline: goals for each side of a single match. Used on its own for
 * predictions and actual results, and extended by GroupMatch.
 */
export interface Scoreline {
  /** Goals scored by the home team. */
  homeGoals: number;
  /** Goals scored by the away team. */
  awayGoals: number;
}

/**
 * A single group-stage match with a predicted scoreline.
 *
 * Teams are referenced by id rather than embedded so matches stay light and a
 * single source of Team records can be looked up separately when needed.
 */
export interface GroupMatch extends Scoreline {
  /** Id of the home team. */
  homeTeamId: string;
  /** Id of the away team. */
  awayTeamId: string;
}

/**
 * One row of a computed group table for a single team.
 *
 * Identified by teamId because it is derived purely from matches, which carry
 * team ids only. Callers that need full Team details can join on teamId.
 */
export interface GroupStanding {
  /** Id of the team this row describes. */
  teamId: string;
  /** Matches played. */
  played: number;
  /** Matches won. */
  won: number;
  /** Matches drawn. */
  drawn: number;
  /** Matches lost. */
  lost: number;
  /** Total goals scored. */
  goalsFor: number;
  /** Total goals conceded. */
  goalsAgainst: number;
  /** goalsFor minus goalsAgainst. */
  goalDifference: number;
  /** Competition points: 3 per win, 1 per draw, 0 per loss. */
  points: number;
}
