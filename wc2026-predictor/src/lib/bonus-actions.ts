"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidBonusChoice } from "@/lib/bonusPredictions";

export interface BonusPickResult {
  ok: boolean;
  error?: string;
}

/** The match's teams + kickoff, looked up by official match number. */
async function loadMatchMeta(matchNumber: number): Promise<{
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date | null;
} | null> {
  // Group stage is 1-72; knockout is 73+. Each is keyed by the official number.
  if (matchNumber <= 72) {
    const f = await prisma.groupFixture.findUnique({
      where: { matchNumber },
      select: { homeTeamId: true, awayTeamId: true, kickoffAt: true },
    });
    return f;
  }
  const f = await prisma.knockoutFixture.findUnique({
    where: { matchNumber },
    select: { homeTeamId: true, awayTeamId: true, kickoffAt: true },
  });
  if (!f || !f.homeTeamId || !f.awayTeamId) return null;
  return {
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    kickoffAt: f.kickoffAt,
  };
}

/**
 * Save or update the current user's pick for a bonus prediction. Open to every
 * signed-in user (no bracket-submission gating). Edits are allowed freely until
 * the match kicks off, after which the pick is locked, the same kickoff lock the
 * rest of the app applies. The choice is validated against the bonus type.
 */
export async function submitBonusPickAction(
  bonusId: string,
  choice: string,
): Promise<BonusPickResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const bonus = await prisma.bonusPrediction.findUnique({
    where: { id: bonusId },
  });
  if (!bonus) return { ok: false, error: "Unknown bonus prediction." };

  const meta = await loadMatchMeta(bonus.matchNumber);
  if (!meta) return { ok: false, error: "Match is not available." };

  // Kickoff lock: no edits once the match has started.
  if (meta.kickoffAt != null && meta.kickoffAt <= new Date()) {
    return { ok: false, error: "This match has kicked off; picks are locked." };
  }

  // First-goalscorer choices must be a player from one of the two squads.
  let validScorerIds: Set<string> | undefined;
  if (bonus.type === "FIRST_SCORER") {
    const players = await prisma.player.findMany({
      where: { teamId: { in: [meta.homeTeamId, meta.awayTeamId] } },
      select: { id: true },
    });
    validScorerIds = new Set(players.map((p) => p.id));
  }

  const valid = isValidBonusChoice(bonus.type, choice, {
    homeTeamId: meta.homeTeamId,
    awayTeamId: meta.awayTeamId,
    validScorerIds,
  });
  if (!valid) return { ok: false, error: "That choice is not valid for this bonus." };

  await prisma.bonusPredictionPick.upsert({
    where: {
      userId_bonusPredictionId: { userId: user.id, bonusPredictionId: bonusId },
    },
    update: { choice },
    create: { userId: user.id, bonusPredictionId: bonusId, choice },
  });

  // The front page is server-rendered; refresh it so the tally reveals.
  revalidatePath("/");
  return { ok: true };
}
