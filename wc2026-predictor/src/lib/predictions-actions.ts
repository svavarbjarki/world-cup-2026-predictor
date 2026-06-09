"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getGroupStageState,
  getUserBracketCore,
  getKnockoutBracketState,
  schemaRoundForMatch,
} from "@/lib/predictions";
import { resolvePartialBracket } from "@/lib/engine/advanceBracket";
import { isValidGoal, canLockGroups } from "@/lib/predictions-gating";
import type { SaveResult, KnockoutSaveResult } from "@/lib/predictions-types";

/**
 * Save (or update) the current user's predicted scoreline for one group match.
 *
 * Server-side enforcement, not just UI:
 *   - must be signed in,
 *   - groups must not already be locked,
 *   - goals must be whole numbers from 0 to 99,
 *   - the fixture must belong to a group that is unlocked under the sequential
 *     rule (all earlier groups complete).
 */
export async function saveMatchPredictionAction(
  fixtureId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (user.groupsLockedAt) {
    return { ok: false, error: "Your group predictions are locked." };
  }

  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals)) {
    return { ok: false, error: "Enter whole numbers from 0 to 99 for each score." };
  }

  // Use the same state the UI sees to validate sequencing on the server.
  const state = await getGroupStageState(user.id);
  const group = state.groups.find((g) =>
    g.matches.some((m) => m.fixtureId === fixtureId),
  );
  if (!group) return { ok: false, error: "That match does not exist." };
  if (!group.unlocked) {
    return {
      ok: false,
      error: `Finish the earlier groups before predicting Group ${group.letter}.`,
    };
  }

  await prisma.groupPrediction.upsert({
    where: {
      userId_groupFixtureId: { userId: user.id, groupFixtureId: fixtureId },
    },
    update: { homeGoals, awayGoals },
    create: {
      userId: user.id,
      groupFixtureId: fixtureId,
      homeGoals,
      awayGoals,
    },
  });

  if (user.groupStatus === "NOT_STARTED") {
    await prisma.user.update({
      where: { id: user.id },
      data: { groupStatus: "IN_PROGRESS" },
    });
  }

  return { ok: true, state: await getGroupStageState(user.id) };
}

/**
 * Perform the groups-phase lock. Allowed only when all 12 groups are complete.
 * This is a phase checkpoint that freezes group predictions and opens the
 * knockout stage; it does NOT set the user to SUBMITTED.
 */
export async function lockGroupsAction(): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  if (user.groupsLockedAt) {
    // Idempotent: already locked.
    return { ok: true, state: await getGroupStageState(user.id) };
  }

  const state = await getGroupStageState(user.id);
  if (!canLockGroups(state.allComplete, false)) {
    return { ok: false, error: "Fill in all 12 groups before locking." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { groupsLockedAt: new Date(), groupStatus: "SUBMITTED" },
  });

  return { ok: true, state: await getGroupStageState(user.id) };
}

// ---------------------------------------------------------------------------
// Knockout stage
// ---------------------------------------------------------------------------

/**
 * Save (or change) the current user's winner pick for one knockout match.
 *
 * Server-side enforcement (independent of the user's group state):
 *   - must be signed in and not already knockout-SUBMITTED,
 *   - the knockout phase must be open and not past its deadline,
 *   - the match must be fully determined by upstream picks,
 *   - the picked team must be one of the two teams currently in that match,
 *   - any downstream pick that the change invalidates is cleared deterministically
 *     (the engine recomputes which picks survive; the rest are deleted).
 */
export async function saveKnockoutPickAction(
  matchNumber: number,
  teamId: string,
): Promise<KnockoutSaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (user.knockoutStatus === "SUBMITTED") {
    return { ok: false, error: "Your knockout picks are submitted and locked." };
  }

  const core = await getUserBracketCore(user.id);
  if (!core) {
    return { ok: false, error: "Knockout predictions are not open yet." };
  }
  if (core.lockedByDeadline) {
    return { ok: false, error: "Knockout predictions are locked (deadline passed)." };
  }

  const match = core.resolved.rounds
    .flatMap((r) => r.matches)
    .find((m) => m.matchNumber === matchNumber);
  if (!match) return { ok: false, error: "That match does not exist." };
  if (match.teamA.teamId === null || match.teamB.teamId === null) {
    return { ok: false, error: "Pick the earlier matches in this path first." };
  }
  if (teamId !== match.teamA.teamId && teamId !== match.teamB.teamId) {
    return { ok: false, error: "That team is not in this match." };
  }

  // Recompute the bracket with the new pick to learn which picks still survive.
  const newPicks = new Map(core.resolved.effectivePicks);
  newPicks.set(matchNumber, teamId);
  const newResolved = resolvePartialBracket(core.roundOf32, newPicks);
  const survivingMatchNumbers = [...newResolved.effectivePicks.keys()];

  // Persist atomically: store this pick, drop any pick that no longer survives
  // (downstream invalidation). Surviving rows other than this one are unchanged.
  await prisma.$transaction([
    prisma.knockoutPrediction.upsert({
      where: {
        userId_matchNumber: { userId: user.id, matchNumber },
      },
      update: {
        predictedWinnerTeamId: teamId,
        round: schemaRoundForMatch(matchNumber),
      },
      create: {
        userId: user.id,
        matchNumber,
        predictedWinnerTeamId: teamId,
        round: schemaRoundForMatch(matchNumber),
      },
    }),
    prisma.knockoutPrediction.deleteMany({
      where: {
        userId: user.id,
        matchNumber: { notIn: survivingMatchNumbers },
      },
    }),
  ]);

  const state = await getKnockoutBracketState(user.id);
  if (!state) return { ok: false, error: "Could not load your bracket." };
  return { ok: true, state };
}

/**
 * Knockout submission. Independent of the group submission. Allowed only when the
 * knockout phase is open, not past its deadline, and the user has a complete set
 * of picks (a winner for every match down to the champion). Sets the knockout
 * status to SUBMITTED + knockoutSubmittedAt, which permanently locks knockout
 * editing. It does NOT touch the group submission.
 */
export async function submitFinalAction(): Promise<KnockoutSaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  if (user.knockoutStatus === "SUBMITTED") {
    const state = await getKnockoutBracketState(user.id);
    if (!state) return { ok: false, error: "Could not load your bracket." };
    return { ok: true, state };
  }

  const core = await getUserBracketCore(user.id);
  if (!core) return { ok: false, error: "Knockout predictions are not open yet." };
  if (core.lockedByDeadline) {
    return { ok: false, error: "Knockout predictions are locked (deadline passed)." };
  }
  if (!core.resolved.complete) {
    return { ok: false, error: "Pick a winner for every knockout match first." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { knockoutStatus: "SUBMITTED", knockoutSubmittedAt: new Date() },
  });

  const state = await getKnockoutBracketState(user.id);
  if (!state) return { ok: false, error: "Could not load your bracket." };
  return { ok: true, state };
}
