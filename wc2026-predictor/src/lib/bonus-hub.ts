// Server loader for the front-page bonus box. Determines the next real match
// (reusing the same allMatchesSorted ordering the matches panel uses), lazily
// generates that match's bonus prediction, and assembles the active question
// (with the viewer's own pick and, once they have picked, the live tally) plus a
// recap of the most recently resolved bonus. All grading is computed live from
// the existing result + goal-event rows; nothing about correctness is stored.

import { prisma } from "@/lib/prisma";
import { allMatchesSorted, type NextMatchBase } from "@/lib/hub";
import {
  bonusQuestion,
  correctBonusAnswer,
  ensureBonusPredictionForMatch,
  type BonusGoalEvent,
  type BonusMatchContext,
  type BonusType,
} from "@/lib/bonusPredictions";

export interface BonusTeamLite {
  id: string;
  name: string;
  isoCode: string;
}

export interface BonusScorerOption {
  id: string;
  name: string;
  isoCode: string;
}

export interface BonusTallyEntry {
  choice: string;
  label: string;
  count: number;
}

export interface BonusActiveView {
  bonusId: string;
  matchNumber: number;
  type: BonusType;
  question: string;
  matchLabel: string;
  home: BonusTeamLite;
  away: BonusTeamLite;
  line: number | null;
  /** Kickoff has passed: no edits allowed. */
  locked: boolean;
  /** The viewer's current choice, or null if they have not picked. */
  userChoice: string | null;
  /** Players of both squads, for the first-goalscorer select. Null otherwise. */
  scorerOptions: BonusScorerOption[] | null;
  /** Everyone's picks, revealed ONLY once the viewer has picked (else null). */
  tally: BonusTallyEntry[] | null;
  totalPicks: number;
}

export interface BonusRecapView {
  matchLabel: string;
  question: string;
  /** The correct answer label, or null when there is no correct answer (0-0 etc). */
  correctAnswerLabel: string | null;
  /** What the viewer picked, or null if they did not pick this one. */
  userPickLabel: string | null;
  /** Whether the viewer was right; null if they did not pick or there is no answer. */
  userWasRight: boolean | null;
}

export interface BonusBoxView {
  active: BonusActiveView | null;
  recap: BonusRecapView | null;
}

/** Load the final score + goal events for a played match, for grading context. */
async function loadGradingContext(
  match: NextMatchBase,
): Promise<BonusMatchContext> {
  const base = {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  };
  if (match.phase === "group" && match.fixtureId) {
    const result = await prisma.groupResult.findUnique({
      where: { groupFixtureId: match.fixtureId },
      include: { goalEvents: true },
    });
    if (!result) return { ...base, finalScore: null, goalEvents: [] };
    return {
      ...base,
      finalScore: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
      goalEvents: result.goalEvents.map(toBonusGoalEvent),
    };
  }
  // Knockout: the score columns are optional, so finalScore may be null even when
  // the winner is entered. Grading handles that (score-derived types return null).
  if (match.matchNumber != null) {
    const result = await prisma.knockoutResult.findUnique({
      where: { matchNumber: match.matchNumber },
      include: { goalEvents: true },
    });
    if (!result) return { ...base, finalScore: null, goalEvents: [] };
    const finalScore =
      result.homeGoals != null && result.awayGoals != null
        ? { homeGoals: result.homeGoals, awayGoals: result.awayGoals }
        : null;
    return { ...base, finalScore, goalEvents: result.goalEvents.map(toBonusGoalEvent) };
  }
  return { ...base, finalScore: null, goalEvents: [] };
}

function toBonusGoalEvent(g: {
  id: string;
  side: string;
  scorerId: string | null;
  minute: number | null;
}): BonusGoalEvent {
  return { id: g.id, side: g.side, scorerId: g.scorerId, minute: g.minute };
}

/** Human label for a choice/answer value, given the type and lookup maps. */
function choiceLabel(
  type: string,
  value: string,
  maps: { teamNames: Map<string, string>; playerNames: Map<string, string> },
): string {
  switch (type) {
    case "BTTS":
      return value === "yes" ? "Yes" : "No";
    case "OVER_UNDER":
      return value === "over" ? "Over" : "Under";
    case "FIRST_TEAM":
      return maps.teamNames.get(value) ?? value;
    case "FIRST_SCORER":
      return maps.playerNames.get(value) ?? value;
    default:
      return value;
  }
}

/**
 * Build the whole bonus box for a viewer: the active question for the next match
 * (generated on demand) and the recap of the most recently resolved bonus.
 */
