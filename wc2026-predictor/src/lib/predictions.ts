// Server-side group-stage logic: loads the current user's fixtures and
// predictions, converts them into engine inputs, and computes progress, group
// tables, and the third-place ranking entirely via the engine. The UI and the
// server actions both go through here, so table/ranking math is never duplicated.

import { prisma } from "@/lib/prisma";
import { computeGroupTable } from "@/lib/engine/computeGroupTable";
import {
  rankThirdPlaceTeams,
  type GroupTablesByLetter,
} from "@/lib/engine/rankThirdPlaceTeams";
// NOTE: the user knockout flow no longer calls buildRoundOf32 / rankThirdPlaceTeams.
// The starting Round of 32 now comes from the organizer-entered KnockoutFixture
// rows (shared by all users). Those engine helpers remain for the group stage and
// elsewhere; they are just not part of the knockout flow anymore.
import type { KnockoutMatch, ParticipantSource } from "@/lib/engine/buildRoundOf32";
import {
  resolvePartialBracket,
  type KnockoutRoundName,
  type PartialMatch,
  type PartialParticipant,
  type ResolvedBracket,
} from "@/lib/engine/advanceBracket";
import type { GroupLetter, GroupMatch, GroupStanding } from "@/lib/engine/types";
import type {
  GroupStageState,
  GroupView,
  MatchView,
  KnockoutBracketState,
  KnockoutMatchView,
  KnockoutParticipantView,
} from "@/lib/predictions-types";
import { computeUnlockedFlags } from "@/lib/predictions-gating";

/** The 12 groups in order. */
export const GROUP_LETTERS: GroupLetter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

/** Matches per group (round-robin of four teams). */
export const MATCHES_PER_GROUP = 6;

/**
 * Build the full group-stage state for a user: every group's matches with the
 * user's predictions, completion/sequential-unlock flags, engine-computed
 * standings for complete groups, and the cross-group third-place ranking once
 * all groups are complete.
 */
