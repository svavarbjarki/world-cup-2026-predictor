// Pure award rules: the five categories and the per-category eligibility checks.
// No Prisma, no I/O, so they are testable and shared by the server loaders, the
// save actions, and the UI filtering. Eligibility is always computed here and
// re-checked on the server; the client filtering is only a convenience.

export type AwardCategory =
  | "WINNER"
  | "GOLDEN_BALL"
  | "GOLDEN_BOOT"
  | "GOLDEN_GLOVE"
  | "YOUNG_PLAYER";

export const AWARD_CATEGORIES: AwardCategory[] = [
  "WINNER",
  "GOLDEN_BALL",
  "GOLDEN_BOOT",
  "GOLDEN_GLOVE",
  "YOUNG_PLAYER",
];

export const AWARD_LABELS: Record<AwardCategory, string> = {
  WINNER: "The Winner",
  GOLDEN_BALL: "Golden Ball",
  GOLDEN_BOOT: "Golden Boot",
  GOLDEN_GLOVE: "Golden Glove",
  YOUNG_PLAYER: "Young Player",
};

/** WINNER picks a team; the other four pick a player. */
export function isPlayerCategory(category: AwardCategory): boolean {
  return category !== "WINNER";
}

// View models shared with the client (no server imports here).

export interface AwardTeamOption {
  id: string;
  name: string;
  isoCode: string;
}

export interface AwardPlayerOption {
  id: string;
  name: string;
  teamName: string;
  isoCode: string;
  position: string;
  age: number;
  birthYear: number | null;
}

/** A user's five award picks as ids (null = not picked). */
export interface AwardPicksIds {
  winnerTeamId: string | null;
  goldenBallPlayerId: string | null;
  goldenBootPlayerId: string | null;
  goldenGlovePlayerId: string | null;
  youngPlayerId: string | null;
}

export interface AwardState {
  picks: AwardPicksIds;
  /** The user has submitted their awards (locked). */
  submitted: boolean;
  /** The global first-kickoff deadline has passed (locked for everyone). */
  lockedByDeadline: boolean;
  /** All five categories picked. */
  complete: boolean;
}

/** The column on AwardPrediction / AwardResult that a category writes to. */
export const AWARD_FIELD: Record<AwardCategory, keyof AwardPicksIds> = {
  WINNER: "winnerTeamId",
  GOLDEN_BALL: "goldenBallPlayerId",
  GOLDEN_BOOT: "goldenBootPlayerId",
  GOLDEN_GLOVE: "goldenGlovePlayerId",
  YOUNG_PLAYER: "youngPlayerId",
};

/** Result of a user award save/submit action. */
export type AwardSaveResult =
  | { ok: true; state: AwardState }
  | { ok: false; error: string };

/** Result of an admin award-result save action. */
export type AdminAwardSaveResult =
  | { ok: true; picks: AwardPicksIds }
  | { ok: false; error: string };

/** True when all five categories have a pick. */
export function isAwardComplete(picks: AwardPicksIds): boolean {
  return (
    picks.winnerTeamId != null &&
    picks.goldenBallPlayerId != null &&
    picks.goldenBootPlayerId != null &&
    picks.goldenGlovePlayerId != null &&
    picks.youngPlayerId != null
  );
}

/** Young Player cutoff: born on or after 1 Jan 2005. */
export const YOUNG_PLAYER_CUTOFF_YEAR = 2005;
/** Practical fallback when a precise birth year is not known. */
export const YOUNG_PLAYER_MAX_AGE = 21;

interface PlayerLike {
  position: string;
  age: number;
  birthYear?: number | null;
}

/** Golden Glove eligibility: goalkeepers only. */
export function isGoalkeeper(player: { position: string }): boolean {
  return player.position === "GK";
}

/**
 * Young Player eligibility: born on or after 1 Jan 2005. Uses birthYear when
 * known; otherwise falls back to the practical age <= 21 filter.
 */
export function isYoungEligible(player: {
  age: number;
  birthYear?: number | null;
}): boolean {
  if (player.birthYear != null) {
    return player.birthYear >= YOUNG_PLAYER_CUTOFF_YEAR;
  }
  return player.age <= YOUNG_PLAYER_MAX_AGE;
}

/**
 * Whether a player may be picked for a given player-award category. Golden Ball
 * and Golden Boot accept any player; Golden Glove requires a goalkeeper; Young
 * Player requires an eligible age/birth year. WINNER is a team award, so no
 * player is eligible for it.
 */
export function isPlayerEligibleForCategory(
  category: AwardCategory,
  player: PlayerLike,
): boolean {
  switch (category) {
    case "GOLDEN_BALL":
    case "GOLDEN_BOOT":
      return true;
    case "GOLDEN_GLOVE":
      return isGoalkeeper(player);
    case "YOUNG_PLAYER":
      return isYoungEligible(player);
    case "WINNER":
      return false;
  }
}
