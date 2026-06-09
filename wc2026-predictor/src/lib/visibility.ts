// Per-phase visibility rules. Pure and tiny so the core privacy gate is easy to
// test. The server loaders that fetch another user's predictions call
// canSeeOthersPredictions FIRST and refuse when it returns false, so visibility
// is enforced on the server, not just hidden in the UI.

/** A submission status string is SUBMITTED. */
export function hasSubmitted(status: string): boolean {
  return status === "SUBMITTED";
}

/**
 * Whether a viewer may see another player's predictions for a phase (group or
 * knockout). Both must have submitted that phase: the viewer must have earned
 * visibility by submitting their own, and the target's predictions are only
 * revealed once finalized (submitted). The two phases are gated independently by
 * passing each phase's submitted flags.
 */
export function canSeeOthersPredictions(
  viewerSubmitted: boolean,
  targetSubmitted: boolean,
): boolean {
  return viewerSubmitted && targetSubmitted;
}
