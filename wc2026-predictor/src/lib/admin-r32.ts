// Pure helpers and types for the organizer's real Round-of-32 entry. No Prisma,
// no I/O, so the gate rules are trivially testable. The admin server actions use
// these same functions, so what is enforced and what is tested are identical.

/** One R32 slot's current team assignment. */
export interface R32SlotAssignment {
  matchNumber: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

/**
 * The 16 official Round-of-32 slots: match numbers 73-88, slots 1-16, matching
 * the engine's R32 ordering (slot i is match number 72 + i).
 */
export const R32_SLOTS: { slot: number; matchNumber: number }[] = Array.from(
  { length: 16 },
  (_, i) => ({ slot: i + 1, matchNumber: 73 + i }),
);

/** Result returned by the admin R32 save / open actions. */
export type AdminSaveResult = { ok: true } | { ok: false; error: string };

/**
 * Find a team id used in more than one place across all R32 slots, including a
 * team set against itself in a single match. Returns the first offending team id,
 * or null if every assigned team is unique. (Unassigned slots are ignored.)
 */
export function findDuplicateTeamId(
  slots: R32SlotAssignment[],
): string | null {
  const seen = new Set<string>();
  for (const slot of slots) {
    for (const teamId of [slot.homeTeamId, slot.awayTeamId]) {
      if (teamId == null) continue;
      if (seen.has(teamId)) return teamId;
      seen.add(teamId);
    }
  }
  return null;
}

/** Every one of the 16 slots has both teams assigned. */
export function isR32Complete(slots: R32SlotAssignment[]): boolean {
  return (
    slots.length === 16 &&
    slots.every((s) => s.homeTeamId != null && s.awayTeamId != null)
  );
}

/**
 * Why the knockout phase cannot be opened yet, or null when it can. Requires all
 * 16 matches fully filled and no team appearing twice.
 */
export function r32OpenError(slots: R32SlotAssignment[]): string | null {
  if (!isR32Complete(slots)) {
    return "All 16 Round of 32 matches need both teams before opening.";
  }
  const duplicate = findDuplicateTeamId(slots);
  if (duplicate) {
    return `A team appears in more than one match (${duplicate}).`;
  }
  return null;
}
