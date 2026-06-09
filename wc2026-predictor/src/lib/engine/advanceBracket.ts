import type {
  KnockoutMatch,
  KnockoutParticipant,
  ParticipantSource,
} from "./buildRoundOf32";

/**
 * Knockout progression for the FIFA World Cup 2026.
 *
 * SOURCE: "Regulations for the FIFA World Cup 26" (English edition, May 2026),
 *   Article 12.7 (round of 16), 12.8 (quarter-finals), 12.9 (semi-finals) and
 *   12.11 (final), pp. 24-25.
 *   PDF: https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
 *   Obtained: 2026-06-07.
 *
 * Each later-round match is fed by the winners of two specific earlier matches,
 * identified by official match number. The play-off for third place (M103,
 * losers of the semi-finals) is intentionally omitted: this module models only
 * the single-elimination path to the champion, which advances winners.
 *
 * slot continues the official knockout ordering index used for the round of 32
 * (1-16) and round of 16 (17-24, per Article 12.7). The regulations switch to
 * letter labels for the quarter-finals onward, so slot continues numerically in
 * official order (QF 25-28, SF 29-30, final 31).
 */

/** Names of the rounds produced after the round of 32. */
export type AdvancedRoundName =
  | "roundOf16"
  | "quarterFinals"
  | "semiFinals"
  | "final";

/** One produced match and the two earlier matches whose winners feed it. */
export interface NextMatchSpec {
  matchNumber: number;
  slot: number;
  fromMatchA: number;
  fromMatchB: number;
}

export interface RoundProgression {
  name: AdvancedRoundName;
  produces: readonly NextMatchSpec[];
}

/**
 * The official round-to-round progression. Exported so other surfaces (for
 * example the admin bracket-tree layout) can derive node placement from the same
 * source of truth rather than hard-coding an order. This is read-only data.
 */
export const KNOCKOUT_PROGRESSION: readonly RoundProgression[] = [
  {
    name: "roundOf16",
    produces: [
      { matchNumber: 89, slot: 17, fromMatchA: 74, fromMatchB: 77 },
      { matchNumber: 90, slot: 18, fromMatchA: 73, fromMatchB: 75 },
      { matchNumber: 91, slot: 19, fromMatchA: 76, fromMatchB: 78 },
      { matchNumber: 92, slot: 20, fromMatchA: 79, fromMatchB: 80 },
      { matchNumber: 93, slot: 21, fromMatchA: 83, fromMatchB: 84 },
      { matchNumber: 94, slot: 22, fromMatchA: 81, fromMatchB: 82 },
      { matchNumber: 95, slot: 23, fromMatchA: 86, fromMatchB: 88 },
      { matchNumber: 96, slot: 24, fromMatchA: 85, fromMatchB: 87 },
    ],
  },
  {
    name: "quarterFinals",
    produces: [
      { matchNumber: 97, slot: 25, fromMatchA: 89, fromMatchB: 90 },
      { matchNumber: 98, slot: 26, fromMatchA: 93, fromMatchB: 94 },
      { matchNumber: 99, slot: 27, fromMatchA: 91, fromMatchB: 92 },
      { matchNumber: 100, slot: 28, fromMatchA: 95, fromMatchB: 96 },
    ],
  },
  {
    name: "semiFinals",
    produces: [
      { matchNumber: 101, slot: 29, fromMatchA: 97, fromMatchB: 98 },
      { matchNumber: 102, slot: 30, fromMatchA: 99, fromMatchB: 100 },
    ],
  },
  {
    name: "final",
    produces: [{ matchNumber: 104, slot: 31, fromMatchA: 101, fromMatchB: 102 }],
  },
];

/**
 * A winner pick per knockout match, keyed by official match number. The value is
 * the teamId the user expects to advance from that match.
 */
export type WinnerPicks = Map<number, string>;

/** The complete knockout bracket once every round has been advanced. */
export interface FilledBracket {
  roundOf32: KnockoutMatch[];
  roundOf16: KnockoutMatch[];
  quarterFinals: KnockoutMatch[];
  semiFinals: KnockoutMatch[];
  /** Always a single match (M104). */
  final: KnockoutMatch[];
  /** teamId of the picked champion (winner of the final). */
  championTeamId: string;
}

