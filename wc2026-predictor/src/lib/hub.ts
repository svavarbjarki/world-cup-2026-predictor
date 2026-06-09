// Server loaders for the front-page hub: the player list, the next upcoming
// match (with per-phase-gated predictions), and the gated view of another
// player's predictions. Per-phase visibility is enforced HERE on the server: the
// other-player loaders refuse to load data unless canSeeOthersPredictions allows
// it, so nothing leaks even if the UI is bypassed.

import { prisma } from "@/lib/prisma";
import { hasSubmitted, canSeeOthersPredictions } from "@/lib/visibility";
import { getGroupStageState, getKnockoutBracketState } from "@/lib/predictions";
import { resolveAwardPicks, type ResolvedAwardPicks } from "@/lib/awards-server";
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
  /** Whether the viewer has earned visibility of others' picks for this phase. */
  picksVisible: boolean;
  /** Submitted players' picks, or null when the viewer has not earned visibility. */
  picks: NextMatchPick[] | null;
}

interface NextMatchBase {
  phase: "group" | "knockout";
  label: string;
  kickoffAt: Date | null;
  home: TeamLite;
  away: TeamLite;
  fixtureId?: string;
  matchNumber?: number;
}

/**
 * The next upcoming, unplayed real match: a group fixture or an entered knockout
 * matchup, whichever is soonest. Ordering is by kickoff time when present; when
 * times are absent (not seeded yet) it falls back to fixture order (group by
 * match number, then knockout) and the caller shows "schedule TBD".
 */
async function getNextMatch(): Promise<NextMatchBase | null> {
  const [groupFixtures, groupResults, koFixtures, koResults] =
    await Promise.all([
      prisma.groupFixture.findMany({
        orderBy: { matchNumber: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.groupResult.findMany({ select: { groupFixtureId: true } }),
      prisma.knockoutFixture.findMany({
        orderBy: { slot: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.knockoutResult.findMany({ select: { matchNumber: true } }),
    ]);

  const playedGroup = new Set(groupResults.map((r) => r.groupFixtureId));
  const playedKo = new Set(koResults.map((r) => r.matchNumber));

  type Candidate = NextMatchBase & { order: number };
  const candidates: Candidate[] = [];

  groupFixtures
    .filter((f) => !playedGroup.has(f.id))
    .forEach((f) => {
      candidates.push({
        phase: "group",
        label: `Group ${f.group}, matchday ${f.matchday}`,
        kickoffAt: f.kickoffAt,
        home: { name: f.homeTeam.name, isoCode: f.homeTeam.isoCode },
        away: { name: f.awayTeam.name, isoCode: f.awayTeam.isoCode },
        fixtureId: f.id,
        order: f.matchNumber,
      });
    });

  koFixtures
    .filter((f) => f.homeTeam && f.awayTeam && !playedKo.has(f.matchNumber))
    .forEach((f) => {
      candidates.push({
        phase: "knockout",
        label: "Round of 32",
        kickoffAt: f.kickoffAt,
        home: { name: f.homeTeam!.name, isoCode: f.homeTeam!.isoCode },
        away: { name: f.awayTeam!.name, isoCode: f.awayTeam!.isoCode },
        matchNumber: f.matchNumber,
        // Knockout sorts after all group fixtures in the no-kickoff fallback.
        order: 1000 + f.slot,
      });
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // Soonest known kickoff first; unknown times sort after known ones.
    if (a.kickoffAt && b.kickoffAt) {
      return a.kickoffAt.getTime() - b.kickoffAt.getTime();
    }
    if (a.kickoffAt) return -1;
    if (b.kickoffAt) return 1;
    return a.order - b.order;
  });

  return candidates[0];
}

/** The next match plus, if the viewer has earned visibility, submitted players' picks. */
export async function getNextMatchForViewer(
  viewerId: string,
): Promise<NextMatchView | null> {
  const [viewer, next] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId } }),
    getNextMatch(),
  ]);
  if (!viewer || !next) return null;

  if (next.phase === "group") {
    const picksVisible = hasSubmitted(viewer.groupStatus);
    let picks: NextMatchPick[] | null = null;
    if (picksVisible && next.fixtureId) {
      // Only submitted players' predictions are revealed.
      const preds = await prisma.groupPrediction.findMany({
        where: {
          groupFixtureId: next.fixtureId,
          user: { groupStatus: "SUBMITTED" },
        },
        include: { user: { select: { displayName: true } } },
      });
      picks = preds
        .map((p) => ({
          displayName: p.user.displayName,
          text: `${p.homeGoals}-${p.awayGoals}`,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return { ...next, picksVisible, picks };
  }

  const picksVisible = hasSubmitted(viewer.knockoutStatus);
  let picks: NextMatchPick[] | null = null;
  if (picksVisible && next.matchNumber) {
    const preds = await prisma.knockoutPrediction.findMany({
      where: {
        matchNumber: next.matchNumber,
        user: { knockoutStatus: "SUBMITTED" },
      },
      include: {
        user: { select: { displayName: true } },
        predictedWinner: { select: { name: true } },
      },
    });
    picks = preds
      .map((p) => ({
        displayName: p.user.displayName,
        text: p.predictedWinner.name,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return { ...next, picksVisible, picks };
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
