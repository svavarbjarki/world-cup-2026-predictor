// Server loaders for the front-page hub: the player list, the next upcoming
// match (with per-phase-gated predictions), and the gated view of another
// player's predictions. Per-phase visibility is enforced HERE on the server: the
// other-player loaders refuse to load data unless canSeeOthersPredictions allows
// it, so nothing leaks even if the UI is bypassed.

import { prisma } from "@/lib/prisma";
import { hasSubmitted, canSeeOthersPredictions } from "@/lib/visibility";
import { getGroupStageState, getKnockoutBracketState } from "@/lib/predictions";
import { resolveAwardPicks, type ResolvedAwardPicks } from "@/lib/awards-server";
import {
  groupAggregate,
  knockoutAggregate,
  type MatchAggregate,
} from "@/lib/aggregates";
import type {
  GroupStageState,
  KnockoutBracketState,
} from "@/lib/predictions-types";

export interface PlayerSummary {
  id: string;
  displayName: string;
  groupStatus: string;
  knockoutStatus: string;
  awardsStatus: string;
}

/** All players with their three independent submission statuses. */
export async function getPlayers(): Promise<PlayerSummary[]> {
  return prisma.user.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      groupStatus: true,
      knockoutStatus: true,
      awardsStatus: true,
    },
  });
}

interface TeamLite {
  name: string;
  isoCode: string;
}

export interface NextMatchPick {
  displayName: string;
  /** "2-1" for a group score, or a team name for a knockout pick. */
  text: string;
}

export interface NextMatchView {
  phase: "group" | "knockout";
  label: string;
  /** Real kickoff time, or null when the schedule is not seeded yet. */
  kickoffAt: Date | null;
  home: TeamLite;
  away: TeamLite;
  /** The real result has been entered. */
  played: boolean;
  /** Group: "2-1"; knockout: the advancing team's name. Null until played. */
  result: string | null;
  /** Whether the viewer has earned visibility of others' picks for this phase. */
  picksVisible: boolean;
  /** Submitted players' picks, or null when the viewer has not earned visibility. */
  picks: NextMatchPick[] | null;
  /** How submitted players called the outcome, gated by the same phase rule. */
  aggregate: MatchAggregate;
}

interface NextMatchBase {
  phase: "group" | "knockout";
  label: string;
  kickoffAt: Date | null;
  home: TeamLite;
  away: TeamLite;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result: string | null;
  fixtureId?: string;
  matchNumber?: number;
}

/**
 * The next upcoming, unplayed real match: a group fixture or an entered knockout
 * matchup, whichever is soonest. Ordering is by kickoff time when present; when
 * times are absent (not seeded yet) it falls back to fixture order (group by
 * match number, then knockout) and the caller shows "schedule TBD".
 */
