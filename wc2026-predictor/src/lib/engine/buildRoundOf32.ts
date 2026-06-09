import type { GroupLetter } from "./types";
import type { ThirdPlaceEntry } from "./rankThirdPlaceTeams";
import { thirdPlaceOpponentsByWinner } from "./annexC";

/**
 * Where a knockout participant came from. Group-stage sources (winner, runnerUp,
 * third) seed the round of 32; "matchWinner" feeds every later round, where a
 * team arrives as the winner of an earlier knockout match. Carried through so a
 * later round and any UI can show provenance without re-deriving it.
 */
export type ParticipantSource =
  | { type: "winner"; group: GroupLetter }
  | { type: "runnerUp"; group: GroupLetter }
  | { type: "third"; group: GroupLetter }
  | { type: "matchWinner"; matchNumber: number }
  // A team entered directly into the real Round of 32 by the organizer. Carries
  // the team's group letter only as a neutral origin hint for display.
  | { type: "realR32"; group: GroupLetter };

/** One side of a knockout match: who they are and where they came from. */
export interface KnockoutParticipant {
  source: ParticipantSource;
  /** Team identifier, consistent with GroupStanding.teamId elsewhere. */
  teamId: string;
}

/**
 * A single knockout match in official bracket order. The same shape is used for
 * every round (round of 32 through the final); only the matchNumber/slot ranges
 * differ. advanceBracket consumes and produces this shape.
 */
export interface KnockoutMatch {
  /** Official FIFA match number (73 to 88 for the round of 32). */
  matchNumber: number;
  /** Official knockout ordering index (1 to 16 for the round of 32). */
  slot: number;
  teamA: KnockoutParticipant;
  teamB: KnockoutParticipant;
}

/** Backwards-compatible aliases for the round of 32. */
export type RoundOf32Participant = KnockoutParticipant;
export type RoundOf32Match = KnockoutMatch;

/** All twelve group letters, used for input validation. */
const ALL_GROUPS: readonly GroupLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
];

/**
 * How each side of a match is sourced before teams are filled in.
 *
 * "winner" / "runnerUp" reference a group directly. "thirdForWinner" means the
 * third-placed team that Annex C assigns to that winner's slot; the actual group
 * is resolved per the qualifying combination.
 */
type SlotSpec =
  | { kind: "winner"; group: GroupLetter }
  | { kind: "runnerUp"; group: GroupLetter }
  | { kind: "thirdForWinner"; winner: GroupLetter };

interface MatchSpec {
  matchNumber: number;
  slot: number;
  a: SlotSpec;
  b: SlotSpec;
}

/**
 * The fixed round-of-32 schedule, transcribed from Article 12.6 of the FIFA
 * World Cup 2026 Regulations. Order is the official bracket order (slots 1-16,
 * matches 73-88). Winners of C, F, H and J face runners-up; the other eight
 * winners face a third-placed team chosen via Annex C.
 */
const ROUND_OF_32_SCHEDULE: readonly MatchSpec[] = [
  { slot: 1, matchNumber: 73, a: { kind: "runnerUp", group: "A" }, b: { kind: "runnerUp", group: "B" } },
  { slot: 2, matchNumber: 74, a: { kind: "winner", group: "E" }, b: { kind: "thirdForWinner", winner: "E" } },
  { slot: 3, matchNumber: 75, a: { kind: "winner", group: "F" }, b: { kind: "runnerUp", group: "C" } },
  { slot: 4, matchNumber: 76, a: { kind: "winner", group: "C" }, b: { kind: "runnerUp", group: "F" } },
  { slot: 5, matchNumber: 77, a: { kind: "winner", group: "I" }, b: { kind: "thirdForWinner", winner: "I" } },
  { slot: 6, matchNumber: 78, a: { kind: "runnerUp", group: "E" }, b: { kind: "runnerUp", group: "I" } },
  { slot: 7, matchNumber: 79, a: { kind: "winner", group: "A" }, b: { kind: "thirdForWinner", winner: "A" } },
  { slot: 8, matchNumber: 80, a: { kind: "winner", group: "L" }, b: { kind: "thirdForWinner", winner: "L" } },
  { slot: 9, matchNumber: 81, a: { kind: "winner", group: "D" }, b: { kind: "thirdForWinner", winner: "D" } },
  { slot: 10, matchNumber: 82, a: { kind: "winner", group: "G" }, b: { kind: "thirdForWinner", winner: "G" } },
  { slot: 11, matchNumber: 83, a: { kind: "runnerUp", group: "K" }, b: { kind: "runnerUp", group: "L" } },
  { slot: 12, matchNumber: 84, a: { kind: "winner", group: "H" }, b: { kind: "runnerUp", group: "J" } },
  { slot: 13, matchNumber: 85, a: { kind: "winner", group: "B" }, b: { kind: "thirdForWinner", winner: "B" } },
  { slot: 14, matchNumber: 86, a: { kind: "winner", group: "J" }, b: { kind: "runnerUp", group: "H" } },
  { slot: 15, matchNumber: 87, a: { kind: "winner", group: "K" }, b: { kind: "thirdForWinner", winner: "K" } },
  { slot: 16, matchNumber: 88, a: { kind: "runnerUp", group: "D" }, b: { kind: "runnerUp", group: "G" } },
];