export async function getBonusBox(userId: string): Promise<BonusBoxView> {
  const matches = await allMatchesSorted();

  // Team name lookup (48 rows) is reused for labels throughout.
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  const teamNames = new Map(teams.map((t) => [t.id, t.name]));

  const nextIndex = matches.findIndex((m) => !m.played);
  const nextMatch = nextIndex >= 0 ? matches[nextIndex] : null;

  // All bonus rows so far, keyed by match number, for the active row and recap.
  const bonusRows = await prisma.bonusPrediction.findMany();
  const bonusByMatch = new Map(bonusRows.map((b) => [b.matchNumber, b]));

  const active = nextMatch
    ? await buildActive(nextMatch, userId, teamNames)
    : null;

  // Most recently resolved match (latest in sorted order) that has a bonus row.
  let recapMatch: NextMatchBase | null = null;
  for (const m of matches) {
    if (m.played && m.matchNumber != null && bonusByMatch.has(m.matchNumber)) {
      recapMatch = m; // keep the last one in chronological order.
    }
  }
  const recap = recapMatch
    ? await buildRecap(
        recapMatch,
        bonusByMatch.get(recapMatch.matchNumber!)!,
        userId,
        teamNames,
      )
    : null;

  return { active, recap };
}

/** Assemble the active question for the next match, generating the bonus if needed. */
async function buildActive(
  match: NextMatchBase,
  userId: string,
  teamNames: Map<string, string>,
): Promise<BonusActiveView | null> {
  if (match.matchNumber == null) return null;

  const bonus = await ensureBonusPredictionForMatch({
    matchNumber: match.matchNumber,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  });
  const type = bonus.type as BonusType;

  const [picks, scorerPlayers] = await Promise.all([
    prisma.bonusPredictionPick.findMany({
      where: { bonusPredictionId: bonus.id },
    }),
    type === "FIRST_SCORER"
      ? prisma.player.findMany({
          where: { teamId: { in: [match.homeTeamId, match.awayTeamId] } },
          select: { id: true, name: true, teamId: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const playerNames = new Map(scorerPlayers.map((p) => [p.id, p.name]));
  const maps = { teamNames, playerNames };

  const userPick = picks.find((p) => p.userId === userId) ?? null;
  const userChoice = userPick?.choice ?? null;

  // Reveal the tally only once the viewer has made their own pick.
  let tally: BonusTallyEntry[] | null = null;
  if (userChoice != null) {
    const counts = new Map<string, number>();
    for (const p of picks) counts.set(p.choice, (counts.get(p.choice) ?? 0) + 1);
    tally = [...counts.entries()]
      .map(([choice, count]) => ({
        choice,
        label: choiceLabel(type, choice, maps),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  const now = new Date();
  const locked = match.kickoffAt != null && match.kickoffAt <= now;

  return {
    bonusId: bonus.id,
    matchNumber: match.matchNumber,
    type,
    question: bonusQuestion(type, bonus.line),
    matchLabel: `${match.home.name} vs ${match.away.name}`,
    home: { id: match.homeTeamId, name: match.home.name, isoCode: match.home.isoCode },
    away: { id: match.awayTeamId, name: match.away.name, isoCode: match.away.isoCode },
    line: bonus.line,
    locked,
    userChoice,
    scorerOptions:
      type === "FIRST_SCORER"
        ? scorerPlayers.map((p) => ({ id: p.id, name: p.name, isoCode: p.teamId }))
        : null,
    tally,
    totalPicks: picks.length,
  };
}

/** Assemble the recap for a resolved bonus: question, correct answer, viewer result. */
async function buildRecap(
  match: NextMatchBase,
  bonus: { id: string; type: string; line: number | null },
  userId: string,
  teamNames: Map<string, string>,
): Promise<BonusRecapView> {
  const context = await loadGradingContext(match);
  const answer = correctBonusAnswer(bonus, context);

  const userPick = await prisma.bonusPredictionPick.findUnique({
    where: { userId_bonusPredictionId: { userId, bonusPredictionId: bonus.id } },
  });

  // Resolve player names needed for the answer/pick labels (scorer type only).
  const playerIds = new Set<string>();
  if (bonus.type === "FIRST_SCORER") {
    if (answer) playerIds.add(answer);
    if (userPick?.choice) playerIds.add(userPick.choice);
  }
  const players = playerIds.size
    ? await prisma.player.findMany({
        where: { id: { in: [...playerIds] } },
        select: { id: true, name: true },
      })
    : [];
  const maps = { teamNames, playerNames: new Map(players.map((p) => [p.id, p.name])) };

  const correctAnswerLabel =
    answer != null ? choiceLabel(bonus.type, answer, maps) : null;
  const userPickLabel =
    userPick != null ? choiceLabel(bonus.type, userPick.choice, maps) : null;
  const userWasRight =
    userPick == null || answer == null ? null : userPick.choice === answer;

  return {
    matchLabel: `${match.home.name} vs ${match.away.name}`,
    question: bonusQuestion(bonus.type, bonus.line),
    correctAnswerLabel,
    userPickLabel,
    userWasRight,
  };
}
