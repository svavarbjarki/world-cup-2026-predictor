"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  verifyAdminPassword,
  setAdminCookie,
  clearAdminCookie,
  isAdminAuthed,
} from "@/lib/auth";
import {
  findDuplicateTeamId,
  r32OpenError,
  type R32SlotAssignment,
  type AdminSaveResult,
} from "@/lib/admin-r32";
import {
  getRealKnockoutBracket,
  getKnockoutResultsState,
  schemaRoundForMatch,
} from "@/lib/predictions";
import { resolvePartialBracket } from "@/lib/engine/advanceBracket";
import { isValidGoal } from "@/lib/predictions-gating";
import {
  AWARD_FIELD,
  isPlayerCategory,
  isPlayerEligibleForCategory,
  type AwardCategory,
  type AdminAwardSaveResult,
} from "@/lib/awards";
import { getAwardResultPicks } from "@/lib/awards-server";
import type { AuthActionState } from "@/lib/auth-types";
import type { KnockoutSaveResult } from "@/lib/predictions-types";

/** Step 0: organizer logs in with the admin password. */
export async function loginAdminAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    return { error: "Wrong admin password." };
  }
  await setAdminCookie();
  redirect("/admin");
}

/** Admin log out. */
export async function logoutAdminAction(): Promise<void> {
  await clearAdminCookie();
  redirect("/admin");
}

/** True if the knockout phase has already been opened (matchups frozen). */
async function knockoutIsOpen(): Promise<boolean> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings?.knockoutOpenedAt != null;
}

/** Load all 16 R32 fixtures as plain slot assignments. */
async function loadSlots(): Promise<R32SlotAssignment[]> {
  const fixtures = await prisma.knockoutFixture.findMany({
    orderBy: { slot: "asc" },
  });
  return fixtures.map((f) => ({
    matchNumber: f.matchNumber,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
  }));
}

/**
 * Set (or clear) the two teams for one R32 match.
 *
 * Server-side enforcement: admin only; matchups are frozen once the phase is
 * open; a match cannot have the same team twice; and a team cannot appear in two
 * different R32 matches. Pass an empty string or null to clear a side.
 */
export async function saveR32MatchAction(
  matchNumber: number,
  homeTeamIdRaw: string | null,
  awayTeamIdRaw: string | null,
): Promise<AdminSaveResult> {
  if (!(await isAdminAuthed())) {
    return { ok: false, error: "Not authorized." };
  }
  if (await knockoutIsOpen()) {
    return {
      ok: false,
      error: "The knockout phase is open, so matchups are frozen.",
    };
  }

  const homeTeamId = homeTeamIdRaw ? homeTeamIdRaw : null;
  const awayTeamId = awayTeamIdRaw ? awayTeamIdRaw : null;

  if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
    return { ok: false, error: "A match cannot have the same team twice." };
  }

  // Validate that any chosen team actually exists.
  const chosen = [homeTeamId, awayTeamId].filter((x): x is string => x != null);
  if (chosen.length > 0) {
    const count = await prisma.team.count({ where: { id: { in: chosen } } });
    if (count !== chosen.length) {
      return { ok: false, error: "Unknown team selected." };
    }
  }

  // Reject if this change would put a team in more than one match.
  const slots = await loadSlots();
  const proposed = slots.map((s) =>
    s.matchNumber === matchNumber ? { matchNumber, homeTeamId, awayTeamId } : s,
  );
  const duplicate = findDuplicateTeamId(proposed);
  if (duplicate) {
    return {
      ok: false,
      error: "That team is already selected in another match.",
    };
  }

  const updated = await prisma.knockoutFixture.updateMany({
    where: { matchNumber },
    data: { homeTeamId, awayTeamId },
  });
  if (updated.count === 0) {
    return { ok: false, error: "That Round of 32 match does not exist." };
  }

  return { ok: true };
}

/**
 * Open the knockout phase. Allowed only when all 16 R32 matches are filled with
 * no duplicate teams. Sets Settings.knockoutOpenedAt, which freezes the matchups
 * and (in the next task) makes the user knockout flow available.
 */
