// Server loaders for the front-page hub: the player list, the next upcoming
// match (with per-phase-gated predictions), and the gated view of another
// player's predictions. Per-phase visibility is enforced HERE on the server: the
// other-player loaders refuse to load data unless canSeeOthersPredictions allows
// it, so nothing leaks even if the UI is bypassed.

import { prisma } from "@/lib/prisma";
import { hasSubmitted, canSeeOthersPredictions } from "@/lib/visibility";
import {
  getGroupStageState,
  getKnockoutBracketState,
  getRealKnockoutBracket,
} from "@/lib/predictions";
import { resolveAwardPicks, type ResolvedAwardPicks } from "@/lib/awards-server";
import {
  groupAggregate,
  knockoutAggregate,
  type MatchAggregate,
} from "@/lib/aggregates";
import { matchOutcome } from "@/lib/engine/outcome";
import { rawTeamColor } from "@/lib/team-colors";
import type { GoalEventView } from "@/lib/goal-events";
import type { ResolvedBracket } from "@/lib/engine/advanceBracket";
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
  /**
   * Hex colour of the team this pick favours (the predicted winner, or the team
   * favoured by a group scoreline), used to tint the pick. Null for a draw or when
   * the team has no colour, so the UI falls back to a neutral style.
   */
  color: string | null;
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
  /** Real goal events for a played match, ordered by minute. These reflect the
   *  actual result, so they are shown to everyone regardless of submission. */
  goals: GoalEventView[];
}

