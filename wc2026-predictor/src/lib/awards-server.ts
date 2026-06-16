// Server loaders for the award predictions: the picker options (teams + players),
// a user's current award state, and helpers to resolve picks into display labels.
// Eligibility is computed by the pure awards module; this only loads data.

import { prisma } from "@/lib/prisma";
import {
  isAwardComplete,
  type AwardState,
  type AwardTeamOption,
  type AwardPlayerOption,
  type AwardPicksIds,
} from "@/lib/awards";

/** Whether the global first-kickoff deadline has passed (awards lock then). */
export function awardsLockedByDeadline(
  kickoffLockAt: Date | null | undefined,
): boolean {
  return kickoffLockAt != null && kickoffLockAt <= new Date();
}

/** Teams and players available in the pickers, with the fields needed to filter. */
export async function getAwardOptions(): Promise<{
  teams: AwardTeamOption[];
  players: AwardPlayerOption[];
}> {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isoCode: true },
    }),
    prisma.player.findMany({
      orderBy: { name: "asc" },
      include: { team: { select: { name: true, isoCode: true } } },
    }),
  ]);

  return {
    teams,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      teamName: p.team.name,
      isoCode: p.team.isoCode,
      position: p.position,
      age: p.age,
      birthYear: p.birthYear,
    })),
  };
}

const EMPTY_PICKS: AwardPicksIds = {
  winnerTeamId: null,
  goldenBallPlayerId: null,
  goldenBootPlayerId: null,
  goldenGlovePlayerId: null,
  youngPlayerId: null,
};

/** Load a user's award state (their picks + lock/submission flags). */
export async function getUserAwardState(userId: string): Promise<AwardState> {
  const [prediction, user, settings] = await Promise.all([
    prisma.awardPrediction.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const picks: AwardPicksIds = prediction
    ? {
        winnerTeamId: prediction.winnerTeamId,
        goldenBallPlayerId: prediction.goldenBallPlayerId,
        goldenBootPlayerId: prediction.goldenBootPlayerId,
        goldenGlovePlayerId: prediction.goldenGlovePlayerId,
        youngPlayerId: prediction.youngPlayerId,
      }
    : { ...EMPTY_PICKS };

  return {
    picks,
    submitted: user?.awardsStatus === "SUBMITTED",
    lockedByDeadline: awardsLockedByDeadline(settings?.kickoffLockAt),
    complete: isAwardComplete(picks),
  };
}

/** The actual award winners (single row), as ids. */
export async function getAwardResultPicks(): Promise<AwardPicksIds> {
  const result = await prisma.awardResult.findUnique({ where: { id: 1 } });
  if (!result) return { ...EMPTY_PICKS };
  return {
    winnerTeamId: result.winnerTeamId,
    goldenBallPlayerId: result.goldenBallPlayerId,
    goldenBootPlayerId: result.goldenBootPlayerId,
    goldenGlovePlayerId: result.goldenGlovePlayerId,
    youngPlayerId: result.youngPlayerId,
  };
}

export interface ResolvedAwardPick {
  label: string;
  isoCode: string;
  /** Player photo URL for player awards; absent for the team winner. */
  photo?: string | null;
}

export interface ResolvedAwardPicks {
  winner: ResolvedAwardPick | null;
  goldenBall: ResolvedAwardPick | null;
  goldenBoot: ResolvedAwardPick | null;
  goldenGlove: ResolvedAwardPick | null;
  youngPlayer: ResolvedAwardPick | null;
}

/** Turn a set of pick ids into display labels (team / player names + flags). */
export async function resolveAwardPicks(
  picks: AwardPicksIds,
): Promise<ResolvedAwardPicks> {
  const { teams, players } = await getAwardOptions();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  // Photos for the picked players (one batched query; team winner has no photo).
  const playerIds = [
    picks.goldenBallPlayerId,
    picks.goldenBootPlayerId,
    picks.goldenGlovePlayerId,
    picks.youngPlayerId,
  ].filter((x): x is string => x != null);
  const photoRows = playerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, photo: true },
      })
    : [];
  const photoById = new Map(photoRows.map((r) => [r.id, r.photo]));

  const team = (id: string | null) => {
    if (!id) return null;
    const t = teamById.get(id);
    return t ? { label: t.name, isoCode: t.isoCode } : null;
  };
  const player = (id: string | null) => {
    if (!id) return null;
    const p = playerById.get(id);
    return p
      ? {
          label: `${p.name} (${p.teamName})`,
          isoCode: p.isoCode,
          photo: photoById.get(id) ?? null,
        }
      : null;
  };

  return {
    winner: team(picks.winnerTeamId),
    goldenBall: player(picks.goldenBallPlayerId),
    goldenBoot: player(picks.goldenBootPlayerId),
    goldenGlove: player(picks.goldenGlovePlayerId),
    youngPlayer: player(picks.youngPlayerId),
  };
}
