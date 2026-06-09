// Pure gating rules for the group-stage flow. No Prisma, no I/O, so they are
// trivially testable. getGroupStageState and the server actions both use these,
// so the rules enforced on the server and the rules under test are the same.

/** Largest plausible score we accept for a single team in one match. */
export const MAX_GOALS = 99;

/** A valid predicted goal count: a whole number from 0 to MAX_GOALS. */
export function isValidGoal(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= MAX_GOALS;
}

/**
 * Sequential unlock rule. Given each group's completeness in order (A..L),
 * return whether each group is reachable. A group is unlocked only when every
 * earlier group is complete; the first group is always unlocked. This is what
 * stops a user skipping ahead to a group whose predecessors are unfinished.
 */
export function computeUnlockedFlags(complete: boolean[]): boolean[] {
  const unlocked: boolean[] = [];
  let allEarlierComplete = true;
  for (const groupComplete of complete) {
    unlocked.push(allEarlierComplete);
    allEarlierComplete = allEarlierComplete && groupComplete;
  }
  return unlocked;
}

/** The groups-phase lock is allowed only when all groups are done and not yet locked. */
export function canLockGroups(
  allComplete: boolean,
  alreadyLocked: boolean,
): boolean {
  return allComplete && !alreadyLocked;
}
