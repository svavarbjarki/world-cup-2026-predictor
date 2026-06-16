/**
 * Shared goal-event shapes for the admin result-entry flow and the front-page
 * display. Kept dependency-free so client components can import the types without
 * pulling in any server-only code.
 */

export type GoalSide = "home" | "away";

/** One goal row submitted from the admin form. */
export interface GoalEventInput {
  side: GoalSide;
  /** Null for an own goal or an unlisted scorer. */
  scorerId: string | null;
  assisterId: string | null;
  /** Match minute, or null when unknown. */
  minute: number | null;
}

/** A goal with resolved names, for display on cards and in the admin editor. */
export interface GoalEventView {
  side: GoalSide;
  scorerId: string | null;
  scorerName: string | null;
  /** Scorer photo URL for the front-page cards. Optional; the admin editor omits it. */
  scorerPhoto?: string | null;
  assisterId: string | null;
  assisterName: string | null;
  minute: number | null;
}

/** A selectable player in the goal dropdowns. */
export interface PlayerOption {
  id: string;
  name: string;
  number: number | null;
}

/**
 * Validate that the goal rows are consistent with the scoreline and have sane
 * minutes. Returns an error message, or null when valid. The home/away row counts
 * must match the entered score exactly (the form generates one row per goal).
 */
export function validateGoalEvents(
  goals: GoalEventInput[],
  homeGoals: number,
  awayGoals: number,
): string | null {
  const home = goals.filter((g) => g.side === "home").length;
  const away = goals.filter((g) => g.side === "away").length;
  if (home !== homeGoals || away !== awayGoals) {
    return "The goal entries must match the score.";
  }
  for (const g of goals) {
    if (
      g.minute != null &&
      (!Number.isInteger(g.minute) || g.minute < 0 || g.minute > 130)
    ) {
      return "Each minute must be a whole number from 0 to 130.";
    }
    if (g.assisterId != null && g.assisterId === g.scorerId) {
      return "A player cannot assist their own goal.";
    }
  }
  return null;
}