/**
 * Advance one knockout round into the next, given that round's matches and the
 * user's winner picks for it.
 *
 * The progression stage is inferred from the input matches' official match
 * numbers, so the same matches always advance the same way. Throws if the
 * matches do not correspond to a round that advances (for example the final), or
 * if any pick is missing or is not one of that match's two teams.
 */
export function advanceRound(
  matches: readonly KnockoutMatch[],
  picks: WinnerPicks,
): KnockoutMatch[] {
  const stage = findStage(matches);
  validatePicks(matches, picks);

  return stage.produces.map((spec) => ({
    matchNumber: spec.matchNumber,
    slot: spec.slot,
    teamA: winnerParticipant(spec.fromMatchA, picks),
    teamB: winnerParticipant(spec.fromMatchB, picks),
  }));
}

/**
 * Play out the full knockout bracket from the round of 32 to the champion, given
 * winner picks for every knockout match. Pure and deterministic.
 *
 * `roundOf32` is the output of buildRoundOf32. `picks` must contain a winner for
 * every match from the round of 32 (M73-M88) through the final (M104).
 */
export function buildKnockoutBracket(
  roundOf32: readonly KnockoutMatch[],
  picks: WinnerPicks,
): FilledBracket {
  const roundOf16 = advanceRound(roundOf32, picks);
  const quarterFinals = advanceRound(roundOf16, picks);
  const semiFinals = advanceRound(quarterFinals, picks);
  const final = advanceRound(semiFinals, picks);

  // The champion is the winner pick of the final itself.
  validatePicks(final, picks);
  const championTeamId = picks.get(final[0].matchNumber)!;

  return {
    roundOf32: [...roundOf32],
    roundOf16,
    quarterFinals,
    semiFinals,
    final,
    championTeamId,
  };
}

// ---------------------------------------------------------------------------
// Partial bracket resolution (for an in-progress user filling picks)
// ---------------------------------------------------------------------------

/** Every knockout round, including the round of 32. */
export type KnockoutRoundName = "roundOf32" | AdvancedRoundName;

/** A participant whose team may not be known yet (feeder not decided). */
export interface PartialParticipant {
  source: ParticipantSource;
  /** Resolved teamId, or null when the feeding match has no valid pick yet. */
  teamId: string | null;
}

/** A knockout match in a partially-filled bracket. */
export interface PartialMatch {
  matchNumber: number;
  slot: number;
  round: KnockoutRoundName;
  teamA: PartialParticipant;
  teamB: PartialParticipant;
  /** The user's valid winner pick for this match, or null. */
  pick: string | null;
}

export interface PartialRound {
  name: KnockoutRoundName;
  matches: PartialMatch[];
}

export interface ResolvedBracket {
  /** Rounds in official order: round of 32 through the final. */
  rounds: PartialRound[];
  /**
   * Picks that survive validation, keyed by match number. A pick survives only
   * if its match is fully determined and the picked team is one of the two
   * teams in that match given upstream picks. This is the deterministic
   * downstream-invalidation rule: drop any pick that references a team that no
   * longer reaches that match.
   */
  effectivePicks: Map<number, string>;
  /** The picked champion (winner of the final), or null if not decided. */
  championTeamId: string | null;
  /** True when every knockout match has a valid pick. */
  complete: boolean;
}

/**
 * Resolve a user's bracket from their round of 32 plus whatever winner picks
 * they have made so far (which may be partial or, after an upstream change,
 * internally stale). Later-round teams fill in as feeders are decided, and any
 * pick that no longer belongs to its match is dropped from `effectivePicks`.
 *
 * Pure and deterministic: the same inputs always yield the same bracket and the
 * same surviving picks, so it doubles as the single source of truth for
 * downstream invalidation.
 */
