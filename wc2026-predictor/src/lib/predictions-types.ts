// View-model types shared between the server (src/lib/predictions.ts and the
// prediction server actions) and the client flow component. Kept dependency-free
// (only engine TYPE imports, which are erased) so it is safe to import from a
// Client Component without pulling in Prisma or other server-only code.

import type { GroupLetter, GroupStanding } from "@/lib/engine/types";
import type { ThirdPlaceEntry } from "@/lib/engine/rankThirdPlaceTeams";
import type { ParticipantSource } from "@/lib/engine/buildRoundOf32";
import type { KnockoutRoundName } from "@/lib/engine/advanceBracket";

/** One group fixture as shown to the user, with their current prediction. */
export interface MatchView {
  fixtureId: string;
  matchNumber: number;
  matchday: number;
  home: { id: string; name: string };
  away: { id: string; name: string };
  /** The user's predicted scoreline, or null if not predicted yet. */
  prediction: { homeGoals: number; awayGoals: number } | null;
}

/** A single group's state for the current user. */
export interface GroupView {
  letter: GroupLetter;
  /** The 6 matches, ordered by match number. */
  matches: MatchView[];
  /** How many of the 6 have a prediction (0-6). */
  predictedCount: number;
  /** All 6 predicted. */
  complete: boolean;
  /** Reachable under the sequential rule (all earlier groups complete). */
  unlocked: boolean;
  /** Engine-computed table, present only when the group is complete. */
  standings: GroupStanding[] | null;
}

/** The whole group-stage picture for the current user. */
export interface GroupStageState {
  /** Groups A through L, in order. */
  groups: GroupView[];
  /** Every group complete. */
  allComplete: boolean;
  /** The user has performed the groups-phase lock. */
  groupsLocked: boolean;
  /** Cross-group third-place ranking, present only when all groups complete. */
  thirdPlaceRanking: ThirdPlaceEntry[] | null;
  /** teamId to display name, for rendering standings and the ranking. */
  teamNames: Record<string, string>;
}

/** Result of a prediction/lock server action. */
export type SaveResult =
  | { ok: true; state: GroupStageState }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Knockout view models
// ---------------------------------------------------------------------------

/** One side of a knockout match as shown to the user. */
export interface KnockoutParticipantView {
  /** Engine provenance (group winner / runner-up / third / earlier match). */
  source: ParticipantSource;
  /** Resolved teamId, or null when the feeding result is not decided yet. */
  teamId: string | null;
  /** Resolved team name, or null when undetermined. */
  teamName: string | null;
  /** Human-readable origin, e.g. "Winner Group A" or "3rd place, Group F". */
  label: string;
}

/** A knockout match in the user's bracket. */
export interface KnockoutMatchView {
  matchNumber: number;
  slot: number;
  round: KnockoutRoundName;
  roundLabel: string;
  teamA: KnockoutParticipantView;
  teamB: KnockoutParticipantView;
  /** The user's valid winner pick (teamId), or null. */
  pick: string | null;
  /** Both teams known, so a pick can be made. */
  determined: boolean;
}

/** One knockout round. */
export interface KnockoutRoundView {
  name: KnockoutRoundName;
  label: string;
  matches: KnockoutMatchView[];
}

/** The current user's full knockout bracket state. */
export interface KnockoutBracketState {
  rounds: KnockoutRoundView[];
  championTeamId: string | null;
  championName: string | null;
  /** Every knockout match has a valid pick. */
  complete: boolean;
  /** The user has made their knockout final submission (picks locked). */
  submitted: boolean;
  /** Editing is locked because the knockout deadline has passed. */
  lockedByDeadline: boolean;
  teamNames: Record<string, string>;
}

/** Result of a knockout pick / final-submit server action. */
export type KnockoutSaveResult =
  | { ok: true; state: KnockoutBracketState }
  | { ok: false; error: string };