export async function openKnockoutPhaseAction(): Promise<AdminSaveResult> {
  if (!(await isAdminAuthed())) {
    return { ok: false, error: "Not authorized." };
  }
  if (await knockoutIsOpen()) {
    return { ok: true }; // already open, idempotent
  }

  const slots = await loadSlots();
  const error = r32OpenError(slots);
  if (error) {
    return { ok: false, error };
  }

  await prisma.settings.update({
    where: { id: 1 },
    data: { knockoutOpenedAt: new Date() },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Results entry (rolling, as matches finish)
// ---------------------------------------------------------------------------

/**
 * Enter or edit the real final score of a group fixture. Admin only. Validates
 * non-negative integer goals and that the fixture exists. Upserts the GroupResult
 * so corrections are allowed. Scoring is computed on the fly from results by the
 * leaderboard, so saving here is all that is needed for points to update.
 */
export async function saveGroupResultAction(
  fixtureId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<AdminSaveResult> {
  if (!(await isAdminAuthed())) {
    return { ok: false, error: "Not authorized." };
  }
  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals)) {
    return { ok: false, error: "Enter whole numbers from 0 to 99 for each score." };
  }

  const fixture = await prisma.groupFixture.findUnique({
    where: { id: fixtureId },
  });
  if (!fixture) return { ok: false, error: "That fixture does not exist." };

  await prisma.groupResult.upsert({
    where: { groupFixtureId: fixtureId },
    update: { homeGoals, awayGoals },
    create: { groupFixtureId: fixtureId, homeGoals, awayGoals },
  });

  return { ok: true };
}

/**
 * Enter or edit the real winner of a knockout match. Admin only.
 *
 * Server-enforced: the knockout phase and real R32 must be ready, the match must
 * be determined by earlier real results, and the winner must be one of the two
 * real teams currently in it. Editing a winner deterministically clears any later
 * real result that referenced a team that no longer advances (same engine
 * invalidation as the user pick flow). Scoring updates on the fly from results.
 */
export async function saveKnockoutResultAction(
  matchNumber: number,
  winnerTeamId: string,
): Promise<KnockoutSaveResult> {
  if (!(await isAdminAuthed())) {
    return { ok: false, error: "Not authorized." };
  }

  const core = await getRealKnockoutBracket();
  if (!core) {
    return {
      ok: false,
      error: "Open the knockout phase and enter the Round of 32 first.",
    };
  }

  const match = core.resolved.rounds
    .flatMap((r) => r.matches)
    .find((m) => m.matchNumber === matchNumber);
  if (!match) return { ok: false, error: "That match does not exist." };
  if (match.teamA.teamId === null || match.teamB.teamId === null) {
    return { ok: false, error: "Enter the earlier real results first." };
  }
  if (winnerTeamId !== match.teamA.teamId && winnerTeamId !== match.teamB.teamId) {
    return { ok: false, error: "That team is not in this match." };
  }

  // Recompute the real bracket with the new winner to learn which results survive.
  const newWinners = new Map(core.resolved.effectivePicks);
  newWinners.set(matchNumber, winnerTeamId);
  const newResolved = resolvePartialBracket(core.roundOf32, newWinners);
  const surviving = [...newResolved.effectivePicks.keys()];

  await prisma.$transaction([
    prisma.knockoutResult.upsert({
      where: { matchNumber },
      update: {
        actualWinnerTeamId: winnerTeamId,
        round: schemaRoundForMatch(matchNumber),
      },
      create: {
        matchNumber,
        actualWinnerTeamId: winnerTeamId,
        round: schemaRoundForMatch(matchNumber),
      },
    }),
    prisma.knockoutResult.deleteMany({
      where: { matchNumber: { notIn: surviving } },
    }),
  ]);

  const state = await getKnockoutResultsState();
  if (!state) return { ok: false, error: "Could not load the bracket." };
  return { ok: true, state };
}

/**
 * Set (or clear) the actual winner for one award category. Admin only. Same
 * eligibility validation as the user picks (Glove = GK, Young = eligible). The
 * single AwardResult row is upserted, so corrections are allowed; scoring picks
 * up the change on the fly via the leaderboard.
 */
export async function setAwardResultAction(
  category: AwardCategory,
  valueId: string | null,
): Promise<AdminAwardSaveResult> {
  if (!(await isAdminAuthed())) {
    return { ok: false, error: "Not authorized." };
  }

  if (valueId !== null) {
    if (!isPlayerCategory(category)) {
      const team = await prisma.team.findUnique({ where: { id: valueId } });
      if (!team) return { ok: false, error: "Unknown team." };
    } else {
      const player = await prisma.player.findUnique({ where: { id: valueId } });
      if (!player) return { ok: false, error: "Unknown player." };
      if (!isPlayerEligibleForCategory(category, player)) {
        return { ok: false, error: "That player is not eligible for this award." };
      }
    }
  }

  const field = AWARD_FIELD[category];
  await prisma.awardResult.upsert({
    where: { id: 1 },
    update: { [field]: valueId },
    create: { id: 1, [field]: valueId },
  });

  return { ok: true, picks: await getAwardResultPicks() };
}

/**
 * Delete a user and all their predictions (group, knockout, awards cascade via
 * the schema relations). Admin only. Used by the admin dashboard to remove a
 * player, for example a duplicate or test entry.
 */
export async function deleteUserAction(
  userId: string,
): Promise<AdminSaveResult> {
  if (!(await isAdminAuthed())) {
    return { ok: false, error: "Not authorized." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "That user does not exist." };

  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}