async function allMatchesSorted(): Promise<NextMatchBase[]> {
  const [groupFixtures, groupResults, koFixtures, koResults] =
    await Promise.all([
      prisma.groupFixture.findMany({
        orderBy: { matchNumber: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.groupResult.findMany({
        select: { groupFixtureId: true, homeGoals: true, awayGoals: true },
      }),
      prisma.knockoutFixture.findMany({
        orderBy: { slot: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.knockoutResult.findMany({
        select: { matchNumber: true, actualWinnerTeamId: true },
      }),
    ]);

  const groupResultByFixture = new Map(
    groupResults.map((r) => [r.groupFixtureId, r]),
  );
  const koResultByMatch = new Map(
    koResults.map((r) => [r.matchNumber, r.actualWinnerTeamId]),
  );

  type Candidate = NextMatchBase & { order: number };
  const candidates: Candidate[] = [];

  // Every group fixture (played and upcoming), so the carousel can scroll back.
  for (const f of groupFixtures) {
    const res = groupResultByFixture.get(f.id);
    candidates.push({
      phase: "group",
      label: `Group ${f.group}, matchday ${f.matchday}`,
      kickoffAt: f.kickoffAt,
      home: { name: f.homeTeam.name, isoCode: f.homeTeam.isoCode },
      away: { name: f.awayTeam.name, isoCode: f.awayTeam.isoCode },
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      fixtureId: f.id,
      order: f.matchNumber,
      played: res != null,
      result: res ? `${res.homeGoals}-${res.awayGoals}` : null,
    });
  }

  // Every entered knockout matchup (played and upcoming).
  for (const f of koFixtures) {
    if (!f.homeTeam || !f.awayTeam) continue;
    const winnerId = koResultByMatch.get(f.matchNumber);
    const winnerName =
      winnerId == null
        ? null
        : winnerId === f.homeTeamId
          ? f.homeTeam.name
          : f.awayTeam.name;
    candidates.push({
      phase: "knockout",
      label: "Round of 32",
      kickoffAt: f.kickoffAt,
      home: { name: f.homeTeam.name, isoCode: f.homeTeam.isoCode },
      away: { name: f.awayTeam.name, isoCode: f.awayTeam.isoCode },
      homeTeamId: f.homeTeamId!,
      awayTeamId: f.awayTeamId!,
      matchNumber: f.matchNumber,
      // Knockout sorts after all group fixtures in the no-kickoff fallback.
      order: 1000 + f.slot,
      played: winnerId != null,
      result: winnerName,
    });
  }

  candidates.sort((a, b) => {
    // Soonest known kickoff first; unknown times sort after known ones.
    if (a.kickoffAt && b.kickoffAt) {
      return a.kickoffAt.getTime() - b.kickoffAt.getTime();
    }
    if (a.kickoffAt) return -1;
    if (b.kickoffAt) return 1;
    return a.order - b.order;
  });

  return candidates;
}

/**
 * All matches (played and upcoming) for the scrollable matches panel, each with
 * submitted players' picks where the viewer has earned visibility, plus the index
 * of the next unplayed match so the carousel can open there (and the user can
 * scroll back to already-played matches). Picks are loaded in batch and only for
 * the phases the viewer may see, enforcing the per-phase privacy rule here.
 */
export async function getAllMatchesForViewer(
  viewerId: string,
): Promise<{ matches: NextMatchView[]; nextIndex: number }> {
  const [viewer, all] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId } }),
    allMatchesSorted(),
  ]);
  if (!viewer) return { matches: [], nextIndex: 0 };

  const groupVisible = hasSubmitted(viewer.groupStatus);
  const koVisible = hasSubmitted(viewer.knockoutStatus);

  const fixtureIds = all
    .filter((m) => m.phase === "group" && m.fixtureId)
    .map((m) => m.fixtureId!);
  const matchNumbers = all
    .filter((m) => m.phase === "knockout" && m.matchNumber != null)
    .map((m) => m.matchNumber!);

  const [groupPreds, koPreds] = await Promise.all([
    groupVisible && fixtureIds.length > 0
      ? prisma.groupPrediction.findMany({
          where: {
            groupFixtureId: { in: fixtureIds },
            user: { groupStatus: "SUBMITTED" },
          },
          include: { user: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
    koVisible && matchNumbers.length > 0
      ? prisma.knockoutPrediction.findMany({
          where: {
            matchNumber: { in: matchNumbers },
            user: { knockoutStatus: "SUBMITTED" },
          },
          include: {
            user: { select: { displayName: true } },
            predictedWinner: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const byFixture = new Map<string, NextMatchPick[]>();
  const scorelinesByFixture = new Map<
    string,
    { homeGoals: number; awayGoals: number }[]
  >();
  for (const p of groupPreds) {
    const list = byFixture.get(p.groupFixtureId) ?? [];
    list.push({
      displayName: p.user.displayName,
      text: `${p.homeGoals}-${p.awayGoals}`,
    });
    byFixture.set(p.groupFixtureId, list);
    const scores = scorelinesByFixture.get(p.groupFixtureId) ?? [];
    scores.push({ homeGoals: p.homeGoals, awayGoals: p.awayGoals });
    scorelinesByFixture.set(p.groupFixtureId, scores);
  }
  const byMatch = new Map<number, NextMatchPick[]>();
  const winnerIdsByMatch = new Map<number, string[]>();
  for (const p of koPreds) {
    const list = byMatch.get(p.matchNumber) ?? [];
    list.push({ displayName: p.user.displayName, text: p.predictedWinner.name });
    byMatch.set(p.matchNumber, list);
    const ids = winnerIdsByMatch.get(p.matchNumber) ?? [];
    ids.push(p.predictedWinnerTeamId);
    winnerIdsByMatch.set(p.matchNumber, ids);
  }

  const sortByName = (picks: NextMatchPick[]) =>
    [...picks].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const matches: NextMatchView[] = all.map((m) => {
    if (m.phase === "group") {
      return {
        ...m,
        picksVisible: groupVisible,
        picks: groupVisible
          ? sortByName(byFixture.get(m.fixtureId ?? "") ?? [])
          : null,
        aggregate: groupAggregate(
          groupVisible,
          scorelinesByFixture.get(m.fixtureId ?? "") ?? [],
        ),
      };
    }
    return {
      ...m,
      picksVisible: koVisible,
      picks: koVisible ? sortByName(byMatch.get(m.matchNumber ?? -1) ?? []) : null,
      aggregate: knockoutAggregate(
        koVisible,
        winnerIdsByMatch.get(m.matchNumber ?? -1) ?? [],
        m.homeTeamId,
      ),
    };
  });

  const firstUnplayed = matches.findIndex((m) => !m.played);
  const nextIndex =
    firstUnplayed === -1 ? Math.max(0, matches.length - 1) : firstUnplayed;

  return { matches, nextIndex };
}

export interface OtherPlayerView {
  target: { id: string; displayName: string } | null;
  group: {
    allowed: boolean;
    targetSubmitted: boolean;
    state: GroupStageState | null;
  };
  knockout: {
    allowed: boolean;
    targetSubmitted: boolean;
    state: KnockoutBracketState | null;
  };
  awards: {
    allowed: boolean;
    targetSubmitted: boolean;
    picks: ResolvedAwardPicks | null;
  };
}

/**
 * Load another player's predictions for the viewer, gated per phase. The actual
 * prediction data is only fetched when canSeeOthersPredictions permits it (the
 * viewer has submitted that phase AND the target has submitted it). This is the
 * server-side enforcement of the privacy rule: when not allowed, `state` is null
 * and nothing is loaded.
 */
export async function getPlayerPredictionsForViewer(
  viewerId: string,
  targetId: string,
): Promise<OtherPlayerView> {
  const [viewer, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId } }),
    prisma.user.findUnique({ where: { id: targetId } }),
  ]);

  if (!viewer || !target) {
    return {
      target: null,
      group: { allowed: false, targetSubmitted: false, state: null },
      knockout: { allowed: false, targetSubmitted: false, state: null },
      awards: { allowed: false, targetSubmitted: false, picks: null },
    };
  }

  const groupTargetSubmitted = hasSubmitted(target.groupStatus);
  const knockoutTargetSubmitted = hasSubmitted(target.knockoutStatus);
  const awardsTargetSubmitted = hasSubmitted(target.awardsStatus);
  const groupAllowed = canSeeOthersPredictions(
    hasSubmitted(viewer.groupStatus),
    groupTargetSubmitted,
  );
  const knockoutAllowed = canSeeOthersPredictions(
    hasSubmitted(viewer.knockoutStatus),
    knockoutTargetSubmitted,
  );
  const awardsAllowed = canSeeOthersPredictions(
    hasSubmitted(viewer.awardsStatus),
    awardsTargetSubmitted,
  );

  // Awards picks are only loaded + resolved when allowed.
  let awardPicks: ResolvedAwardPicks | null = null;
  if (awardsAllowed) {
    const prediction = await prisma.awardPrediction.findUnique({
      where: { userId: targetId },
    });
    awardPicks = await resolveAwardPicks({
      winnerTeamId: prediction?.winnerTeamId ?? null,
      goldenBallPlayerId: prediction?.goldenBallPlayerId ?? null,
      goldenBootPlayerId: prediction?.goldenBootPlayerId ?? null,
      goldenGlovePlayerId: prediction?.goldenGlovePlayerId ?? null,
      youngPlayerId: prediction?.youngPlayerId ?? null,
    });
  }

  return {
    target: { id: target.id, displayName: target.displayName },
    group: {
      allowed: groupAllowed,
      targetSubmitted: groupTargetSubmitted,
      state: groupAllowed ? await getGroupStageState(targetId) : null,
    },
    knockout: {
      allowed: knockoutAllowed,
      targetSubmitted: knockoutTargetSubmitted,
      state: knockoutAllowed ? await getKnockoutBracketState(targetId) : null,
    },
    awards: {
      allowed: awardsAllowed,
      targetSubmitted: awardsTargetSubmitted,
      picks: awardPicks,
    },
  };
}