export async function getGroupStageState(
  userId: string,
): Promise<GroupStageState> {
  const [fixtures, predictions, user] = await Promise.all([
    prisma.groupFixture.findMany({
      orderBy: { matchNumber: "asc" },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.groupPrediction.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const predictionByFixture = new Map(
    predictions.map((p) => [p.groupFixtureId, p]),
  );

  const teamNames: Record<string, string> = {};
  for (const fixture of fixtures) {
    teamNames[fixture.homeTeam.id] = fixture.homeTeam.name;
    teamNames[fixture.awayTeam.id] = fixture.awayTeam.name;
  }

  // First pass: assemble each group's matches, completeness, and (if complete)
  // its engine-computed standings.
  const partials = GROUP_LETTERS.map((letter) => {
    const groupFixtures = fixtures.filter((f) => f.group === letter);

    const matches: MatchView[] = groupFixtures.map((f) => {
      const p = predictionByFixture.get(f.id);
      return {
        fixtureId: f.id,
        matchNumber: f.matchNumber,
        matchday: f.matchday,
        home: { id: f.homeTeam.id, name: f.homeTeam.name },
        away: { id: f.awayTeam.id, name: f.awayTeam.name },
        prediction: p ? { homeGoals: p.homeGoals, awayGoals: p.awayGoals } : null,
      };
    });

    const predictedCount = matches.filter((m) => m.prediction !== null).length;
    const complete = predictedCount === MATCHES_PER_GROUP;

    let standings: GroupStanding[] | null = null;
    if (complete) {
      // Convert the user's predicted scorelines into engine GroupMatch shape.
      const engineMatches: GroupMatch[] = matches.map((m) => ({
        homeTeamId: m.home.id,
        awayTeamId: m.away.id,
        homeGoals: m.prediction!.homeGoals,
        awayGoals: m.prediction!.awayGoals,
      }));
      standings = computeGroupTable(engineMatches);
    }

    return { letter, matches, predictedCount, complete, standings };
  });

  // Second pass: apply the sequential unlock rule across groups.
  const unlockedFlags = computeUnlockedFlags(partials.map((p) => p.complete));
  const groups: GroupView[] = partials.map((p, i) => ({
    ...p,
    unlocked: unlockedFlags[i],
  }));

  const allComplete = groups.every((g) => g.complete);

  let thirdPlaceRanking = null;
  if (allComplete) {
    const tables: GroupTablesByLetter = new Map();
    for (const g of groups) {
      // Safe: allComplete guarantees every group has standings.
      tables.set(g.letter, g.standings!);
    }
    thirdPlaceRanking = rankThirdPlaceTeams(tables);
  }

  return {
    groups,
    allComplete,
    groupsLocked: user?.groupsLockedAt != null,
    thirdPlaceRanking,
    teamNames,
  };
}

// ---------------------------------------------------------------------------
// Knockout bracket derivation
// ---------------------------------------------------------------------------

/** Display labels per round. */
const ROUND_DISPLAY_LABEL: Record<KnockoutRoundName, string> = {
  roundOf32: "Round of 32",
  roundOf16: "Round of 16",
  quarterFinals: "Quarter-finals",
  semiFinals: "Semi-finals",
  final: "Final",
};

/** Schema `round` label per official knockout match number. */
export function schemaRoundForMatch(matchNumber: number): string {
  if (matchNumber >= 73 && matchNumber <= 88) return "R32";
  if (matchNumber >= 89 && matchNumber <= 96) return "R16";
  if (matchNumber >= 97 && matchNumber <= 100) return "QF";
  if (matchNumber >= 101 && matchNumber <= 102) return "SF";
  if (matchNumber === 104) return "FINAL";
  throw new Error(`Unexpected knockout match number ${matchNumber}.`);
}

/** Human-readable origin for a participant's source. */
function originLabel(source: ParticipantSource): string {
  switch (source.type) {
    case "winner":
      return `Winner Group ${source.group}`;
    case "runnerUp":
      return `Runner-up Group ${source.group}`;
    case "third":
      return `3rd place, Group ${source.group}`;
    case "matchWinner":
      return `Winner of match ${source.matchNumber}`;
    case "realR32":
      return `Group ${source.group}`;
  }
}

/**
 * Build the starting Round of 32 from the organizer-entered real matchups. This
 * is the SAME for every user; only their winner picks differ. Returns null if the
 * knockout phase is not open or the 16 matchups are not fully populated.
 */
export async function loadRealRoundOf32(): Promise<{
  roundOf32: KnockoutMatch[];
  teamNames: Record<string, string>;
} | null> {
  const fixtures = await prisma.knockoutFixture.findMany({
    orderBy: { slot: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  if (fixtures.length !== 16) return null;
  if (fixtures.some((f) => !f.homeTeam || !f.awayTeam)) return null;

  const teamNames: Record<string, string> = {};
  const roundOf32: KnockoutMatch[] = fixtures.map((f) => {
    const home = f.homeTeam!;
    const away = f.awayTeam!;
    teamNames[home.id] = home.name;
    teamNames[away.id] = away.name;
    return {
      matchNumber: f.matchNumber,
      slot: f.slot,
      teamA: {
        source: { type: "realR32", group: home.group as GroupLetter },
        teamId: home.id,
      },
      teamB: {
        source: { type: "realR32", group: away.group as GroupLetter },
        teamId: away.id,
      },
    };
  });

  return { roundOf32, teamNames };
}

/**
 * Lower-level bracket bundle used by the server actions: lock/submit flags, the
 * shared real Round of 32, the resolved partial bracket (with effective picks),
 * and team names. Returns null when the knockout phase is not open (or its R32 is
 * not yet fully entered). This is INDEPENDENT of the user's group state.
 */
export async function getUserBracketCore(userId: string): Promise<{
  submitted: boolean;
  lockedByDeadline: boolean;
  roundOf32: KnockoutMatch[];
  resolved: ResolvedBracket;
  teamNames: Record<string, string>;
} | null> {
  const [settings, real, knockoutPicks, user] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    loadRealRoundOf32(),
    prisma.knockoutPrediction.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!user) return null;
  // The phase must be opened by the organizer, and the real R32 must be ready.
  if (settings?.knockoutOpenedAt == null || real == null) return null;

  const rawPicks = new Map(
    knockoutPicks.map((p) => [p.matchNumber, p.predictedWinnerTeamId]),
  );
  const resolved = resolvePartialBracket(real.roundOf32, rawPicks);

  const lockedByDeadline =
    settings.knockoutLockAt != null && settings.knockoutLockAt <= new Date();

  return {
    submitted: user.knockoutStatus === "SUBMITTED",
    lockedByDeadline,
    roundOf32: real.roundOf32,
    resolved,
    teamNames: real.teamNames,
  };
}

function toParticipantView(
  p: PartialParticipant,
  teamNames: Record<string, string>,
): KnockoutParticipantView {
  return {
    source: p.source,
    teamId: p.teamId,
    teamName: p.teamId ? (teamNames[p.teamId] ?? p.teamId) : null,
    label: originLabel(p.source),
  };
}

function toMatchView(
  m: PartialMatch,
  teamNames: Record<string, string>,
): KnockoutMatchView {
  return {
    matchNumber: m.matchNumber,
    slot: m.slot,
    round: m.round,
    roundLabel: ROUND_DISPLAY_LABEL[m.round],
    teamA: toParticipantView(m.teamA, teamNames),
    teamB: toParticipantView(m.teamB, teamNames),
    pick: m.pick,
    determined: m.teamA.teamId !== null && m.teamB.teamId !== null,
  };
}

/**
 * The current user's full knockout bracket as a view model, or null when the
 * knockout phase is not open yet. Independent of the user's group state.
 */
export async function getKnockoutBracketState(
  userId: string,
): Promise<KnockoutBracketState | null> {
  const core = await getUserBracketCore(userId);
  if (!core) return null;

  const { resolved, teamNames, submitted, lockedByDeadline } = core;
  const rounds = resolved.rounds.map((r) => ({
    name: r.name,
    label: ROUND_DISPLAY_LABEL[r.name],
    matches: r.matches.map((m) => toMatchView(m, teamNames)),
  }));

  return {
    rounds,
    championTeamId: resolved.championTeamId,
    championName: resolved.championTeamId
      ? (teamNames[resolved.championTeamId] ?? resolved.championTeamId)
      : null,
    complete: resolved.complete,
    submitted,
    lockedByDeadline,
    teamNames,
  };
}

// ---------------------------------------------------------------------------
// Real knockout results (the actual tournament outcome, entered by the admin)
// ---------------------------------------------------------------------------

/**
 * The real knockout bracket resolved from the actual results entered so far. The
 * starting Round of 32 is the organizer-entered matchups; the recorded
 * KnockoutResult winners are fed through the SAME engine resolver used for user
 * picks, so later real matchups form automatically as earlier real winners are
 * entered, and an edited winner deterministically clears now-impossible later
 * results. Returns null when the knockout phase / real R32 is not ready.
 */
export async function getRealKnockoutBracket(): Promise<{
  roundOf32: KnockoutMatch[];
  resolved: ResolvedBracket;
  teamNames: Record<string, string>;
} | null> {
  const real = await loadRealRoundOf32();
  if (!real) return null;

  const results = await prisma.knockoutResult.findMany({
    select: { matchNumber: true, actualWinnerTeamId: true },
  });
  const recordedWinners = new Map(
    results.map((r) => [r.matchNumber, r.actualWinnerTeamId]),
  );
  const resolved = resolvePartialBracket(real.roundOf32, recordedWinners);

  return { roundOf32: real.roundOf32, resolved, teamNames: real.teamNames };
}

/**
 * The real knockout bracket as a view model for the admin results screen. Each
 * match's `pick` is the recorded actual winner (or null if not entered yet).
 * Returns null when the knockout phase / real R32 is not ready.
 */
export async function getKnockoutResultsState(): Promise<KnockoutBracketState | null> {
  const core = await getRealKnockoutBracket();
  if (!core) return null;

  const { resolved, teamNames } = core;
  const rounds = resolved.rounds.map((r) => ({
    name: r.name,
    label: ROUND_DISPLAY_LABEL[r.name],
    matches: r.matches.map((m) => toMatchView(m, teamNames)),
  }));

  return {
    rounds,
    championTeamId: resolved.championTeamId,
    championName: resolved.championTeamId
      ? (teamNames[resolved.championTeamId] ?? resolved.championTeamId)
      : null,
    complete: resolved.complete,
    submitted: false,
    lockedByDeadline: false,
    teamNames,
  };
}