/** Number of third-placed teams that qualify for the round of 32. */
const REQUIRED_THIRD_PLACE_COUNT = 8;

/**
 * Build the 16 round-of-32 matches in official bracket order.
 *
 * Inputs:
 *   - `winners`: the 12 group winners, keyed by group letter (value is teamId).
 *   - `runnersUp`: the 12 runners-up, keyed by group letter (value is teamId).
 *   - `qualifyingThirds`: the qualifying third-placed teams from
 *     rankThirdPlaceTeams. Either the full ranked array (entries with
 *     `qualified === true` are used) or just the eight qualified entries; either
 *     way exactly eight must qualify.
 *
 * Winner-vs-third pairings come from the official Annex C table; all runner-up
 * pairings are fixed by Article 12.6. The result preserves official match
 * ordering so the round of 16 can be built on top of it.
 */
export function buildRoundOf32(
  winners: Map<GroupLetter, string>,
  runnersUp: Map<GroupLetter, string>,
  qualifyingThirds: readonly ThirdPlaceEntry[],
): RoundOf32Match[] {
  requireAllGroups(winners, "winners");
  requireAllGroups(runnersUp, "runners-up");

  const thirds = qualifyingThirds.filter((entry) => entry.qualified);
  const thirdGroups = thirds.map((entry) => entry.group);
  if (thirds.length !== REQUIRED_THIRD_PLACE_COUNT) {
    throw new Error(
      `buildRoundOf32 needs exactly ${REQUIRED_THIRD_PLACE_COUNT} qualifying ` +
        `third-place teams, received ${thirds.length}.`,
    );
  }

  // teamId for each group whose third-placed team qualified.
  const thirdTeamByGroup = new Map<GroupLetter, string>(
    thirds.map((entry) => [entry.group, entry.standing.teamId]),
  );

  // Annex C: which third-place group faces each eligible winner.
  const thirdGroupByWinner = thirdPlaceOpponentsByWinner(thirdGroups);

  const resolve = (spec: SlotSpec): RoundOf32Participant => {
    switch (spec.kind) {
      case "winner": {
        const teamId = winners.get(spec.group);
        if (teamId === undefined) {
          throw new Error(`Missing winner for group ${spec.group}.`);
        }
        return { source: { type: "winner", group: spec.group }, teamId };
      }
      case "runnerUp": {
        const teamId = runnersUp.get(spec.group);
        if (teamId === undefined) {
          throw new Error(`Missing runner-up for group ${spec.group}.`);
        }
        return { source: { type: "runnerUp", group: spec.group }, teamId };
      }
      case "thirdForWinner": {
        const thirdGroup = thirdGroupByWinner.get(spec.winner);
        if (thirdGroup === undefined) {
          throw new Error(
            `Annex C gave no third-place opponent for winner ${spec.winner}.`,
          );
        }
        const teamId = thirdTeamByGroup.get(thirdGroup);
        if (teamId === undefined) {
          throw new Error(
            `Qualifying third-place team for group ${thirdGroup} is missing.`,
          );
        }
        return { source: { type: "third", group: thirdGroup }, teamId };
      }
    }
  };

  return ROUND_OF_32_SCHEDULE.map((spec) => ({
    matchNumber: spec.matchNumber,
    slot: spec.slot,
    teamA: resolve(spec.a),
    teamB: resolve(spec.b),
  }));
}

/** Throw a clear error unless `teams` contains an entry for all twelve groups. */
function requireAllGroups(
  teams: Map<GroupLetter, string>,
  label: string,
): void {
  const missing = ALL_GROUPS.filter((group) => !teams.has(group));
  if (missing.length > 0) {
    throw new Error(
      `Missing ${label} for group(s): ${missing.join(", ")}.`,
    );
  }
}