export function resolvePartialBracket(
  roundOf32: readonly KnockoutMatch[],
  rawPicks: WinnerPicks,
): ResolvedBracket {
  const effectivePicks: WinnerPicks = new Map();
  // The decided winner of each match (its valid pick), or null if undecided.
  const winnerByMatch = new Map<number, string | null>();

  const r32Matches: PartialMatch[] = roundOf32.map((m) => {
    const raw = rawPicks.get(m.matchNumber);
    const valid =
      raw !== undefined && (raw === m.teamA.teamId || raw === m.teamB.teamId)
        ? raw
        : null;
    if (valid !== null) effectivePicks.set(m.matchNumber, valid);
    winnerByMatch.set(m.matchNumber, valid);
    return {
      matchNumber: m.matchNumber,
      slot: m.slot,
      round: "roundOf32",
      teamA: m.teamA,
      teamB: m.teamB,
      pick: valid,
    };
  });

  const rounds: PartialRound[] = [{ name: "roundOf32", matches: r32Matches }];

  for (const stage of KNOCKOUT_PROGRESSION) {
    const matches: PartialMatch[] = stage.produces.map((spec) => {
      const aWinner = winnerByMatch.get(spec.fromMatchA) ?? null;
      const bWinner = winnerByMatch.get(spec.fromMatchB) ?? null;
      const teamA: PartialParticipant = {
        source: { type: "matchWinner", matchNumber: spec.fromMatchA },
        teamId: aWinner,
      };
      const teamB: PartialParticipant = {
        source: { type: "matchWinner", matchNumber: spec.fromMatchB },
        teamId: bWinner,
      };
      const determined = aWinner !== null && bWinner !== null;
      const raw = rawPicks.get(spec.matchNumber);
      const valid =
        determined && raw !== undefined && (raw === aWinner || raw === bWinner)
          ? raw
          : null;
      if (valid !== null) effectivePicks.set(spec.matchNumber, valid);
      winnerByMatch.set(spec.matchNumber, valid);
      return {
        matchNumber: spec.matchNumber,
        slot: spec.slot,
        round: stage.name,
        teamA,
        teamB,
        pick: valid,
      };
    });
    rounds.push({ name: stage.name, matches });
  }

  const totalMatches = rounds.reduce((n, r) => n + r.matches.length, 0);
  const finalMatch = rounds[rounds.length - 1].matches[0];
  return {
    rounds,
    effectivePicks,
    championTeamId: finalMatch.pick,
    complete: effectivePicks.size === totalMatches,
  };
}

/** Find the progression stage whose feeder matches are exactly these matches. */
function findStage(matches: readonly KnockoutMatch[]): RoundProgression {
  const inputNumbers = new Set(matches.map((m) => m.matchNumber));
  for (const stage of KNOCKOUT_PROGRESSION) {
    const feeders = new Set(
      stage.produces.flatMap((spec) => [spec.fromMatchA, spec.fromMatchB]),
    );
    if (sameNumberSet(inputNumbers, feeders)) {
      return stage;
    }
  }
  const numbers = [...inputNumbers].sort((a, b) => a - b).join(", ");
  throw new Error(
    `No knockout round advances from matches [${numbers}]; ` +
      `they do not match a feeder set (the final does not advance further).`,
  );
}

/** Validate every match has a winner pick that is one of its two teams. */
function validatePicks(
  matches: readonly KnockoutMatch[],
  picks: WinnerPicks,
): void {
  for (const match of matches) {
    const pick = picks.get(match.matchNumber);
    if (pick === undefined) {
      throw new Error(`Missing winner pick for match ${match.matchNumber}.`);
    }
    if (pick !== match.teamA.teamId && pick !== match.teamB.teamId) {
      throw new Error(
        `Winner pick "${pick}" for match ${match.matchNumber} is not one of ` +
          `its teams (${match.teamA.teamId}, ${match.teamB.teamId}).`,
      );
    }
  }
}

/** Build the participant who advances as the winner of an earlier match. */
function winnerParticipant(
  matchNumber: number,
  picks: WinnerPicks,
): KnockoutParticipant {
  // Safe: validatePicks has already confirmed a pick exists for this match.
  const teamId = picks.get(matchNumber)!;
  return { source: { type: "matchWinner", matchNumber }, teamId };
}

function sameNumberSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
