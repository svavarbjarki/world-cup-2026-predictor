// Server loader for the /matches page: every match grouped by stage (Group A-L,
// then Round of 32, and the later real rounds as schedule placeholders) and
// ordered by kickoff. Real results are public (shown once entered); the
// prediction aggregate is gated by the same per-phase rule as elsewhere.

import { prisma } from "@/lib/prisma";
import { hasSubmitted } from "@/lib/visibility";
import {
  groupAggregate,
  knockoutAggregate,
  type MatchAggregate,
} from "@/lib/aggregates";
import { GROUP_LETTERS } from "@/lib/predictions";
import { KNOCKOUT_SCHEDULE } from "@/lib/data/schedule";

interface TeamLite {
  name: string;
  isoCode: string;
}

export interface MatchRow {
  id: string;
  phase: "group" | "knockout";
  home: TeamLite | null;
  away: TeamLite | null;
  kickoffAt: Date | null;
  venue: string | null;
  played: boolean;
  /** Group: "2-1"; knockout: the advancing team's name. Null until played. */
  result: string | null;
  /** Null for placeholder slots (no teams) or when there is nothing to gate. */
  aggregate: MatchAggregate | null;
}

export interface StageSection {
  title: string;
  matches: MatchRow[];
}

const LATER_ROUND_TITLE: Record<string, string> = {
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  BRONZE: "Third place play-off",
  FINAL: "Final",
};
const LATER_ROUND_ORDER = ["R16", "QF", "SF", "BRONZE", "FINAL"];

export async function getMatchesPageData(
  viewerId: string,
): Promise<StageSection[]> {
  const [viewer, groupFixtures, groupResults, koFixtures, koResults] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: viewerId } }),
      prisma.groupFixture.findMany({ include: { homeTeam: true, awayTeam: true } }),
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

  const groupVisible = viewer ? hasSubmitted(viewer.groupStatus) : false;
  const koVisible = viewer ? hasSubmitted(viewer.knockoutStatus) : false;

  // Submitted players' predictions, loaded only for the phases the viewer may see.
  const [groupPreds, koPreds] = await Promise.all([
    groupVisible
      ? prisma.groupPrediction.findMany({
          where: { user: { groupStatus: "SUBMITTED" } },
          select: { groupFixtureId: true, homeGoals: true, awayGoals: true },
        })
      : Promise.resolve([]),
    koVisible
      ? prisma.knockoutPrediction.findMany({
          where: { user: { knockoutStatus: "SUBMITTED" } },
          select: { matchNumber: true, predictedWinnerTeamId: true },
        })
      : Promise.resolve([]),
  ]);

  const scorelinesByFixture = new Map<
    string,
    { homeGoals: number; awayGoals: number }[]
  >();
  for (const p of groupPreds) {
    const list = scorelinesByFixture.get(p.groupFixtureId) ?? [];
    list.push({ homeGoals: p.homeGoals, awayGoals: p.awayGoals });
    scorelinesByFixture.set(p.groupFixtureId, list);
  }
  const winnerIdsByMatch = new Map<number, string[]>();
  for (const p of koPreds) {
    const list = winnerIdsByMatch.get(p.matchNumber) ?? [];
    list.push(p.predictedWinnerTeamId);
    winnerIdsByMatch.set(p.matchNumber, list);
  }

  const groupResultByFixture = new Map(
    groupResults.map((r) => [r.groupFixtureId, r]),
  );
  const koResultByMatch = new Map(
    koResults.map((r) => [r.matchNumber, r.actualWinnerTeamId]),
  );

  const byKickoffThen = <T extends { kickoffAt: Date | null; tie: number }>(
    a: T,
    b: T,
  ) => {
    if (a.kickoffAt && b.kickoffAt) {
      return a.kickoffAt.getTime() - b.kickoffAt.getTime();
    }
    if (a.kickoffAt) return -1;
    if (b.kickoffAt) return 1;
    return a.tie - b.tie;
  };

  const sections: StageSection[] = [];

  // Group stage: one section per group A-L.
  for (const letter of GROUP_LETTERS) {
    const rows = groupFixtures
      .filter((f) => f.group === letter)
      .map((f) => ({ f, tie: f.matchNumber, kickoffAt: f.kickoffAt }))
      .sort(byKickoffThen)
      .map(({ f }): MatchRow => {
        const res = groupResultByFixture.get(f.id);
        return {
          id: f.id,
          phase: "group",
          home: { name: f.homeTeam.name, isoCode: f.homeTeam.isoCode },
          away: { name: f.awayTeam.name, isoCode: f.awayTeam.isoCode },
          kickoffAt: f.kickoffAt,
          venue: f.venue,
          played: res != null,
          result: res ? `${res.homeGoals}-${res.awayGoals}` : null,
          aggregate: groupAggregate(
            groupVisible,
            scorelinesByFixture.get(f.id) ?? [],
          ),
        };
      });
    sections.push({ title: `Group ${letter}`, matches: rows });
  }

  // Round of 32 (the shared, admin-entered matches). Teams may be empty (TBD).
  const r32Rows = koFixtures
    .map((f) => ({ f, tie: f.slot, kickoffAt: f.kickoffAt }))
    .sort(byKickoffThen)
    .map(({ f }): MatchRow => {
      const hasTeams = f.homeTeam != null && f.awayTeam != null;
      const winnerId = koResultByMatch.get(f.matchNumber);
      const winnerName =
        winnerId == null
          ? null
          : winnerId === f.homeTeamId
            ? f.homeTeam?.name ?? null
            : f.awayTeam?.name ?? null;
      return {
        id: `ko-${f.matchNumber}`,
        phase: "knockout",
        home: f.homeTeam
          ? { name: f.homeTeam.name, isoCode: f.homeTeam.isoCode }
          : null,
        away: f.awayTeam
          ? { name: f.awayTeam.name, isoCode: f.awayTeam.isoCode }
          : null,
        kickoffAt: f.kickoffAt,
        venue: null,
        played: winnerId != null,
        result: winnerName,
        aggregate:
          hasTeams && f.homeTeamId
            ? knockoutAggregate(
                koVisible,
                winnerIdsByMatch.get(f.matchNumber) ?? [],
                f.homeTeamId,
              )
            : null,
      };
    });
  sections.push({ title: "Round of 32", matches: r32Rows });

  // Later rounds: schedule slots as placeholders (no real teams modelled yet).
  for (const stage of LATER_ROUND_ORDER) {
    const slots = KNOCKOUT_SCHEDULE.filter((m) => m.stage === stage);
    if (slots.length === 0) continue;
    const rows = slots.map(
      (m, i): MatchRow => ({
        id: `${stage}-${i}`,
        phase: "knockout",
        home: null,
        away: null,
        kickoffAt: new Date(m.kickoffUtc),
        venue: m.venue,
        played: false,
        result: null,
        aggregate: null,
      }),
    );
    sections.push({ title: LATER_ROUND_TITLE[stage] ?? stage, matches: rows });
  }

  return sections;
}