export interface NextMatchBase {
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
export async function allMatchesSorted(): Promise<NextMatchBase[]> {
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
      matchNumber: f.matchNumber,
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

  // Resolve each match's teams so a pick can be tinted with the favoured team's
  // colour (the predicted winner for knockout; the team a scoreline favours for
  // group, neutral for a draw).
  const baseByFixture = new Map(
    all.filter((m) => m.fixtureId).map((m) => [m.fixtureId!, m]),
  );
  const baseByMatch = new Map(
    all.filter((m) => m.matchNumber != null).map((m) => [m.matchNumber!, m]),
  );

  const byFixture = new Map<string, NextMatchPick[]>();
  const scorelinesByFixture = new Map<
    string,
    { homeGoals: number; awayGoals: number }[]
  >();
  for (const p of groupPreds) {
    const base = baseByFixture.get(p.groupFixtureId);
    const outcome = matchOutcome({
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
    });
    const color = !base
      ? null
      : outcome === "home"
        ? rawTeamColor(base.home.isoCode)
        : outcome === "away"
          ? rawTeamColor(base.away.isoCode)
          : null; // draw stays neutral
    const list = byFixture.get(p.groupFixtureId) ?? [];
    list.push({
      displayName: p.user.displayName,
      text: `${p.homeGoals}-${p.awayGoals}`,
      color,
    });
    byFixture.set(p.groupFixtureId, list);
    const scores = scorelinesByFixture.get(p.groupFixtureId) ?? [];
    scores.push({ homeGoals: p.homeGoals, awayGoals: p.awayGoals });
    scorelinesByFixture.set(p.groupFixtureId, scores);
  }
  const byMatch = new Map<number, NextMatchPick[]>();
  const winnerIdsByMatch = new Map<number, string[]>();
  for (const p of koPreds) {
    const base = baseByMatch.get(p.matchNumber);
    const color = !base
      ? null
      : p.predictedWinnerTeamId === base.homeTeamId
        ? rawTeamColor(base.home.isoCode)
        : rawTeamColor(base.away.isoCode);
    const list = byMatch.get(p.matchNumber) ?? [];
    list.push({
      displayName: p.user.displayName,
      text: p.predictedWinner.name,
      color,
    });
    byMatch.set(p.matchNumber, list);
    const ids = winnerIdsByMatch.get(p.matchNumber) ?? [];
    ids.push(p.predictedWinnerTeamId);
    winnerIdsByMatch.set(p.matchNumber, ids);
  }

  const sortByName = (picks: NextMatchPick[]) =>
    [...picks].sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Real goal events for the played matches. Not gated by submission status:
  // they reflect the actual result, like the scoreline itself.
  const [groupGoalRows, koGoalRows] = await Promise.all([
    fixtureIds.length > 0
      ? prisma.goalEvent.findMany({
          where: { groupResult: { groupFixtureId: { in: fixtureIds } } },
          include: {
            scorer: { select: { name: true, photo: true } },
            assister: { select: { name: true } },
            groupResult: { select: { groupFixtureId: true } },
          },
        })
      : Promise.resolve([]),
    matchNumbers.length > 0
      ? prisma.goalEvent.findMany({
          where: { knockoutResult: { matchNumber: { in: matchNumbers } } },
          include: {
            scorer: { select: { name: true, photo: true } },
            assister: { select: { name: true } },
            knockoutResult: { select: { matchNumber: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const toGoalView = (g: {
    side: string;
    scorerId: string | null;
    scorer: { name: string; photo: string | null } | null;
    assisterId: string | null;
    assister: { name: string } | null;
    minute: number | null;
  }): GoalEventView => ({
    side: g.side === "away" ? "away" : "home",
    scorerId: g.scorerId,
    scorerName: g.scorer?.name ?? null,
    scorerPhoto: g.scorer?.photo ?? null,
    assisterId: g.assisterId,
    assisterName: g.assister?.name ?? null,
    minute: g.minute,
  });
  const byMinute = (a: GoalEventView, b: GoalEventView) =>
    (a.minute ?? 999) - (b.minute ?? 999);

  const goalsByFixture = new Map<string, GoalEventView[]>();
  for (const g of groupGoalRows) {
    const fid = g.groupResult?.groupFixtureId;
    if (!fid) continue;
    const list = goalsByFixture.get(fid) ?? [];
    list.push(toGoalView(g));
    goalsByFixture.set(fid, list);
  }
  const goalsByMatch = new Map<number, GoalEventView[]>();
  for (const g of koGoalRows) {
    const mn = g.knockoutResult?.matchNumber;
    if (mn == null) continue;
    const list = goalsByMatch.get(mn) ?? [];
    list.push(toGoalView(g));
    goalsByMatch.set(mn, list);
  }

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
        goals: [...(goalsByFixture.get(m.fixtureId ?? "") ?? [])].sort(byMinute),
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
      goals: [...(goalsByMatch.get(m.matchNumber ?? -1) ?? [])].sort(byMinute),
    };
  });

  const firstUnplayed = matches.findIndex((m) => !m.played);
  const nextIndex =
    firstUnplayed === -1 ? Math.max(0, matches.length - 1) : firstUnplayed;

  return { matches, nextIndex };
}

/** Official match number of the Final. The picked winner of it is the champion. */
const FINAL_MATCH_NUMBER = 104;

export interface PredictedChampion {
  /** Team id (also the isoCode) of the predicted champion. */
  teamId: string;
  name: string;
  isoCode: string;
  /** True once that team has lost a real, entered knockout match. */
  eliminated: boolean;
}

/**
 * Teams that have been knocked out in the real tournament so far: in any real
 * knockout match that has a recorded winner, the other participant is eliminated.
 * Derived from the SAME resolved real bracket used elsewhere, so later-round
 * matchups (and therefore losers) form as earlier winners are entered.
 */
function eliminatedTeamIds(resolved: ResolvedBracket | null): Set<string> {
  const out = new Set<string>();
  if (!resolved) return out;
  for (const round of resolved.rounds) {
    for (const m of round.matches) {
      if (m.pick == null) continue;
      for (const side of [m.teamA, m.teamB]) {
        if (side.teamId != null && side.teamId !== m.pick) out.add(side.teamId);
      }
    }
  }
  return out;
}

/**
 * The predicted tournament champion (winner of the Final) for every user who has
 * SUBMITTED their knockout bracket, keyed by userId, with whether that team has
 * already been eliminated in the real tournament. Users who have not submitted are
 * absent from the map, so the leaderboard shows nothing for them.
 */
export async function getPredictedChampions(): Promise<
  Map<string, PredictedChampion>
> {
  const [finalPicks, realBracket] = await Promise.all([
    prisma.knockoutPrediction.findMany({
      where: {
        matchNumber: FINAL_MATCH_NUMBER,
        user: { knockoutStatus: "SUBMITTED" },
      },
      include: {
        predictedWinner: { select: { id: true, name: true, isoCode: true } },
      },
    }),
    getRealKnockoutBracket(),
  ]);

  const eliminated = eliminatedTeamIds(realBracket?.resolved ?? null);

  const byUser = new Map<string, PredictedChampion>();
  for (const p of finalPicks) {
    byUser.set(p.userId, {
      teamId: p.predictedWinnerTeamId,
      name: p.predictedWinner.name,
      isoCode: p.predictedWinner.isoCode,
      eliminated: eliminated.has(p.predictedWinnerTeamId),
    });
  }
  return byUser;
}

export interface ChampionPick {
  displayName: string;
  teamName: string;
  isoCode: string;
}

/**
 * Every submitted player's predicted tournament winner (the team they picked in
 * the Final), for the champion-pick carousel. Only users who have submitted their
 * knockout bracket have a Final pick, so the list is empty until at least one has,
 * and the caller hides the section. Sorted by display name for a stable order.
 */
export async function getChampionPicks(): Promise<ChampionPick[]> {
  const picks = await prisma.knockoutPrediction.findMany({
    where: {
      matchNumber: FINAL_MATCH_NUMBER,
      user: { knockoutStatus: "SUBMITTED" },
    },
    include: {
      user: { select: { displayName: true } },
      predictedWinner: { select: { name: true, isoCode: true } },
    },
  });
  return picks
    .map((p) => ({
      displayName: p.user.displayName,
      teamName: p.predictedWinner.name,
      isoCode: p.predictedWinner.isoCode,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface PerfectScoreShoutout {
  homeName: string;
  awayName: string;
  homeIso: string;
  awayIso: string;
  homeGoals: number;
  awayGoals: number;
  /** Display names of every submitted user who nailed the exact scoreline. */
  players: string[];
}

/**
 * Shoutout for the most recently completed real GROUP match: the players who
 * predicted its exact scoreline. Knockout matches are excluded because they have
 * no scoreline to match. "Most recent" is the group fixture with a result and the
 * latest kickoff time (fixtures with no kickoff time sort last, tie-broken by
 * match number). Returns null when there is no completed group match yet or nobody
 * got the exact score, so the caller hides the section.
 */
export async function getLastMatchPerfectScores(): Promise<PerfectScoreShoutout | null> {
  const results = await prisma.groupResult.findMany({
    select: {
      homeGoals: true,
      awayGoals: true,
      groupFixture: {
        select: {
          id: true,
          kickoffAt: true,
          matchNumber: true,
          homeTeam: { select: { name: true, isoCode: true } },
          awayTeam: { select: { name: true, isoCode: true } },
        },
      },
    },
  });
  if (results.length === 0) return null;

  // Latest by kickoff time (unknown kickoff sorts last), then by match number.
  const latest = results.reduce((best, r) => {
    const a = r.groupFixture.kickoffAt?.getTime() ?? -Infinity;
    const b = best.groupFixture.kickoffAt?.getTime() ?? -Infinity;
    if (a !== b) return a > b ? r : best;
    return r.groupFixture.matchNumber > best.groupFixture.matchNumber ? r : best;
  }, results[0]);

  const f = latest.groupFixture;
  const exactPreds = await prisma.groupPrediction.findMany({
    where: {
      groupFixtureId: f.id,
      homeGoals: latest.homeGoals,
      awayGoals: latest.awayGoals,
      user: { groupStatus: "SUBMITTED" },
    },
    include: { user: { select: { displayName: true } } },
  });
  if (exactPreds.length === 0) return null;

  return {
    homeName: f.homeTeam.name,
    awayName: f.awayTeam.name,
    homeIso: f.homeTeam.isoCode,
    awayIso: f.awayTeam.isoCode,
    homeGoals: latest.homeGoals,
    awayGoals: latest.awayGoals,
    players: exactPreds
      .map((p) => p.user.displayName)
      .sort((a, b) => a.localeCompare(b)),
  };
}

export interface StatRow {
  playerId: string;
  name: string;
  /** Team isoCode (also Team.id), for the flag. */
  isoCode: string;
  /** Squad photo URL, or null (award-only rows have none). */
  photo: string | null;
  count: number;
}

/**
 * Resolve grouped {playerId, count} tallies into the top 5 rows: fetch the player
 * names in one batched query (not per player), sort by count descending then name
 * ascending for a stable, alphabetical tie-break, and take the top 5.
 */
async function topStatRows(
  counts: { id: string; count: number }[],
): Promise<StatRow[]> {
  if (counts.length === 0) return [];
  const players = await prisma.player.findMany({
    where: { id: { in: counts.map((c) => c.id) } },
    select: { id: true, name: true, teamId: true, photo: true },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const rows = counts.flatMap((c) => {
    const p = byId.get(c.id);
    return p
      ? [
          {
            playerId: c.id,
            name: p.name,
            isoCode: p.teamId,
            photo: p.photo,
            count: c.count,
          },
        ]
      : [];
  });
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return rows.slice(0, 5);
}

/**
 * Top 5 goal scorers and top 5 assisters from the real goal events. One grouped
 * query per stat (plus one batched name lookup), so no N+1. Reflects real results,
 * so it is shown to everyone regardless of submission status.
 */
export async function getTopScorersAndAssisters(): Promise<{
  scorers: StatRow[];
  assisters: StatRow[];
}> {
  const [scorerGroups, assisterGroups] = await Promise.all([
    prisma.goalEvent.groupBy({
      by: ["scorerId"],
      where: { scorerId: { not: null } },
      _count: { scorerId: true },
    }),
    prisma.goalEvent.groupBy({
      by: ["assisterId"],
      where: { assisterId: { not: null } },
      _count: { assisterId: true },
    }),
  ]);

  const [scorers, assisters] = await Promise.all([
    topStatRows(
      scorerGroups.map((g) => ({ id: g.scorerId as string, count: g._count.scorerId })),
    ),
    topStatRows(
      assisterGroups.map((g) => ({
        id: g.assisterId as string,
        count: g._count.assisterId,
      })),
    ),
  ]);

  return { scorers, assisters };
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
