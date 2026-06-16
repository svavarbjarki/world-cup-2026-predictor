import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKnockoutResultsState } from "@/lib/predictions";
import { AdminResults } from "./admin-results-client";
import type { GoalEventView, GoalSide, PlayerOption } from "@/lib/goal-events";

export const dynamic = "force-dynamic";

interface GoalRow {
  side: string;
  scorerId: string | null;
  scorer: { name: string } | null;
  assisterId: string | null;
  assister: { name: string } | null;
  minute: number | null;
}

function toGoalView(g: GoalRow): GoalEventView {
  return {
    side: g.side as GoalSide,
    scorerId: g.scorerId,
    scorerName: g.scorer?.name ?? null,
    assisterId: g.assisterId,
    assisterName: g.assister?.name ?? null,
    minute: g.minute,
  };
}

const goalInclude = {
  scorer: { select: { name: true } },
  assister: { select: { name: true } },
} as const;

export default async function AdminResultsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [fixtures, results, knockoutState, teams, players, knockoutResults] =
    await Promise.all([
      prisma.groupFixture.findMany({
        orderBy: { matchNumber: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.groupResult.findMany(),
      getKnockoutResultsState(),
      prisma.team.findMany({ select: { id: true, isoCode: true } }),
      prisma.player.findMany({
        select: { id: true, name: true, number: true, teamId: true },
        orderBy: [{ number: "asc" }, { name: "asc" }],
      }),
      prisma.knockoutResult.findMany({ include: { goalEvents: { include: goalInclude } } }),
    ]);

  const resultByFixture = new Map(results.map((r) => [r.groupFixtureId, r]));

  // Goal events for the entered group results, grouped by GroupResult id.
  const resultIds = results.map((r) => r.id);
  const groupGoals = resultIds.length
    ? await prisma.goalEvent.findMany({
        where: { groupResultId: { in: resultIds } },
        include: goalInclude,
      })
    : [];
  const goalsByResult = new Map<string, GoalEventView[]>();
  for (const g of groupGoals) {
    if (!g.groupResultId) continue;
    const list = goalsByResult.get(g.groupResultId) ?? [];
    list.push(toGoalView(g));
    goalsByResult.set(g.groupResultId, list);
  }

  const teamFlags: Record<string, string> = {};
  for (const t of teams) teamFlags[t.id] = t.isoCode;

  // Selectable players keyed by team id (the ISO code, which is Player.teamId).
  const playersByTeam: Record<string, PlayerOption[]> = {};
  for (const p of players) {
    (playersByTeam[p.teamId] ??= []).push({
      id: p.id,
      name: p.name,
      number: p.number,
    });
  }

  // Order by kickoff time when present (unscheduled last), then match number.
  const ordered = [...fixtures].sort((a, b) => {
    const at = a.kickoffAt ? a.kickoffAt.getTime() : Number.POSITIVE_INFINITY;
    const bt = b.kickoffAt ? b.kickoffAt.getTime() : Number.POSITIVE_INFINITY;
    return at - bt || a.matchNumber - b.matchNumber;
  });

  const groupFixtures = ordered.map((f) => {
    const r = resultByFixture.get(f.id);
    return {
      id: f.id,
      matchNumber: f.matchNumber,
      group: f.group,
      matchday: f.matchday,
      kickoffLabel: f.kickoffAt ? f.kickoffAt.toLocaleString() : null,
      home: { id: f.homeTeam.id, name: f.homeTeam.name, isoCode: f.homeTeam.isoCode },
      away: { id: f.awayTeam.id, name: f.awayTeam.name, isoCode: f.awayTeam.isoCode },
      result: r ? { homeGoals: r.homeGoals, awayGoals: r.awayGoals } : null,
      goals: r ? goalsByResult.get(r.id) ?? [] : [],
    };
  });

  // Stored knockout scores + goals, keyed by official match number.
  const knockoutData: Record<
    number,
    { homeGoals: number | null; awayGoals: number | null; goals: GoalEventView[] }
  > = {};
  for (const kr of knockoutResults) {
    knockoutData[kr.matchNumber] = {
      homeGoals: kr.homeGoals,
      awayGoals: kr.awayGoals,
      goals: kr.goalEvents.map(toGoalView),
    };
  }

  return (
    <AdminResults
      groupFixtures={groupFixtures}
      knockoutState={knockoutState}
      teamFlags={teamFlags}
      playersByTeam={playersByTeam}
      knockoutData={knockoutData}
    />
  );
}
