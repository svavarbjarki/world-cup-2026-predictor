"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AWARD_FIELD,
  isPlayerCategory,
  isPlayerEligibleForCategory,
  type AwardCategory,
  type AwardSaveResult,
} from "@/lib/awards";
import {
  getUserAwardState,
  awardsLockedByDeadline,
} from "@/lib/awards-server";

const VALID_CATEGORIES: AwardCategory[] = [
  "WINNER",
  "GOLDEN_BALL",
  "GOLDEN_BOOT",
  "GOLDEN_GLOVE",
  "YOUNG_PLAYER",
];

/**
 * Validate a single pick value against the category, server-side. Returns an
 * error string or null. A null value (deselect) is always allowed. Team picks
 * must reference a real team; player picks must reference a real player that is
 * eligible for that category (Glove = GK, Young = eligible age/birth year).
 */
async function validatePick(
  category: AwardCategory,
  valueId: string | null,
): Promise<string | null> {
  if (valueId === null) return null;

  if (!isPlayerCategory(category)) {
    const team = await prisma.team.findUnique({ where: { id: valueId } });
    return team ? null : "Unknown team.";
  }

  const player = await prisma.player.findUnique({ where: { id: valueId } });
  if (!player) return "Unknown player.";
  if (!isPlayerEligibleForCategory(category, player)) {
    return "That player is not eligible for this award.";
  }
  return null;
}

/** Save (or clear) the current user's pick for one award category. */
export async function saveAwardPickAction(
  category: AwardCategory,
  valueId: string | null,
): Promise<AwardSaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (user.awardsStatus === "SUBMITTED") {
    return { ok: false, error: "Your award picks are submitted and locked." };
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return { ok: false, error: "Unknown award category." };
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (awardsLockedByDeadline(settings?.kickoffLockAt)) {
    return { ok: false, error: "Award picks are locked (first kickoff passed)." };
  }

  const validationError = await validatePick(category, valueId);
  if (validationError) return { ok: false, error: validationError };

  const field = AWARD_FIELD[category];
  await prisma.awardPrediction.upsert({
    where: { userId: user.id },
    update: { [field]: valueId },
    create: { userId: user.id, [field]: valueId },
  });

  if (user.awardsStatus === "NOT_STARTED") {
    await prisma.user.update({
      where: { id: user.id },
      data: { awardsStatus: "IN_PROGRESS" },
    });
  }

  return { ok: true, state: await getUserAwardState(user.id) };
}

/**
 * Submit the user's awards. Allowed only before the first-kickoff deadline and
 * when all five categories are picked. Sets awardsStatus SUBMITTED, independent
 * of the group and knockout submissions.
 */
export async function submitAwardsAction(): Promise<AwardSaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  if (user.awardsStatus === "SUBMITTED") {
    return { ok: true, state: await getUserAwardState(user.id) };
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (awardsLockedByDeadline(settings?.kickoffLockAt)) {
    return { ok: false, error: "Award picks are locked (first kickoff passed)." };
  }

  const state = await getUserAwardState(user.id);
  if (!state.complete) {
    return { ok: false, error: "Pick all five award categories first." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { awardsStatus: "SUBMITTED", awardsSubmittedAt: new Date() },
  });

  return { ok: true, state: await getUserAwardState(user.id) };
}
